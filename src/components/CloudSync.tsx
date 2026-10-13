import { useState } from 'react'
import { Cloud, CloudAlert, CloudCheck, CloudOff, LogOut, RefreshCw } from 'lucide-react'
import { format, isToday, parseISO } from 'date-fns'
import { useStore, selectData } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { useShallow } from 'zustand/react/shallow'
import { cloud, normalize, useCloud, type CloudState } from '../lib/cloud/sync'
import { toCloudError } from '../lib/cloud/backend'
import { navigate } from '../lib/router'
import { Field, List, Row, SectionLabel, Segmented, Sheet, cx } from './ui'

const timeLabel = (iso: string | null) => {
  if (!iso) return ''
  try {
    const d = parseISO(iso)
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'M/d HH:mm')
  } catch {
    return ''
  }
}

export function statusText(s: Pick<CloudState, 'status' | 'lastSyncedAt' | 'error'>): string {
  switch (s.status) {
    case 'unconfigured':
      return 'クラウド同期は設定されていません'
    case 'loading':
      return '確認中…'
    case 'signedOut':
      return 'ログインしていません（この端末だけに保存）'
    case 'syncing':
      return '同期中…'
    case 'synced':
      return s.lastSyncedAt ? `同期済み · ${timeLabel(s.lastSyncedAt)}` : '同期済み'
    case 'pending':
      return '変更を送信します…'
    case 'offline':
      return 'オフライン（つながったら送ります）'
    case 'error':
      return s.error ?? '同期でエラーが起きました'
    case 'conflict':
      return 'どちらの内容を使うか選んでください'
  }
}

function StatusIcon({ status, className }: { status: CloudState['status']; className?: string }) {
  const cls = cx('size-[22px]', className)
  switch (status) {
    case 'synced':
      return <CloudCheck className={cx(cls, 'text-teal')} />
    case 'syncing':
      return <RefreshCw className={cx(cls, 'animate-spin text-gray-sage [animation-duration:1.4s]')} />
    case 'pending':
      return <RefreshCw className={cx(cls, 'text-gray-sage')} />
    case 'offline':
      return <CloudOff className={cx(cls, 'text-gray-sage')} />
    case 'error':
    case 'conflict':
      return <CloudAlert className={cx(cls, 'text-danger')} />
    default:
      return <Cloud className={cx(cls, 'text-gray-sage')} />
  }
}

/** ヘッダー・左レールに置く同期状態の表示（押すと設定のクラウド同期へ） */
export function CloudStatusButton({ variant }: { variant: 'icon' | 'row' }) {
  const s = useCloud(useShallow((c) => ({ status: c.status, lastSyncedAt: c.lastSyncedAt, error: c.error })))
  if (s.status === 'unconfigured' || s.status === 'loading') return null
  const text = statusText(s)
  if (variant === 'icon')
    return (
      <button className="icon-btn -mr-2" onClick={() => navigate({ view: 'settings' })} aria-label={`クラウド同期：${text}`} title={text}>
        <StatusIcon status={s.status} />
      </button>
    )
  return (
    <button
      onClick={() => navigate({ view: 'settings' })}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[12.5px] text-sub transition hover:bg-mint-soft"
      aria-label={`クラウド同期：${text}`}
    >
      <StatusIcon status={s.status} className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </button>
  )
}

/** ログイン・新規登録のシート */
export function LoginSheet({ mode: initialMode = 'signIn' }: { mode?: 'signIn' | 'signUp' }) {
  const { close, toast } = useUI(useShallow((s) => ({ close: s.close, toast: s.toast })))
  const [mode, setMode] = useState<'signIn' | 'signUp'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signIn') {
        await cloud.signIn(email, password)
        close()
        toast('ログインしました。クラウドと同期します')
      } else {
        const res = await cloud.signUp(email, password)
        if (res.needsConfirmation) setSentTo(email.trim())
        else {
          close()
          toast('登録しました。クラウドと同期します')
        }
      }
    } catch (err) {
      setError(toCloudError(err).message)
    } finally {
      setBusy(false)
    }
  }

  if (sentTo)
    return (
      <Sheet title="確認メールを送りました" onClose={close} footer={<button className="btn-primary flex-1" onClick={() => {
              setSentTo(null)
              setMode('signIn')
            }}>ログイン画面へ</button>}>
        <p className="text-[15px] leading-relaxed">
          <span className="font-bold">{sentTo}</span> に確認メールを送りました。メールのリンクを開いて登録を完了してから、ログインしてください。
        </p>
        <p className="mt-3 text-[13px] text-sub">メールが届かないときは、迷惑メールフォルダも確認してください。</p>
      </Sheet>
    )

  return (
    <Sheet
      title={mode === 'signIn' ? 'ログイン' : 'アカウントを作成'}
      onClose={close}
      footer={
        <button type="submit" form="login-form" className="btn-primary flex-1" disabled={busy || !email.trim() || password.length < 6}>
          {busy ? '接続中…' : mode === 'signIn' ? 'ログイン' : '登録してはじめる'}
        </button>
      }
    >
      <form id="login-form" onSubmit={submit} className="space-y-4">
        <Segmented
          full
          value={mode}
          onChange={(m) => {
            setMode(m)
            setError(null)
          }}
          options={[
            { value: 'signIn', label: 'ログイン' },
            { value: 'signUp', label: '新規登録' },
          ]}
        />
        <p className="text-[13px] leading-relaxed text-sub">
          ログインすると、PC とスマホで同じデータを使えます。データはあなたのアカウントだけが読み書きできます。
        </p>
        <Field label="メールアドレス">
          <input className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required />
        </Field>
        <Field label="パスワード" hint={mode === 'signUp' ? '6 文字以上' : undefined}>
          <input
            className="input"
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  )
}

