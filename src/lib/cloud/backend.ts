import type { AppData } from '../../types'

/** クラウドに保存された 1 ユーザー分のデータ */
export interface RemoteDoc {
  data: AppData
  /** 更新のたびに増える版番号（同時編集の検出に使う） */
  rev: number
  updatedAt: string
}

export interface CloudUser {
  id: string
  email: string
}

export type SaveResult =
  | { ok: true; rev: number; updatedAt: string }
  /** 別の端末が先に更新していた。remote はその最新の内容（取得できなかった場合 null） */
  | { ok: false; conflict: RemoteDoc | null }

export type SignUpResult = { user: CloudUser | null; needsConfirmation: boolean }

/** 同期エンジンが使うクラウドの窓口。本番は Supabase、テストではメモリ上の偽物に差し替える */
export interface CloudBackend {
  getUser(): Promise<CloudUser | null>
  onAuthChange(cb: (user: CloudUser | null) => void): () => void
  signIn(email: string, password: string): Promise<CloudUser>
  signUp(email: string, password: string): Promise<SignUpResult>
  signOut(): Promise<void>
  fetchDoc(userId: string): Promise<RemoteDoc | null>
  /**
   * 保存する。expectedRev が null なら新規作成、数値ならその版から変わっていない場合だけ上書きする。
   * force=true なら版に関係なく上書きする（競合時に「この端末の内容を使う」を選んだとき）。
   */
  saveDoc(userId: string, data: AppData, expectedRev: number | null, force?: boolean): Promise<SaveResult>
  /** 他の端末での更新を受け取る（未対応なら何もしない関数を返す） */
  subscribe(userId: string, cb: () => void): () => void
  /** Edge Function を呼ぶ（ログイン中ならその利用者として） */
  invoke<T = unknown>(name: string, body: unknown): Promise<T>
}

/** 利用者に見せる日本語のエラー文（Supabase などの英語のエラーを置き換える） */
export class CloudError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'network' | 'setup' | 'unknown' = 'unknown',
  ) {
    super(message)
  }
}

export function toCloudError(e: unknown): CloudError {
  if (e instanceof CloudError) return e
  const msg = String((e as { message?: string })?.message ?? e ?? '')
  const code = String((e as { code?: string })?.code ?? '')
  if (/invalid login credentials/i.test(msg)) return new CloudError('メールアドレスかパスワードが違います', 'auth')
  if (/email not confirmed/i.test(msg)) return new CloudError('確認メールのリンクを開いてから、もう一度ログインしてください', 'auth')
  if (/already registered|already been registered/i.test(msg)) return new CloudError('このメールアドレスはすでに登録されています。ログインしてください', 'auth')
  if (/password should be at least|weak password/i.test(msg)) return new CloudError('パスワードは 6 文字以上にしてください', 'auth')
  if (/invalid email|unable to validate email/i.test(msg)) return new CloudError('メールアドレスの形式を確認してください', 'auth')
  if (/rate limit|too many requests/i.test(msg)) return new CloudError('操作が多すぎます。少し時間をおいてからお試しください', 'auth')
  if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|could not find the table/i.test(msg))
    return new CloudError('クラウド側の準備がまだです（supabase/setup.sql を実行してください）', 'setup')
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg) || (typeof navigator !== 'undefined' && navigator.onLine === false))
    return new CloudError('ネットワークに接続できません', 'network')
  return new CloudError(msg || 'クラウドとの通信でエラーが起きました', 'unknown')
}
