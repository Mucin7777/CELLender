import { useMemo } from 'react'
import { CalendarCheck, FlaskConical, GitBranch, Plus, Settings, type LucideIcon } from 'lucide-react'
import { useRoute, navigate, type Route } from './lib/router'
import { useStore } from './store/useStore'
import { useUI } from './store/useUI'
import { todayStr } from './lib/date'
import { ModalHost, Toaster } from './components/ModalHost'
import { cx } from './components/ui'
import { HomeView } from './views/HomeView'
import { LinesView } from './views/LinesView'
import { SeedingsView } from './views/SeedingsView'
import { SettingsView } from './views/SettingsView'

type View = Route['view']

const TABS: { key: View; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: '予定', icon: CalendarCheck },
  { key: 'lines', label: '細胞', icon: GitBranch },
  { key: 'seedings', label: '播種', icon: FlaskConical },
  { key: 'settings', label: '設定', icon: Settings },
]

/** 今日やるべき（今日まで・未完了）件数 */
function useDueCount() {
  const { lines, assays, tasks } = useStore()
  return useMemo(() => {
    const t = todayStr()
    return (
      lines.filter((l) => !l.archived && l.nextPassageDate && l.nextPassageDate <= t).length +
      assays.filter((a) => !a.done && a.date <= t).length +
      tasks.filter((x) => !x.done && x.date <= t).length
    )
  }, [lines, assays, tasks])
}

export default function App() {
  const route = useRoute()
  const open = useUI((s) => s.open)
  const due = useDueCount()
  const add = () => open({ kind: 'add' })

  const view = (() => {
    switch (route.view) {
      case 'home':
        return <HomeView />
      case 'lines':
        return <LinesView id={route.id} />
      case 'seedings':
        return <SeedingsView id={route.id} />
      case 'settings':
        return <SettingsView />
    }
  })()

  const tabButton = (t: (typeof TABS)[number], variant: 'bar' | 'rail') => {
    const active = route.view === t.key
    const Icon = t.icon
    return (
      <button
        key={t.key}
        onClick={() => navigate({ view: t.key } as Route)}
        className={cx(
          'relative flex items-center transition',
          variant === 'bar' ? 'min-h-[52px] flex-1 flex-col justify-center gap-0.5 text-[11px] font-semibold' : 'min-h-11 w-full gap-3 rounded-xl px-3 text-[15px] font-semibold',
          active ? 'text-brand-700' : 'text-faint',
          variant === 'rail' && active && 'bg-white text-brand-700',
          variant === 'rail' && !active && 'text-sub hover:bg-white/60',
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon className="size-6" strokeWidth={active ? 2.3 : 1.8} />
        {t.label}
        {t.key === 'home' && due > 0 && (
          <span className={cx('min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[11px] font-bold leading-[18px] text-white', variant === 'bar' ? 'absolute left-1/2 top-1 ml-1.5' : 'ml-auto')}>
            {due}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="min-h-full lg:flex">
      {/* PC: 左レール */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 px-3 py-5 lg:flex">
        <div className="mb-4 flex items-center gap-2 px-3">
          <svg viewBox="0 0 64 64" className="size-8" aria-hidden>
            <rect width="64" height="64" rx="16" fill="#0d9488" />
            <circle cx="26" cy="28" r="12" fill="#ccfbf1" />
            <circle cx="26" cy="28" r="4.5" fill="#0d9488" />
            <circle cx="43" cy="41" r="9" fill="#5eead4" />
            <circle cx="43" cy="41" r="3.2" fill="#0d9488" />
          </svg>
          <span className="text-[17px] font-bold tracking-tight">Cellendar</span>
        </div>
        <button className="btn-primary mb-3" onClick={add}>
          <Plus className="size-5" />
          新規追加
        </button>
        {TABS.map((t) => tabButton(t, 'rail'))}
      </aside>

      <main className="mx-auto w-full max-w-xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] lg:pb-12 lg:pt-8">{view}</main>

      {/* スマホ: 下部タブバー（中央に追加ボタン） */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center px-2">
          {tabButton(TABS[0], 'bar')}
          {tabButton(TABS[1], 'bar')}
          <div className="flex flex-1 justify-center">
            <button
              onClick={add}
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition active:scale-95"
              aria-label="新規追加"
            >
              <Plus className="size-7" />
            </button>
          </div>
          {tabButton(TABS[2], 'bar')}
          {tabButton(TABS[3], 'bar')}
        </div>
      </nav>

      <ModalHost />
      <Toaster />
    </div>
  )
}
