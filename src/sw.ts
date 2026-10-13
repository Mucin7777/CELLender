/// <reference lib="webworker" />
/**
 * cellender の Service Worker
 *
 * - アプリ本体（HTML / JS / CSS / 画像）をプリキャッシュし、オフラインでも起動・記録できるようにする。
 *   Supabase（認証・研究データ）と外部フォントはキャッシュしない（常にネットワーク）。
 * - 新しい版は裏で準備し、アプリから SKIP_WAITING が届いたときだけ切り替える（入力中に突然更新しない）。
 * - プッシュ通知の表示と、通知タップで該当日の画面を開く処理。
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// 画面遷移（ナビゲーション）はプリキャッシュした index.html で応答する（オフライン起動）
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

interface PushPayload {
  title?: string
  body?: string
  /** アプリ内の遷移先（例: '#/day/2026-10-13'） */
  url?: string
  tag?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  const scope = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.title || 'cellender', {
      body: data.body || '',
      tag: data.tag,
      icon: new URL('icon-192.png', scope).href,
      badge: new URL('favicon-32.png', scope).href,
      data: { url: data.url || '#/' },
      lang: 'ja',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(String(event.notification.data?.url || '#/'), self.registration.scope).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if (w.url.startsWith(self.registration.scope)) {
          // 開いているアプリに遷移先を伝える（ハッシュだけ変えるので、入力中の内容は消えない）
          w.postMessage({ type: 'NAVIGATE', url: target })
          await w.focus()
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})
