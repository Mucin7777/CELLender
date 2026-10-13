import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus } from 'lucide-react'
import { useRoute, navigate, type Route } from './lib/router'
import { useStore } from './store/useStore'
import { useUI } from './store/useUI'
import { todayStr } from './lib/date'
import { ModalHost, Toaster } from './components/ModalHost'
import { BrandLockup } from './components/Brand'
import { CloudStatusButton, SyncConflictDialog } from './components/CloudSync'
import { Splash, shouldShowSplash } from './components/Splash'
import { NavIcon, type NavIconName } from './components/NavIcon'
import { cx } from './components/ui'
import { CalendarView } from './views/CalendarView'
import { DayView } from './views/DayView'
import { LinesView } from './views/LinesView'
import { SeedingsView } from './views/SeedingsView'
import { SettingsView } from './views/SettingsView'

type TabKey = 'home' | 'lines' | 'seedings' | 'settings'

const TABS: { key: TabKey; label: string; icon: NavIconName }[] = [
  { key: 'home', label: 'カレンダー', icon: 'calendar' },
  { key: 'lines', label: '細胞', icon: 'cells' },
  { key: 'seedings', label: '播種', icon: 'seeding' },
  { key: 'settings', label: '設定', icon: 'settings' },
]

/** 現在のルートがどのタブに属するか（日付の画面はカレンダー） */
const tabOf = (r: Route): TabKey => (r.view === 'day' ? 'home' : r.view)

/** 今日やるべき（今日まで・未完了）件数 */
function useDueCount() {
  const { lines, assays, tasks } = useStore(useShallow((s) => ({ lines: s.lines, assays: s.assays, tasks: s.tasks })))
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
  const [splash, setSplash] = useState(shouldShowSplash)
  const current = tabOf(route)
  const isCalendar = route.view === 'home'
  // 一覧（タブの最上位）ではヘッダーにブランドを出す。詳細画面は戻るボタンが見出し代わり
  const isRoot = route.view === 'home' || route.view === 'settings' || ((route.view === 'lines' || route.view === 'seedings') && !route.id)

  const view = (() => {
    switch (route.view) {
      case 'home':
        return <CalendarView />
      case 'day':
        return <DayView key={route.date} date={route.date} />
      case 'lines':
        return <LinesView id={route.id} />
      case 'seedings':
        return <SeedingsView id={route.id} />
      case 'settings':
        return <SettingsView />
    }
  })()

  const dueBadge = (variant: 'bar' | 'rail') =>
    due > 0 && (
      <span
        aria-label={`今日までの未完了 ${due} 件`}
        className={cx(
          'min-w-[18px] rounded-full bg-danger px-1 text-center font-num text-[11px] font-semibold leading-[18px] text-white',
          variant === 'bar' ? 'absolute left-1/2 top-0.5 ml-2' : 'ml-auto',
        )}
      >
        {due}
      </span>
    )

  return (
    <div className="min-h-full lg:flex">
      {/* PC: 左レール */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-hair bg-canvas px-3 py-5 lg:flex">
        <a href="#/" className="mb-5 flex items-center rounded-xl px-3 py-1" aria-label="cellender カレンダーへ">
          <BrandLockup size={30} />
        </a>
        <button className="btn-primary mb-4" onClick={() => open({ kind: 'add' })}>
          <Plus className="size-5" />
          新規追加
        </button>
        <nav aria-label="メイン" className="flex flex-col gap-1">
          {TABS.map((t) => {
            const active = current === t.key
            return (
              <button
                key={t.key}
                onClick={() => navigate({ view: t.key } as Route)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-[15px] transition',
                  active ? 'border-hair bg-white font-bold text-teal-dark' : 'border-transparent font-medium text-sub hover:bg-mint-soft',
                )}
              >
                <NavIcon name={t.icon} active={active} size={26} />
                {t.label}
                {t.key === 'home' && dueBadge('rail')}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-hair pt-3">
          <CloudStatusButton variant="row" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* スマホ: ブランドのヘッダー（タブの最上位のみ） */}
        {isRoot && (
          <header className="sticky top-0 z-30 flex h-[var(--appbar-h)] items-center bg-canvas px-4 pt-[env(safe-area-inset-top)] lg:hidden">
            <a href="#/" aria-label="cellender カレンダーへ" className="-ml-1 rounded-xl px-1 py-1">
              <BrandLockup size={26} />
            </a>
            <div className="ml-auto">
              <CloudStatusButton variant="icon" />
            </div>
          </header>
        )}

        <main
          className={cx(
            'mx-auto w-full px-4 lg:pb-12',
            isCalendar ? 'max-w-xl pb-[var(--tabbar-h)] lg:max-w-5xl lg:px-8 lg:pt-6' : 'max-w-xl pb-[calc(var(--tabbar-h)+24px)] lg:pt-8',
            !isRoot && 'pt-[max(12px,env(safe-area-inset-top))]',
            isRoot && !isCalendar && 'pt-1',
          )}
        >
          {view}
        </main>
      </div>

      {/* スマホ: 下部タブバー（中央に追加ボタン） */}
      <nav aria-label="メイン" className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto flex h-[72px] max-w-xl items-center px-1">
          {TABS.slice(0, 2).map((t) => (
            <TabButton key={t.key} tab={t} active={current === t.key} badge={t.key === 'home' ? dueBadge('bar') : null} />
          ))}
          <div className="flex flex-1 justify-center">
            <button
              onClick={() => open({ kind: 'add' })}
              className="flex size-[52px] items-center justify-center rounded-[18px] bg-teal text-white shadow-[0_6px_16px_-6px_rgba(57,125,112,.55)] transition hover:bg-teal-dark active:scale-95"
              aria-label="新規追加"
            >
              <Plus className="size-6" strokeWidth={2.4} />
            </button>
          </div>
          {TABS.slice(2).map((t) => (
            <TabButton key={t.key} tab={t} active={current === t.key} />
          ))}
        </div>
      </nav>

      <ModalHost />
      <SyncConflictDialog />
      <Toaster />
      {splash && <Splash onDone={() => setSplash(false)} />}
    </div>
  )
}

function TabButton({ tab, active, badge }: { tab: (typeof TABS)[number]; active: boolean; badge?: React.ReactNode }) {
  return (
    <button
      onClick={() => navigate({ view: tab.key } as Route)}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'group relative flex h-[60px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10.5px] transition focus-visible:-outline-offset-2',
        active ? 'font-bold text-teal-dark' : 'font-medium text-faint',
      )}
    >
      {/* hover は選択状態（アイコンの塗り）と区別できるよう、アイコンの背後に淡い面を出す */}
      <span className={cx('flex h-8 w-12 items-center justify-center rounded-full transition group-active:bg-mint', !active && 'group-hover:bg-mint-soft')}>
        <NavIcon name={tab.icon} active={active} size={28} />
      </span>
      {tab.label}
      {badge}
    </button>
  )
}
