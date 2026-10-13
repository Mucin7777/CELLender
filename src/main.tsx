import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { cloudConfigured } from './lib/cloud/config'
import { startCloudSync } from './lib/cloud/sync'

import { initPwa } from './lib/pwa'
import { initNotifications } from './lib/notify'
import { useUI } from './store/useUI'

// iPhone の Safari はタッチの受け口がないと :active（押した瞬間の見た目）を出さないため、空の受け口を置く
document.addEventListener('touchstart', () => {}, { passive: true })

// ホーム画面（PWA）：Service Worker を登録し、新しい版の準備ができたら知らせる（切り替えは設定から）
void initPwa(() => useUI.getState().toast('新しいバージョンがあります', { label: '設定を開く', onClick: () => (window.location.hash = '#/settings') }))
initNotifications()

// クラウド同期（接続先が設定されていれば、ログイン状態を確認して同期を始める）
void startCloudSync(() => (cloudConfigured() ? import('./lib/cloud/supabaseBackend').then((m) => m.createSupabaseBackend()) : null))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
