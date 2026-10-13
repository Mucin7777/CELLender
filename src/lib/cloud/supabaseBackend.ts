import type { AppData } from '../../types'
import { CLOUD_TABLE, SUPABASE_KEY, SUPABASE_URL } from './config'
import { toCloudError, type CloudBackend, type CloudUser, type RemoteDoc, type SaveResult } from './backend'

type Row = { data: AppData; rev: number | string; updated_at: string }

const toDoc = (r: Row): RemoteDoc => ({ data: r.data, rev: Number(r.rev), updatedAt: r.updated_at })
const toUser = (u: { id: string; email?: string | null } | null | undefined): CloudUser | null => (u ? { id: u.id, email: u.email ?? '' } : null)

/**
 * Supabase を使ったクラウドの窓口。supabase-js は同期を使うときだけ読み込む（初回表示を軽くする）。
 * ログイン情報は他のアプリと混ざらないよう専用のキーで保存する（github.io は同じ保存領域を共有するため）。
 */
export async function createSupabaseBackend(): Promise<CloudBackend> {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey: 'cellender-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })

  const fetchDoc = async (userId: string): Promise<RemoteDoc | null> => {
    const { data, error } = await sb.from(CLOUD_TABLE).select('data, rev, updated_at').eq('user_id', userId).maybeSingle()
    if (error) throw toCloudError(error)
    return data ? toDoc(data as Row) : null
  }

  const saveDoc = async (userId: string, doc: AppData, expectedRev: number | null, force = false): Promise<SaveResult> => {
    if (force) {
      const { data, error } = await sb.from(CLOUD_TABLE).upsert({ user_id: userId, data: doc }, { onConflict: 'user_id' }).select('rev, updated_at').single()
      if (error) throw toCloudError(error)
      return { ok: true, rev: Number(data.rev), updatedAt: data.updated_at }
    }
    if (expectedRev === null) {
      const { data, error } = await sb.from(CLOUD_TABLE).insert({ user_id: userId, data: doc }).select('rev, updated_at').single()
      if (error) {
        // すでに行がある＝別の端末が先に作っていた
        if (error.code === '23505') return { ok: false, conflict: await fetchDoc(userId) }
        throw toCloudError(error)
      }
      return { ok: true, rev: Number(data.rev), updatedAt: data.updated_at }
    }
    // 版番号が一致するときだけ上書き（楽観ロック）
    const { data, error } = await sb.from(CLOUD_TABLE).update({ data: doc }).eq('user_id', userId).eq('rev', expectedRev).select('rev, updated_at').maybeSingle()
    if (error) throw toCloudError(error)
    if (!data) return { ok: false, conflict: await fetchDoc(userId) }
    return { ok: true, rev: Number(data.rev), updatedAt: data.updated_at }
  }

  return {
    async getUser() {
      const { data, error } = await sb.auth.getSession()
      if (error) throw toCloudError(error)
      return toUser(data.session?.user)
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(toUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw toCloudError(error)
      const user = toUser(data.user)
      if (!user) throw toCloudError(new Error('ログインできませんでした'))
      return user
    },
    async signUp(email, password) {
      const redirect = typeof location !== 'undefined' ? location.origin + location.pathname : undefined
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } })
      if (error) throw toCloudError(error)
      // メール確認が有効なプロジェクトでは、確認するまでセッションが発行されない
      return { user: toUser(data.session?.user), needsConfirmation: !data.session }
    },
    async signOut() {
      const { error } = await sb.auth.signOut()
      if (error) throw toCloudError(error)
    },
    fetchDoc,
    saveDoc,
    subscribe(userId, cb) {
      const channel = sb
        .channel(`cellender-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: CLOUD_TABLE, filter: `user_id=eq.${userId}` }, () => cb())
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
      }
    },
  }
}
