// Edge Function 共通：Supabase 管理クライアント、Web Push の送信、レスポンス
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** サービスロールのクライアント（SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY はホスト環境の既定値） */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

/** VAPID の設定。未設定なら null（アプリでは「準備中」と表示） */
export function vapid(): VapidConfig | null {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

export interface SubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  daily_enabled: boolean
  daily_time: string
  assay_lead: number | null
  timezone: string
}

export interface PushMessage {
  title: string
  body: string
  url: string
  tag?: string
}

export type SendResult = 'sent' | 'gone' | 'failed'

/** 1 件送る。購読が無効（404/410）なら 'gone' */
export async function sendPush(cfg: VapidConfig, sub: Pick<SubscriptionRow, 'endpoint' | 'p256dh' | 'auth'>, msg: PushMessage): Promise<SendResult> {
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey)
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(msg),
      { TTL: 600, urgency: 'high' },
    )
    return 'sent'
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    console.error('push failed', status, (e as Error).message)
    return 'failed'
  }
}

/** 文字列の比較（タイミング差で秘密値が推測されないように） */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}
