import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { cloud, onBeforeSignOut, useCloud } from './cloud/sync'
import { CloudError, toCloudError } from './cloud/backend'
import { isIOS, isStandalone } from './pwa'

/**
 * 通知（端末ごと）
 *
 * - 初期は OFF。ログインして、この端末で通知を許可したときだけ購読する。
 * - 設定（まとめの時刻・アッセイの何分前か・タイムゾーン）は端末ごとに保存し、サーバーにも送る。
 * - 実際の送信はサーバー（Edge Function cellender-reminders）が行うので、アプリを閉じていても届く。
 * - OFF やログアウトでは、サーバーに届かなくても端末の購読は必ず解除する。
 */

export type AssayLead = 0 | 15 | 30 | 60 | null

export interface NotifyPrefs {
  enabled: boolean
  dailyEnabled: boolean
  dailyTime: string
  assayLead: AssayLead
  timezone: string
}

export const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
  } catch {
    return 'Asia/Tokyo'
  }
}

interface NotifyState extends NotifyPrefs {
  set: (p: Partial<NotifyPrefs>) => void
}

export const useNotifyPrefs = create<NotifyState>()(
  persist(
    (set) => ({
      enabled: false,
      dailyEnabled: true,
      dailyTime: '09:00',
      assayLead: 30,
      timezone: deviceTimeZone(),
      set: (p) => set(p),
    }),
    { name: 'cellender-notify' },
  ),
)

/** サーバー側の準備状況（VAPID の設定と Edge Function のデプロイ） */
export type ServerStatus = 'unknown' | 'checking' | 'ready' | 'notReady'

export const useNotifyServer = create<{ status: ServerStatus; publicKey: string | null }>()(() => ({ status: 'unknown', publicKey: null }))

export type NotifySupport = 'supported' | 'needsHomeScreen' | 'unsupported'

/** この端末で Web Push が使えるか */
export function notifySupport(): NotifySupport {
  if (typeof window === 'undefined') return 'unsupported'
  const has = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
  // iPhone / iPad は iOS 16.4 以降、ホーム画面に追加したアイコンから起動したときだけ使える
  if (isIOS() && !isStandalone()) return 'needsHomeScreen'
  return has ? 'supported' : 'unsupported'
}

export async function checkServer(): Promise<ServerStatus> {
  if (!useCloud.getState().user) return useNotifyServer.getState().status
  useNotifyServer.setState({ status: 'checking' })
  try {
    const res = await cloud.invoke<{ ready?: boolean; publicKey?: string | null }>('cellender-push', { action: 'config' })
    const ok = !!res?.ready && !!res.publicKey
    useNotifyServer.setState({ status: ok ? 'ready' : 'notReady', publicKey: ok ? res.publicKey! : null })
    return ok ? 'ready' : 'notReady'
  } catch {
    // 関数が未デプロイ・未設定のとき
    useNotifyServer.setState({ status: 'notReady', publicKey: null })
    return 'notReady'
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new CloudError('この端末は通知に対応していません')
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new CloudError('アプリの準備がまだです。少し待ってからお試しください')), 8000)),
  ])
  return reg
}

const settingsPayload = (p: NotifyPrefs) => ({ dailyEnabled: p.dailyEnabled, dailyTime: p.dailyTime, assayLead: p.assayLead, timezone: p.timezone })

/** 通知を ON にする（許可の確認 → 購読 → サーバーに登録） */
export async function enableNotifications(): Promise<void> {
  if (!useCloud.getState().user) throw new CloudError('通知を使うにはログインしてください', 'auth')
  if (notifySupport() !== 'supported') throw new CloudError('この端末では通知を使えません')
  const status = useNotifyServer.getState().status === 'ready' ? 'ready' : await checkServer()
  const key = useNotifyServer.getState().publicKey
  if (status !== 'ready' || !key) throw new CloudError('通知のサーバー設定がまだです（準備中）', 'setup')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new CloudError(permission === 'denied' ? '通知がブロックされています。ブラウザや OS の設定で cellender の通知を許可してください' : '通知が許可されませんでした', 'auth')

  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })

  const prefs = { ...useNotifyPrefs.getState(), timezone: useNotifyPrefs.getState().timezone || deviceTimeZone() }
  try {
    await cloud.invoke('cellender-push', { action: 'subscribe', subscription: sub.toJSON(), settings: settingsPayload(prefs) })
  } catch (e) {
    await sub.unsubscribe().catch(() => undefined)
    throw toCloudError(e)
  }
  useNotifyPrefs.getState().set({ enabled: true, timezone: prefs.timezone })
}

/** 通知を OFF にする。サーバーに届かなくても、この端末の購読は解除する */
export async function disableNotifications(): Promise<void> {
  useNotifyPrefs.getState().set({ enabled: false })
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined)
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe().catch(() => undefined)
  if (useCloud.getState().user) await cloud.invoke('cellender-push', { action: 'unsubscribe', endpoint }).catch(() => undefined)
}

/** 設定を変えたら、ON のときはサーバーにも送る */
export async function updateNotifySettings(patch: Partial<NotifyPrefs>): Promise<void> {
  useNotifyPrefs.getState().set(patch)
  const prefs = useNotifyPrefs.getState()
  if (!prefs.enabled || !useCloud.getState().user) return
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  if (!sub) {
    // OS 側で購読が消えていた
    useNotifyPrefs.getState().set({ enabled: false })
    throw new CloudError('通知の登録が外れていました。もう一度 ON にしてください')
  }
  await cloud.invoke('cellender-push', { action: 'subscribe', subscription: sub.toJSON(), settings: settingsPayload(prefs) })
}

export async function sendTestNotification(): Promise<void> {
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  if (!sub) throw new CloudError('通知が ON になっていません')
  const res = await cloud.invoke<{ ok?: boolean; result?: string }>('cellender-push', { action: 'test', endpoint: sub.endpoint })
  if (!res?.ok) throw new CloudError(res?.result === 'gone' ? '通知の登録が無効になっていました。もう一度 ON にしてください' : 'テスト通知を送れませんでした')
}

/** アプリ起動時：ログアウト時に購読を解除するよう登録し、許可が取り消されていたら OFF に戻す */
export function initNotifications(): void {
  onBeforeSignOut(() => disableNotifications())
  if (typeof window === 'undefined') return
  if (useNotifyPrefs.getState().enabled && 'Notification' in window && Notification.permission !== 'granted') {
    void disableNotifications()
  }
}
