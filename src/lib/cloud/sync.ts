import { create } from 'zustand'
import type { AppData } from '../../types'
import { selectData, useStore } from '../../store/useStore'
import { CloudError, toCloudError, type CloudBackend, type CloudUser, type RemoteDoc, type SignUpResult } from './backend'

/**
 * クラウド同期の仕組み
 *
 * - データ全体（AppData）を 1 ユーザー 1 行としてクラウドに保存する。手元の localStorage は今まで通り使い、
 *   オフラインでも操作できる。変更は少し待ってからまとめてクラウドへ送る。
 * - クラウドの行には版番号 rev がある。最後に同期したときの rev と内容のハッシュを手元に覚えておき、
 *     手元だけ変わった → 送る / クラウドだけ変わった → 取り込む / 両方変わった → 利用者に選んでもらう
 *   と判断する（別の端末の変更を黙って上書きしない）。
 * - 他の端末での更新は、リアルタイム通知・画面に戻ったとき・30 秒ごとの確認で受け取る。
 */

export type CloudStatus =
  | 'unconfigured' // 接続先が設定されていない
  | 'loading' // 起動中
  | 'signedOut' // ログインしていない
  | 'syncing' // 通信中
  | 'synced' // 同期済み
  | 'pending' // 手元に未送信の変更がある（まもなく送る）
  | 'offline' // ネットワークにつながらない（つながったら送る）
  | 'error' // それ以外のエラー
  | 'conflict' // クラウドと手元の両方が変わっている

export interface SyncConflict {
  remote: RemoteDoc
}

export interface CloudState {
  status: CloudStatus
  user: CloudUser | null
  lastSyncedAt: string | null
  error: string | null
  /** エラーの種類（setup = クラウド側のテーブル未作成 など） */
  errorKind: CloudError['kind'] | null
  conflict: SyncConflict | null
}

export const useCloud = create<CloudState>()(() => ({
  status: 'loading',
  user: null,
  lastSyncedAt: null,
  error: null,
  errorKind: null,
  conflict: null,
}))

/** 最後に同期した時点の情報（端末ごとに保存） */
interface SyncMeta {
  userId: string | null
  rev: number | null
  hash: string | null
  syncedAt: string | null
}

export interface MetaStorage {
  load(): SyncMeta
  save(m: SyncMeta): void
}

const META_KEY = 'cellender-sync-meta'
const EMPTY_META: SyncMeta = { userId: null, rev: null, hash: null, syncedAt: null }

export const localMetaStorage: MetaStorage = {
  load() {
    try {
      return { ...EMPTY_META, ...JSON.parse(localStorage.getItem(META_KEY) ?? '{}') }
    } catch {
      return { ...EMPTY_META }
    }
  },
  save(m) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(m))
    } catch {
      /* 保存できなくても同期自体は続ける */
    }
  },
}

/** キーの順序に左右されない JSON 文字列（クラウドの jsonb はキーを並べ替えるため） */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const o = v as Record<string, unknown>
  return (
    '{' +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + stableStringify(o[k]))
      .join(',') +
    '}'
  )
}

/** 内容を比べるための形にそろえる */
export const normalize = (d: Partial<AppData> | null | undefined): AppData => ({
  version: 1,
  lines: d?.lines ?? [],
  passages: d?.passages ?? [],
  seedings: d?.seedings ?? [],
  assays: d?.assays ?? [],
  tasks: d?.tasks ?? [],
})

/** 内容のハッシュ（FNV-1a 64bit を 2 本の 32bit で近似） */
export function hashData(d: Partial<AppData> | null | undefined): string {
  const s = stableStringify(normalize(d))
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x5bd1e995)
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0') + ':' + s.length
}

export const isEmptyData = (d: AppData) => !d.lines.length && !d.passages.length && !d.seedings.length && !d.assays.length && !d.tasks.length

export interface EngineOptions {
  /** 変更を送るまで待つ時間（ms） */
  debounceMs?: number
  /** 定期確認の間隔（ms）。0 で無効 */
  pollMs?: number
  meta?: MetaStorage
  /** window のイベント（online / visibilitychange）を使うか */
  browserEvents?: boolean
}

export class SyncEngine {
  private meta: SyncMeta
  private timer: ReturnType<typeof setTimeout> | null = null
  private poller: ReturnType<typeof setInterval> | null = null
  private unsubs: (() => void)[] = []
  private unsubRealtime: (() => void) | null = null
  private applying = false
  private busy: Promise<void> = Promise.resolve()
  private readonly debounceMs: number
  private readonly pollMs: number
  private readonly metaStore: MetaStorage
  private readonly browserEvents: boolean

  constructor(
    private readonly backend: CloudBackend,
    opts: EngineOptions = {},
  ) {
    this.debounceMs = opts.debounceMs ?? 1200
    this.pollMs = opts.pollMs ?? 30_000
    this.metaStore = opts.meta ?? localMetaStorage
    this.browserEvents = opts.browserEvents ?? typeof window !== 'undefined'
    this.meta = this.metaStore.load()
    useCloud.setState({ lastSyncedAt: this.meta.syncedAt })
  }