/** 設定画面のクラウド同期欄 */
export function CloudSettingsSection() {
  const c = useCloud()
  const open = useUI((s) => s.open)
  const toast = useUI((s) => s.toast)
  if (c.status === 'unconfigured') return null

  return (
    <>
      <SectionLabel>クラウド同期</SectionLabel>
      <List>
        {c.user ? (
          <>
            <Row left={<StatusIcon status={c.status} />} title={c.user.email} sub={statusText(c)} />
            <div className="flex gap-2 px-4 py-3">
              <button className="btn-secondary btn-sm flex-1" disabled={c.status === 'syncing'} onClick={() => void cloud.syncNow()}>
                <RefreshCw className="size-4" />
                今すぐ同期
              </button>
              <button
                className="btn-secondary btn-sm flex-1"
                onClick={() =>
                  confirmDialog({
                    title: 'ログアウトしますか？',
                    message: 'この端末のデータはそのまま残ります。もう一度ログインすると同期を再開します。',
                    confirmLabel: 'ログアウト',
                    onConfirm: () => void cloud.signOut().then(() => toast('ログアウトしました')),
                  })
                }
              >
                <LogOut className="size-4" />
                ログアウト
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-4">
            <div className="flex items-start gap-3">
              <StatusIcon status={c.status} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[15px] font-bold">PC とスマホで同じデータを使う</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-sub">ログインすると、記録がクラウドに保存され、どの端末からでも同じ内容を見られます。</p>
              </div>
            </div>
            {c.status === 'error' && c.error && <p className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">{c.error}</p>}
            {c.status === 'offline' && <p className="mt-3 text-[13px] text-sub">ネットワークに接続できません。</p>}
            <div className="mt-3 flex gap-2">
              <button className="btn-primary btn-sm flex-1" onClick={() => open({ kind: 'login', mode: 'signIn' })}>
                ログイン
              </button>
              <button className="btn-secondary btn-sm flex-1" onClick={() => open({ kind: 'login', mode: 'signUp' })}>
                新規登録
              </button>
            </div>
          </div>
        )}
      </List>
      {c.user && c.errorKind === 'setup' && (
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-danger">クラウド側の準備がまだです。Supabase の SQL Editor で supabase/setup.sql を 1 回実行してください。</p>
      )}
    </>
  )
}

/** クラウドと手元の両方が変わっていたときに、どちらを使うか選ぶダイアログ */
export function SyncConflictDialog() {
  const conflict = useCloud((c) => c.conflict)
  const local = useStore(useShallow(selectData))
  const [busy, setBusy] = useState(false)
  if (!conflict) return null
  const remote = normalize(conflict.remote.data)
  const counts = (d: typeof remote) => `ライン ${d.lines.length} · 播種 ${d.seedings.length} · アッセイ ${d.assays.length}`
  const choose = async (c: 'remote' | 'local') => {
    setBusy(true)
    try {
      await cloud.resolveConflict(c)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[58] flex items-center justify-center p-6">
      <div className="animate-fade-in absolute inset-0 bg-[#1E302B]/35" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="conflict-title" className="animate-sheet relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
        <h2 id="conflict-title" className="text-[17px] font-bold">
          クラウドとこの端末で内容が違います
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-sub">別の端末で変更された内容と、この端末の内容の両方があります。使う方を選んでください。選ばなかった方の変更は失われます。</p>
        <div className="mt-4 space-y-2">
          <button className="flex w-full items-center gap-3 rounded-2xl border border-teal bg-mint-soft px-4 py-3 text-left transition hover:bg-mint disabled:opacity-50" disabled={busy} onClick={() => void choose('remote')}>
            <CloudCheck className="size-6 shrink-0 text-teal" />
            <span className="min-w-0">
              <span className="block font-bold">クラウドの内容を使う</span>
              <span className="block text-[12px] text-sub">
                {counts(remote)}
                {conflict.remote.updatedAt && ` · ${timeLabel(conflict.remote.updatedAt)} 更新`}
              </span>
            </span>
          </button>
          <button className="flex w-full items-center gap-3 rounded-2xl border border-hair bg-white px-4 py-3 text-left transition hover:bg-mint-soft disabled:opacity-50" disabled={busy} onClick={() => void choose('local')}>
            <RefreshCw className="size-6 shrink-0 text-gray-sage" />
            <span className="min-w-0">
              <span className="block font-bold">この端末の内容を使う</span>
              <span className="block text-[12px] text-sub">{counts(normalize(local))}（クラウドを上書き）</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
