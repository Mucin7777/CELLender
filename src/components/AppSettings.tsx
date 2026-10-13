import { useEffect, useState } from 'react'
import { BellRing, Download, RefreshCw, Smartphone } from 'lucide-react'
import { usePrefs } from '../store/usePrefs'
import { useUI } from '../store/useUI'
import { useCloud } from '../lib/cloud/sync'
import { toCloudError } from '../lib/cloud/backend'
import { applyUpdate, isIOS, isStandalone, promptInstall, usePwa } from '../lib/pwa'
import {
  checkServer,
  deviceTimeZone,
  disableNotifications,
  enableNotifications,
  notifySupport,
  sendTestNotification,
  updateNotifySettings,
  useNotifyPrefs,
  useNotifyServer,
  type AssayLead,
} from '../lib/notify'
import { List, Row, SectionLabel, Toggle } from './ui'

/** 設定：アプリ（ホーム画面への追加・更新・起動演出） */
export function AppSection() {
  const { updateReady, canInstall } = usePwa()
  const { splash, set } = usePrefs()
  const toast = useUI((s) => s.toast)
  const standalone = isStandalone()
  const [updating, setUpdating] = useState(false)

  return (
    <>
      <SectionLabel>アプリ</SectionLabel>
      <List>
        {updateReady && (
          <Row
            left={<RefreshCw className="size-5 text-teal" />}
            title="新しいバージョンがあります"
            sub="入力中の内容は保存されてから更新されます"
            right={
              <button
                className="btn-primary btn-sm shrink-0"
                disabled={updating}
                onClick={() => {
                  setUpdating(true)
                  void applyUpdate()
                }}
              >
                最新版に更新
              </button>
            }
          />
        )}
        {!standalone && canInstall && (
          <Row
            onClick={() => void promptInstall().then((ok) => ok && toast('ホーム画面に追加しました'))}
            left={<Download className="size-5 text-teal-dark" />}
            title="ホーム画面に追加"
            sub="アイコンから全画面で起動できます"
          />
        )}
        {!standalone && !canInstall && (
          <div className="flex gap-3 px-4 py-3">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-gray-sage" />
            <div className="min-w-0 text-[13px] leading-relaxed text-sub">
              <p className="text-[15px] font-semibold text-ink">ホーム画面に追加すると全画面で使えます</p>
              {isIOS() ? (
                <p className="mt-0.5">Safari の共有ボタン → 「ホーム画面に追加」。追加したアイコンから起動すると、URL バーのないアプリ画面になり、通知も使えます。</p>
              ) : (
                <p className="mt-0.5">ブラウザのメニュー → 「ホーム画面に追加」または「アプリをインストール」。</p>
              )}
            </div>
          </div>
        )}
        <div className="px-4">
          <Toggle checked={splash} onChange={(v) => set({ splash: v })} label="起動時のアニメーション" />
        </div>
      </List>
      {standalone && !updateReady && <p className="mt-2 px-1 text-[12px] text-sub">ホーム画面から起動しています。新しいバージョンは自動で準備され、ここに表示されます。</p>}
    </>
  )
}

const LEADS: { value: AssayLead; label: string }[] = [
  { value: null, label: '知らせない' },
  { value: 0, label: '開始時刻' },
  { value: 15, label: '15 分前' },
  { value: 30, label: '30 分前' },
  { value: 60, label: '60 分前' },
]