  // ---------- 起動・終了 ----------

  async start(): Promise<void> {
    this.unsubs.push(
      useStore.subscribe((s, prev) => {
        if (this.applying) return
        if (s.lines === prev.lines && s.passages === prev.passages && s.seedings === prev.seedings && s.assays === prev.assays && s.tasks === prev.tasks) return
        this.schedulePush()
      }),
    )
    this.unsubs.push(
      this.backend.onAuthChange((u) => {
        const cur = useCloud.getState().user
        if (u && u.id !== cur?.id) void this.handleSignedIn(u)
        else if (!u && cur) this.handleSignedOut()
      }),
    )
    if (this.browserEvents) {
      const onOnline = () => void this.syncNow()
      const onVisible = () => document.visibilityState === 'visible' && void this.pull()
      window.addEventListener('online', onOnline)
      document.addEventListener('visibilitychange', onVisible)
      this.unsubs.push(() => window.removeEventListener('online', onOnline), () => document.removeEventListener('visibilitychange', onVisible))
    }
    try {
      const user = await this.backend.getUser()
      if (user) await this.handleSignedIn(user)
      else useCloud.setState({ status: 'signedOut', user: null })
    } catch (e) {
      this.fail(e)
    }
  }

  stop(): void {
    this.unsubs.forEach((u) => u())
    this.unsubs = []
    this.stopRemote()
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  // ---------- 認証 ----------

  async signIn(email: string, password: string): Promise<void> {
    const user = await this.backend.signIn(email.trim(), password)
    await this.handleSignedIn(user)
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const res = await this.backend.signUp(email.trim(), password)
    if (res.user) await this.handleSignedIn(res.user)
    return res
  }

  async signOut(): Promise<void> {
    // 送り残しがあれば先に送る
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
      await this.serial(() => this.pushNow())
    }
    await this.backend.signOut()
    this.handleSignedOut()
  }

  // ---------- 同期 ----------

  /** 手動の「今すぐ同期」・オンライン復帰時 */
  syncNow(): Promise<void> {
    if (!useCloud.getState().user) return Promise.resolve()
    return this.serial(() => this.reconcile())
  }

  /** 競合の解決 */
  resolveConflict(choice: 'remote' | 'local'): Promise<void> {
    const c = useCloud.getState().conflict
    const user = useCloud.getState().user
    if (!c || !user) return Promise.resolve()
    return this.serial(async () => {
      if (choice === 'remote') {
        this.applyRemote(user.id, c.remote)
        return
      }
      useCloud.setState({ status: 'syncing', conflict: null })
      try {
        const local = this.snapshot()
        const res = await this.backend.saveDoc(user.id, local, c.remote.rev, true)
        if (res.ok) this.markSynced(user.id, res.rev, hashData(local), res.updatedAt)
      } catch (e) {
        useCloud.setState({ conflict: c })
        this.fail(e)
      }
    })
  }

  private async handleSignedIn(user: CloudUser): Promise<void> {
    useCloud.setState({ user, error: null, errorKind: null, conflict: null })
    this.startRemote(user.id)
    await this.serial(() => this.reconcile())
  }

  private handleSignedOut(): void {
    this.stopRemote()
    useCloud.setState({ status: 'signedOut', user: null, conflict: null, error: null, errorKind: null })
  }

