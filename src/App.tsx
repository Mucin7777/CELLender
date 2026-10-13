import { useMemo } from 'react'
import { Beaker, CalendarDays, FlaskConical, GitBranch, Plus, Settings, Sun } from 'lucide-react'
import { useRoute, navigate, type Route } from './lib/router'
import { useStore } from './store/useStore'
import { useUI } from './store/useUI'
import { todayStr } from './lib/date'
import { ModalHost, Toaster } from './components/ModalHost'
import { cx } from './components/ui'
import { TodayView } from './views/TodayView'
import { CalendarView } from './views/CalendarView'
import { LinesView } from './views/LinesView'
import { SeedingsView } from './views/SeedingsView'
import { AssaysView } from './views/AssaysView'
import { SettingsView } from './views/SettingsView'

type NavKey = Route['view']

const NAV: { key: NavKey; label: string; short: string; icon: typeof Sun }[] = [
  { key: 'today', label: '今日の作業', short: '今日', icon: Sun },
  { key: 'calendar', label: 'カレンダー', short: 'カレンダー', icon: CalendarDays },
  { key: 'lines', label: '細胞ライン', short: 'ライン', icon: GitBranch },
  { key: 'seedings', label: '播種記録', short: '播種', icon: FlaskConical },
  { key: 'assays', label: 'アッセイ', short: 'アッセイ', icon: Beaker },
]

function useBadges(): Partial<Record<NavKey, number>> {
  const { lines, assays, tasks, seedings } = useStore()
  return useMemo(() => {
    const t = todayStr()
    const passageDue = lines.filter((l) => !l.archived && l.nextPassageDate && l.nextPassageDate <= t).length
    const assayDue = assays.filter((a) => !a.done && a.date <= t).length
    const taskDue = tasks.filter((x) => !x.done && x.date <= t).length
    return {
      today: passageDue + assayDue + taskDue,
      lines: passageDue,
      assays: assayDue,
      seedings: seedings.filter((s) => s.status === 'culturing' || s.status === 'assay_scheduled').length,
    }
  }, [lines, assays, tasks, seedings])
}

export default function App() {
  const route = useRoute()
  const open = useUI((s) => s.open)
  const badges = useBadges()

  const view = (() => {
    switch (route.view) {
      case 'today':
        return <TodayView />
      case 'calendar':
        return <CalendarView />
      case 'lines':
        return <LinesView id={route.id} />
      case 'seedings':
        return <SeedingsView id={route.id} />
      case 'assays':
        return <AssaysView />
      case 'settings':
        return <SettingsView />
    }
  })()

  return (
    <div className="flex h-full">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo />
          <div>
            <div className="text-lg font-extrabold leading-none tracking-tight text-slate-900">Cellendar</div>
            <div className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-400">細胞培養スケジュール</div>
          </div>
        </div>
        <div className="px-3 pb-3">
          <button className="btn-primary w-full" onClick={() => open({ kind: 'quickAdd', date: todayStr() })}>
            <Plus className="size-4" />
            新規追加
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map((n) => (
            <NavItem key={n.key} item={n} active={route.view === n.key} badge={badges[n.key]} alert={n.key !== 'seedings'} />
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <NavItem item={{ key: 'settings', label: '設定・データ', short: '設定', icon: Settings }} active={route.view === 'settings'} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <Logo small />
          <span className="text-base font-extrabold tracking-tight text-slate-900">Cellendar</span>
          <button className="icon-btn ml-auto" onClick={() => navigate({ view: 'settings' })} aria-label="設定">
            <Settings className="size-5" />
          </button>
        </header>

        <main id="main-scroll" className={cx('flex-1 overflow-y-auto px-3 pb-24 pt-4 sm:px-6 lg:pb-8 lg:pt-6', route.view === 'calendar' && 'lg:flex lg:flex-col')}>
          {view}
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          {NAV.map((n) => {
            const Icon = n.icon
            const active = route.view === n.key
            const b = badges[n.key]
            return (
              <button key={n.key} onClick={() => navigate({ view: n.key } as Route)} className={cx('relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', active ? 'text-brand-700' : 'text-slate-500')}>
                <Icon className="size-5" />
                {n.short}
                {!!b && n.key !== 'seedings' && <span className="absolute right-[22%] top-1 min-w-4 rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-4 text-white">{b}</span>}
              </button>
            )
          })}
        </nav>
        {/* FAB (mobile) */}
        <button
          className="fixed bottom-20 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 active:bg-brand-700 lg:hidden"
          onClick={() => open({ kind: 'quickAdd', date: todayStr() })}
          aria-label="新規追加"
        >
          <Plus className="size-6" />
        </button>
      </div>

      <ModalHost />
      <Toaster />
    </div>
  )
}

function NavItem({ item, active, badge, alert }: { item: (typeof NAV)[number]; active: boolean; badge?: number; alert?: boolean }) {
  const Icon = item.icon
  return (
    <button
      onClick={() => navigate({ view: item.key } as Route)}
      className={cx(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
        active ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      )}
    >
      <Icon className={cx('size-4.5', active ? 'text-brand-600' : 'text-slate-400')} />
      <span className="flex-1 text-left">{item.label}</span>
      {!!badge && (
        <span className={cx('min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5', alert ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600')}>{badge}</span>
      )}
    </button>
  )
}

function Logo({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={small ? 'size-7' : 'size-9'} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0f766e" />
      <circle cx="26" cy="28" r="12" fill="#ccfbf1" />
      <circle cx="26" cy="28" r="4.5" fill="#0f766e" />
      <circle cx="43" cy="41" r="9" fill="#5eead4" />
      <circle cx="43" cy="41" r="3.2" fill="#0f766e" />
    </svg>
  )
}
