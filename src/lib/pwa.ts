import { create } from 'zustand'

/** ホーム画面への追加（PWA）・更新・Service Worker まわりの状態 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaState {
  /** 新しい版の準備ができた（「最新版に更新」で切り替え） */
  updateReady: boolean
  /** Android Chrome などでアプリ内から「ホーム画面に追加」できる */
  canInstall: boolean
  /** オフラインで使う準備ができた */
  offlineReady: boolean
}

export const usePwa = create<PwaState>()(() => ({ updateReady: false, canInstall: false, offlineReady: false }))

let installEvent: BeforeInstallPromptEvent | null = null
let updateSW: ((reload?: boolean) => Promise<void>) | null = null

/** ホーム画面から起動している（URL バーのない全画面表示） */
export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)

export const isIOS = (): boolean =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** アプリ起動時に 1 回呼ぶ */
export async function initPwa(onUpdateReady?: () => void): Promise<void> {
  if (typeof window === 'undefined') return

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as BeforeInstallPromptEvent
    usePwa.setState({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    usePwa.setState({ canInstall: false })
  })

  if (!('serviceWorker' in navigator)) return
  // 通知タップで、開いているアプリを該当の画面へ移動する
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'NAVIGATE' && typeof e.data.url === 'string') {
      const hash = new URL(e.data.url).hash
      if (hash) window.location.hash = hash
    }
  })

  // 開発サーバーでは登録しない（virtual モジュールが本番ビルドでのみ実体を持つ）
  if (import.meta.env.DEV) return
  const { registerSW } = await import('virtual:pwa-register')
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      usePwa.setState({ updateReady: true })
      onUpdateReady?.()
    },
    onOfflineReady() {
      usePwa.setState({ offlineReady: true })
    },
    onRegisteredSW(_url, reg) {
      // 開きっぱなしでも 1 時間ごとに新しい版を確認する
      if (reg) setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000)
    },
  })
}

/** 新しい版に切り替えて再読み込みする */
export async function applyUpdate(): Promise<void> {
  if (updateSW) await updateSW(true)
  else window.location.reload()
}

/** アプリ内の「ホーム画面に追加」ボタン（対応ブラウザのみ） */
export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false
  await installEvent.prompt()
  const { outcome } = await installEvent.userChoice
  installEvent = null
  usePwa.setState({ canInstall: false })
  return outcome === 'accepted'
}