  private startRemote(userId: string) {
    this.stopRemote()
    try {
      this.unsubRealtime = this.backend.subscribe(userId, () => void this.pull())
    } catch {
      this.unsubRealtime = null
    }
    if (this.pollMs > 0)
      this.poller = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') void this.pull()
      }, this.pollMs)
  }

  private stopRemote() {
    this.unsubRealtime?.()
    this.unsubRealtime = null
    if (this.poller) clearInterval(this.poller)
    this.poller = null
  }

  /** 通信は 1 本ずつ順番に行う */
  private serial(fn: () => Promise<void>): Promise<void> {
    const run = this.busy.then(fn, fn)
    this.busy = run.catch(() => undefined)
    return run
  }

  private snapshot(): AppData {
    return normalize(selectData(useStore.getState()))
  }

  private schedulePush() {
    const { user, status } = useCloud.getState()
    if (!user || status === 'conflict') return
    if (status !== 'syncing') useCloud.setState({ status: 'pending' })
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.serial(() => this.pushNow())
    }, this.debounceMs)
  }

  /** 定期確認・リアルタイム通知・画面復帰時 */
  pull(): Promise<void> {
    const { user, status } = useCloud.getState()
    if (!user || status === 'conflict') return Promise.resolve()
    return this.serial(() => this.reconcile())
  }

  /** クラウドと手元を比べて、送る・取り込む・競合のどれかを行う */
  private async reconcile(): Promise<void> {
    const user = useCloud.getState().user
    if (!user || useCloud.getState().status === 'conflict') return
    useCloud.setState({ status: 'syncing' })
    try {
      const remote = await this.backend.fetchDoc(user.id)
      const local = this.snapshot()
      const localHash = hashData(local)
      const sameUser = this.meta.userId === user.id
      const localUnchanged = sameUser && this.meta.hash === localHash

      if (!remote) {
        if (isEmptyData(local)) {
          this.markSynced(user.id, null, localHash, null)
          return
        }
        await this.pushNow(true)
        return
      }
      const remoteHash = hashData(remote.data)
      if (remoteHash === localHash) {
        this.markSynced(user.id, remote.rev, localHash, remote.updatedAt)
      } else if (sameUser && this.meta.rev === remote.rev) {
        // クラウドは前回のまま、手元だけ変わった
        await this.pushNow(true)
      } else if (isEmptyData(local) || localUnchanged) {
        // 手元は前回のまま（または空）、クラウドだけ変わった
        this.applyRemote(user.id, remote)
      } else {
        useCloud.setState({ status: 'conflict', conflict: { remote } })
      }
    } catch (e) {
      this.fail(e)
    }
  }

  private async pushNow(fromReconcile = false): Promise<void> {
    const user = useCloud.getState().user
    if (!user || useCloud.getState().status === 'conflict') return
    const local = this.snapshot()
    const h = hashData(local)
    if (this.meta.userId === user.id && this.meta.hash === h && this.meta.rev !== null) {
      useCloud.setState({ status: 'synced', error: null, errorKind: null })
      return
    }
    useCloud.setState({ status: 'syncing' })
    try {
      const expected = this.meta.userId === user.id ? this.meta.rev : null
      const res = await this.backend.saveDoc(user.id, local, expected)
      if (res.ok) {
        this.markSynced(user.id, res.rev, h, res.updatedAt)
        // 送っている間にさらに変更があれば、もう一度送る
        if (hashData(this.snapshot()) !== h) this.schedulePush()
        return
      }
      // 別の端末が先に更新していた
      const remote = res.conflict
      if (!remote) {
        if (!fromReconcile) await this.reconcile()
        else useCloud.setState({ status: 'pending' })
        return
      }
      if (hashData(remote.data) === h) this.markSynced(user.id, remote.rev, h, remote.updatedAt)
      else useCloud.setState({ status: 'conflict', conflict: { remote } })
    } catch (e) {
      this.fail(e)
    }
  }

  private applyRemote(userId: string, remote: RemoteDoc) {
    this.applying = true
    try {
      useStore.getState().replaceAll(normalize(remote.data))
    } finally {
      this.applying = false
    }
    this.markSynced(userId, remote.rev, hashData(this.snapshot()), remote.updatedAt)
  }

  private markSynced(userId: string, rev: number | null, hash: string, updatedAt: string | null) {
    const syncedAt = updatedAt ?? new Date().toISOString()
    this.meta = { userId, rev, hash, syncedAt }
    this.metaStore.save(this.meta)
    useCloud.setState({ status: 'synced', lastSyncedAt: syncedAt, error: null, errorKind: null, conflict: null })
  }

  private fail(e: unknown) {
    const err = toCloudError(e)
    useCloud.setState({ status: err.kind === 'network' ? 'offline' : 'error', error: err.message, errorKind: err.kind })
  }
}

// ---------- アプリ全体で 1 つの同期エンジン ----------

let engine: SyncEngine | null = null
let starting: Promise<SyncEngine | null> | null = null

/** アプリ起動時に 1 回呼ぶ。接続先が未設定なら何もしない */
export function startCloudSync(load: () => Promise<CloudBackend> | null): Promise<SyncEngine | null> {
  if (starting) return starting
  const factory = load()
  if (!factory) {
    useCloud.setState({ status: 'unconfigured' })
    return (starting = Promise.resolve(null))
  }
  starting = factory
    .then(async (backend) => {
      engine = new SyncEngine(backend)
      await engine.start()
      return engine
    })
    .catch((e) => {
      const err = toCloudError(e)
      useCloud.setState({ status: err.kind === 'network' ? 'offline' : 'error', error: err.message, errorKind: err.kind })
      starting = null
      return null
    })
  return starting
}

export const cloud = {
  signIn: async (email: string, password: string) => {
    if (!engine) throw new CloudError('クラウドに接続できません', 'network')
    await engine.signIn(email, password)
  },
  signUp: async (email: string, password: string): Promise<SignUpResult> => {
    if (!engine) throw new CloudError('クラウドに接続できません', 'network')
    return engine.signUp(email, password)
  },
  signOut: () => engine?.signOut() ?? Promise.resolve(),
  syncNow: () => engine?.syncNow() ?? Promise.resolve(),
  resolveConflict: (c: 'remote' | 'local') => engine?.resolveConflict(c) ?? Promise.resolve(),
}
