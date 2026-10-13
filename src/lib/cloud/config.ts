/**
 * クラウド同期（Supabase）の接続先。
 *
 * ここに書くのは Supabase の「Project URL」と「Publishable（anon public）キー」です。
 * これらは公開して問題ない値で、データは supabase/setup.sql の行レベルセキュリティにより
 * ログインした本人しか読み書きできません。
 * ビルド時に環境変数 VITE_SUPABASE_URL / VITE_SUPABASE_KEY を渡すと、そちらが優先されます。
 */
const env = import.meta.env as Record<string, string | undefined>

export const SUPABASE_URL = env.VITE_SUPABASE_URL ?? 'https://hmhiglayyilleuyepftp.supabase.co'
export const SUPABASE_KEY = env.VITE_SUPABASE_KEY ?? 'sb_publishable_mrJvZBUNSrUgV09rXfkQdQ_wRIZkdBy'

export const cloudConfigured = (): boolean => /^https:\/\//.test(SUPABASE_URL) && SUPABASE_KEY.length > 20

/** 保存先テーブル（supabase/setup.sql と同じ名前） */
export const CLOUD_TABLE = 'cellender_state'
