import type { AppData } from '../../types'
import { CloudError, type CloudBackend, type CloudUser, type RemoteDoc, type SaveResult } from './backend'

/**
 * テスト用のクラウド（メモリ上）。複数の端末から同じ「サーバー」を共有できるよう、
 * サーバー状態（FakeServer）と端末ごとの窓口（FakeBackend）を分けている。
 */
export class FakeServer {
  users = new Map<string, { id: string; password: string }>()
  rows = new Map<string, RemoteDoc>()
  offline = false
  private listeners = new Map<string, Set<() => void>>()
  private clock = 0

  now() {
    this.clock += 1
    return new Date(Date.UTC(2026, 9, 13, 0, 0, this.clock)).toISOString()
  }

  /** 別の端末がクラウドを直接書き換えた状況を作る */
  writeAsOtherDevice(userId: string, data: AppData) {
    const cur = this.rows.get(userId)
    this.rows.set(userId, { data: structuredClone(data), rev: (cur?.rev ?? 0) + 1, updatedAt: this.now() })
    this.listeners.get(userId)?.forEach((cb) => cb())
  }

  notify(userId: string) {
    this.listeners.get(userId)?.forEach((cb) => cb())
  }

  listen(userId: string, cb: () => void) {
    const set = this.listeners.get(userId) ?? new Set()
    set.add(cb)
    this.listeners.set(userId, set)
    return () => set.delete(cb)
  }
}

export class FakeBackend implements CloudBackend {
  private user: CloudUser | null = null
  private authCbs = new Set<(u: CloudUser | null) => void>()
  saves = 0

  constructor(private readonly server: FakeServer) {}

  private net() {
    if (this.server.offline) throw new CloudError('ネットワークに接続できません', 'network')
  }

  async getUser() {
    return this.user
  }
  onAuthChange(cb: (u: CloudUser | null) => void) {
    this.authCbs.add(cb)
    return () => this.authCbs.delete(cb)
  }
  async signIn(email: string, password: string) {
    this.net()
    const u = this.server.users.get(email)
    if (!u || u.password !== password) throw new CloudError('メールアドレスかパスワードが違います', 'auth')
    this.user = { id: u.id, email }
    return this.user
  }
  async signUp(email: string, password: string) {
    this.net()
    if (this.server.users.has(email)) throw new CloudError('このメールアドレスはすでに登録されています。ログインしてください', 'auth')
    const id = `user-${this.server.users.size + 1}`
    this.server.users.set(email, { id, password })
    this.user = { id, email }
    return { user: this.user, needsConfirmation: false }
  }
  async signOut() {
    this.user = null
    this.authCbs.forEach((cb) => cb(null))
  }
  async fetchDoc(userId: string) {
    this.net()
    const r = this.server.rows.get(userId)
    return r ? structuredClone(r) : null
  }
  async saveDoc(userId: string, data: AppData, expectedRev: number | null, force = false): Promise<SaveResult> {
    this.net()
    this.saves += 1
    const cur = this.server.rows.get(userId)
    if (!force) {
      if (expectedRev === null && cur) return { ok: false, conflict: structuredClone(cur) }
      if (expectedRev !== null && (!cur || cur.rev !== expectedRev)) return { ok: false, conflict: cur ? structuredClone(cur) : null }
    }
    // jsonb と同じくキーの順序が変わる状況を再現する
    const reordered = reorderKeys(data) as AppData
    const row = { data: reordered, rev: (cur?.rev ?? 0) + 1, updatedAt: this.server.now() }
    this.server.rows.set(userId, row)
    this.server.notify(userId)
    return { ok: true, rev: row.rev, updatedAt: row.updatedAt }
  }
  subscribe(userId: string, cb: () => void) {
    return this.server.listen(userId, cb)
  }
  async invoke<T>(): Promise<T> {
    this.net()
    return { ready: false, publicKey: null } as T
  }
}

/** オブジェクトのキーを逆順に並べ替えた複製（jsonb のキー並べ替えの再現） */
function reorderKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reorderKeys)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return Object.fromEntries(Object.keys(o).reverse().map((k) => [k, reorderKeys(o[k])]))
  }
  return v
}
