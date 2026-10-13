// cellender-reminders：Cron から 1 分ごとに呼ばれ、送るべき通知を送る
//
// 専用の秘密値（CELLENDER_CRON_SECRET、x-cron-secret ヘッダー）を確認してから動く。
// クラウドに同期済みのデータ（cellender_state）を読むので、未同期・競合中の編集は反映されない。
import { adminClient, json, safeEqual, sendPush, vapid, type SubscriptionRow } from '../_shared/push.ts'
import { dueNotifications, type NData } from '../_shared/reminders.ts'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CELLENDER_CRON_SECRET') ?? ''
  if (!secret || !safeEqual(req.headers.get('x-cron-secret') ?? '', secret)) return json({ error: 'unauthorized' }, 401)
  const cfg = vapid()
  if (!cfg) return json({ error: 'not configured' }, 503)

  const admin = adminClient()
  const now = new Date()

  const { data: subs, error } = await admin.from('cellender_push_subscriptions').select('*')
  if (error) return json({ error: error.message }, 500)
  const rows = (subs ?? []) as SubscriptionRow[]
  if (!rows.length) return json({ checked: 0, sent: 0 })

  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const { data: states, error: stateError } = await admin.from('cellender_state').select('user_id, data').in('user_id', userIds)
  if (stateError) return json({ error: stateError.message }, 500)
  const dataByUser = new Map((states ?? []).map((s: { user_id: string; data: NData }) => [s.user_id, s.data]))

  let sent = 0
  for (const sub of rows) {
    const data = dataByUser.get(sub.user_id)
    if (!data) continue
    const due = dueNotifications(data, { dailyEnabled: sub.daily_enabled, dailyTime: sub.daily_time, assayLead: sub.assay_lead, timezone: sub.timezone }, now)
    for (const n of due) {
      // 並行して動いた Cron と重ならないよう、送信の権利を原子的に確保してから送る
      const { data: claimed } = await admin.rpc('cellender_claim_delivery', { p_subscription: sub.id, p_key: n.key })
      if (!claimed) continue
      const result = await sendPush(cfg, sub, { title: n.title, body: n.body, url: n.url, tag: n.tag })
      if (result === 'sent') {
        sent++
        await admin.from('cellender_push_deliveries').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('subscription_id', sub.id).eq('key', n.key)
      } else if (result === 'gone') {
        // 期限切れの購読は削除（送信履歴も一緒に消える）
        await admin.from('cellender_push_subscriptions').delete().eq('id', sub.id)
        break
      }
      // 'failed' は確保したままにしておき、3 分後に再試行できる
    }
  }

  // 30 日より古い送信履歴を整理
  await admin.from('cellender_push_deliveries').delete().lt('claimed_at', new Date(now.getTime() - 30 * 86_400_000).toISOString())

  return json({ checked: rows.length, sent })
})
