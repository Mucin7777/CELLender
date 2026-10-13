// cellender-push：端末の通知購読の登録・設定変更・解除と、テスト通知
//
// ゲートウェイの JWT チェックは無効（supabase/config.toml）ですが、公開実行を許すわけではありません。
// 'config' 以外の操作は、関数内で auth.getUser により利用者を確認し、その人の購読だけを扱います。
import { adminClient, corsHeaders, json, sendPush, vapid } from '../_shared/push.ts'
import { isValidTimeZone } from '../_shared/reminders.ts'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const LEADS = new Set([0, 15, 30, 60])

interface Body {
  action?: 'config' | 'subscribe' | 'unsubscribe' | 'test'
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  endpoint?: string
  settings?: { dailyEnabled?: boolean; dailyTime?: string; assayLead?: number | null; timezone?: string }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const cfg = vapid()
  // 公開鍵は公開してよい値。サーバー側の準備ができているかの確認にも使う
  if (body.action === 'config') return json({ ready: !!cfg, publicKey: cfg?.publicKey ?? null })
  if (!cfg) return json({ error: 'not configured' }, 503)

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const admin = adminClient()
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  const user = auth?.user
  if (authError || !user) return json({ error: 'unauthorized' }, 401)

  switch (body.action) {
    case 'subscribe': {
      const sub = body.subscription
      const endpoint = sub?.endpoint ?? ''
      if (!/^https:\/\//.test(endpoint) || !sub?.keys?.p256dh || !sub?.keys?.auth) return json({ error: 'invalid subscription' }, 400)
      const s = body.settings ?? {}
      const dailyTime = s.dailyTime && TIME_RE.test(s.dailyTime) ? s.dailyTime : '09:00'
      const assayLead = s.assayLead === null ? null : LEADS.has(Number(s.assayLead)) ? Number(s.assayLead) : 30
      const timezone = s.timezone && isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Tokyo'
      const { error } = await admin.from('cellender_push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          daily_enabled: s.dailyEnabled !== false,
          daily_time: dailyTime,
          assay_lead: assayLead,
          timezone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
      )
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    case 'unsubscribe': {
      const endpoint = body.endpoint ?? body.subscription?.endpoint ?? ''
      const { error } = await admin.from('cellender_push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    case 'test': {
      const endpoint = body.endpoint ?? ''
      const { data: row } = await admin.from('cellender_push_subscriptions').select('id, endpoint, p256dh, auth').eq('endpoint', endpoint).eq('user_id', user.id).maybeSingle()
      if (!row) return json({ error: 'subscription not found' }, 404)
      const result = await sendPush(cfg, row, { title: 'テスト通知', body: '通知は正しく届いています', url: '#/', tag: 'cellender-test' })
      if (result === 'gone') await admin.from('cellender_push_subscriptions').delete().eq('id', row.id)
      return json({ ok: result === 'sent', result })
    }

    default:
      return json({ error: 'unknown action' }, 400)
  }
})