/** 設定：通知 */
export function NotifySection() {
  const user = useCloud((c) => c.user)
  const prefs = useNotifyPrefs()
  const server = useNotifyServer((s) => s.status)
  const toast = useUI((s) => s.toast)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const support = notifySupport()
  const tz = deviceTimeZone()

  useEffect(() => {
    if (user && server === 'unknown') void checkServer()
  }, [user, server])

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      if (ok) toast(ok)
    } catch (e) {
      setError(toCloudError(e).message)
    } finally {
      setBusy(false)
    }
  }

  const reason =
    support === 'unsupported'
      ? 'この端末・ブラウザは通知に対応していません'
      : support === 'needsHomeScreen'
        ? 'iPhone / iPad では、ホーム画面に追加したアイコンから起動すると使えます（iOS 16.4 以降）'
        : !user
          ? '上の「クラウド同期」でログインすると使えます（予定はクラウドに同期した内容から通知されます）'
          : server === 'notReady'
            ? '準備中：サーバー側の通知設定がまだ完了していません'
            : server === 'checking' || server === 'unknown'
              ? '確認中…'
              : null

  return (
    <>
      <SectionLabel>通知</SectionLabel>
      <List>
        <div className="flex gap-3 px-4 pb-1 pt-3">
          <BellRing className="mt-0.5 size-5 shrink-0 text-gray-sage" />
          <div className="min-w-0 flex-1">
            <Toggle
              checked={prefs.enabled}
              onChange={(v) => void run(v ? enableNotifications : disableNotifications, v ? '通知を ON にしました' : '通知を OFF にしました')}
              label="この端末に通知する"
            />
          </div>
        </div>
        {(reason && !prefs.enabled) && <p className="px-4 pb-3 pl-12 text-[13px] leading-relaxed text-sub">{reason}</p>}
        {prefs.enabled && (
          <>
            <div className="flex min-h-14 items-center gap-3 px-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">毎日の予定まとめ</span>
                <span className="block text-[12px] text-sub">予定がない日は送りません</span>
              </span>
              <input
                type="time"
                aria-label="まとめの時刻"
                className="rounded-lg border border-hair bg-field px-2 py-1.5 text-[15px] disabled:opacity-40"
                value={prefs.dailyTime}
                disabled={!prefs.dailyEnabled || busy}
                onChange={(e) => e.target.value && void run(() => updateNotifySettings({ dailyTime: e.target.value }))}
              />
              <input
                type="checkbox"
                aria-label="毎日の予定まとめを送る"
                className="size-5 accent-[var(--color-teal)]"
                checked={prefs.dailyEnabled}
                disabled={busy}
                onChange={(e) => void run(() => updateNotifySettings({ dailyEnabled: e.target.checked }))}
              />
            </div>
            <label className="flex min-h-14 items-center gap-3 px-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">時刻つきアッセイ</span>
                <span className="block text-[12px] text-sub">時刻を入れたアッセイを事前に知らせます</span>
              </span>
              <select
                className="rounded-lg border border-hair bg-field px-2 py-1.5 text-[15px]"
                value={prefs.assayLead === null ? 'off' : String(prefs.assayLead)}
                disabled={busy}
                onChange={(e) => void run(() => updateNotifySettings({ assayLead: e.target.value === 'off' ? null : (Number(e.target.value) as AssayLead) }))}
              >
                {LEADS.map((l) => (
                  <option key={String(l.value)} value={l.value === null ? 'off' : String(l.value)}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-h-12 items-center gap-3 px-4 text-[13px] text-sub">
              <span className="flex-1">タイムゾーン：{prefs.timezone}</span>
              {prefs.timezone !== tz && (
                <button className="btn-ghost btn-sm" disabled={busy} onClick={() => void run(() => updateNotifySettings({ timezone: tz }), `${tz} に切り替えました`)}>
                  {tz} に合わせる
                </button>
              )}
            </div>
            <div className="px-4 py-3">
              <button className="btn-secondary btn-sm w-full" disabled={busy} onClick={() => void run(sendTestNotification, 'テスト通知を送りました')}>
                テスト通知を送る
              </button>
            </div>
          </>
        )}
      </List>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
          {error}
        </p>
      )}
      {prefs.enabled && <p className="mt-2 px-1 text-[12px] leading-relaxed text-sub">ロック画面には細胞名や実験名を出さず、件数と時刻だけを表示します。クラウドに同期済みの予定から通知されます。</p>}
    </>
  )
}
