import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { cloudConfigured } from './lib/cloud/config'
import { startCloudSync } from './lib/cloud/sync'

// クラウド同期（接続先が設定されていれば、ログイン状態を確認して同期を始める）
void startCloudSync(() => (cloudConfigured() ? import('./lib/cloud/supabaseBackend').then((m) => m.createSupabaseBackend()) : null))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
