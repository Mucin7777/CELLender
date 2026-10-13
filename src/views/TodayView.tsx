import { useMemo } from 'react'
import { AlertTriangle, Beaker, CalendarClock, FlaskConical, GitBranch, Plus, Sparkles, Sun } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { useCalendarEvents } from '../lib/useCalendarEvents'
import { addDaysStr, cultureDay, fmt, relativeLabel, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import { EventRow } from '../components/EventItem'
import { EmptyState, LineDot, PageHeader, StatusBadge, cx } from '../components/ui'
import type { ReactNode } from 'react'

export function TodayView() {
  const today = todayStr()
  const events = useCalendarEvents()
  const { lines, seedings, assays, loadSample } = useStore()
  const open = useUI((s) => s.open)

  const { overdue, todays, upcoming } = useMemo(() => {
    const pending = events.filter((e) => !e.done && e.type !== 'seeding' && e.type !== 'passage_done')
    const week = addDaysStr(today, 7)
    return {
      overdue: pending.filter((e) => e.date < today),
      todays: events.filter((e) => e.date === today && e.type !== 'passage_done'),
      upcoming: pending.filter((e) => e.date > today && e.date <= week),
    }
  }, [events, today])

  const activeSeedings = useMemo(
    () => seedings.filter((s) => s.status === 'culturing' || s.status === 'assay_scheduled').sort((a, b) => (a.date < b.date ? 1 : -1)),
    [seedings],
  )
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-6">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-600 to-teal-500 px-6 py-8 text-white">
            <div className="text-sm font-medium opacity-80">ようこそ</div>
            <h1 className="mt-1 text-2xl font-bold">Cellendar へようこそ</h1>
            <p className="mt-2 text-sm opacity-90">細胞の継代・播種・アッセイを、ひとつのカレンダーでまとめて管理しましょう。</p>
          </div>
          <div className="space-y-4 p-6">
            <ol className="space-y-3 text-sm text-slate-600">
              <Step n={1} title="細胞ラインを登録">ヒト回腸 Lot1、Caco-2 など、維持している細胞ごとに登録します。継代数と継代間隔を入れると次回予定が自動で計算されます。</Step>
              <Step n={2} title="継代を記録">継代するたびに「継代する」を押すだけで P 数が進み、次の予定がカレンダーに入ります。</Step>
              <Step n={3} title="播種とアッセイを管理">播種は独立した記録として登録し、アッセイ予定を紐づけます。</Step>
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <button className="btn-primary" onClick={() => open({ kind: 'line' })}>
                <Plus className="size-4" />
                最初の細胞ラインを追加
              </button>
              <button className="btn-secondary" onClick={loadSample}>
                <Sparkles className="size-4" />
                サンプルデータで試す
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const todayPassages = todays.filter((e) => e.type === 'passage_plan').length
  const todayAssays = todays.filter((e) => e.type === 'assay' && !e.done).length
  const doneToday = todays.filter((e) => e.done && e.type !== 'seeding').length
  const totalToday = todays.filter((e) => e.type !== 'seeding').length

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Sun className="size-6 text-amber-500" />
            今日の作業
          </span>
        }
        subtitle={fmt(today, 'yyyy年M月d日 (EEEE)')}
        actions={
          <>
            <button className="btn-secondary" onClick={() => open({ kind: 'seeding' })}>
              <FlaskConical className="size-4" />
              播種を記録
            </button>
            <button className="btn-primary" onClick={() => open({ kind: 'quickAdd', date: today })}>
              <Plus className="size-4" />
              予定を追加
            </button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<GitBranch className="size-4" />} label="今日の継代" value={todayPassages} color="#0d9488" />
        <StatCard icon={<Beaker className="size-4" />} label="今日のアッセイ" value={todayAssays} color="#db2777" />
        <StatCard icon={<FlaskConical className="size-4" />} label="培養中の播種" value={activeSeedings.length} color="#2563eb" onClick={() => navigate({ view: 'seedings' })} />
        <StatCard icon={<AlertTriangle className="size-4" />} label="期限超過" value={overdue.length} color={overdue.length ? '#e11d48' : '#94a3b8'} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {overdue.length > 0 && (
            <Section title="期限超過・未完了" icon={<AlertTriangle className="size-4 text-rose-500" />} tone="danger">
              {overdue.map((e) => (
                <EventRow key={e.key} event={e} showDate={`${fmt(e.date, 'M/d')}（${relativeLabel(e.date)}）`} overdue />
              ))}
            </Section>
          )}

          <Section
            title="今日"
            icon={<Sun className="size-4 text-amber-500" />}
            right={totalToday > 0 && <span className="text-xs text-slate-400">{doneToday}/{totalToday} 完了</span>}
          >
            {totalToday > 0 && (
              <div className="mx-3 mb-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(doneToday / totalToday) * 100}%` }} />
              </div>
            )}
            {todays.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">今日の予定はありません 🎉</p>
            ) : (
              todays.map((e) => <EventRow key={e.key} event={e} />)
            )}
          </Section>

          <Section title="今後 7 日間" icon={<CalendarClock className="size-4 text-slate-500" />} right={<button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => navigate({ view: 'calendar' })}>カレンダーで見る</button>}>
            {upcoming.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">予定はありません</p>
            ) : (
              upcoming.map((e) => <EventRow key={e.key} event={e} showDate={`${fmt(e.date, 'M/d (E)')} · ${relativeLabel(e.date)}`} />)
            )}
          </Section>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Section title="培養中の播種" icon={<FlaskConical className="size-4 text-blue-600" />} right={<button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => navigate({ view: 'seedings' })}>すべて</button>}>
            {activeSeedings.length === 0 ? (
              <EmptyState icon={<FlaskConical className="size-5" />} title="培養中の播種はありません" action={<button className="btn-secondary btn-sm" onClick={() => open({ kind: 'seeding' })}>播種を記録</button>} />
            ) : (
              <div className="space-y-1">
                {activeSeedings.slice(0, 6).map((s) => {
                  const line = lineById.get(s.lineId)
                  const next = assays.filter((a) => a.seedingId === s.id && !a.done).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
                  return (
                    <button key={s.id} onClick={() => navigate({ view: 'seedings', id: s.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50">
                      <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-slate-50 py-1">
                        <span className="text-[10px] text-slate-400">Day</span>
                        <span className="text-base font-bold leading-none text-slate-800">{cultureDay(s.date, today)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {line && <LineDot color={line.color} />}
                          <span className="truncate text-sm font-medium text-slate-800">{line?.name}</span>
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {s.plateType}
                          {s.purpose && ` · ${s.purpose}`}
                        </div>
                        {next && (
                          <div className={cx('mt-0.5 truncate text-xs', next.date <= today ? 'font-medium text-pink-600' : 'text-slate-400')}>
                            次: {next.name}（{relativeLabel(next.date)}）
                          </div>
                        )}
                      </div>
                      <StatusBadge status={s.status} />
                    </button>
                  )
                })}
              </div>
            )}
          </Section>

          <Section title="細胞ライン" icon={<GitBranch className="size-4 text-brand-600" />} right={<button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => navigate({ view: 'lines' })}>管理</button>}>
            <div className="space-y-0.5">
              {lines.filter((l) => !l.archived).map((l) => {
                const due = l.nextPassageDate
                const state = !due ? 'none' : due < today ? 'over' : due === today ? 'today' : 'future'
                return (
                  <button key={l.id} onClick={() => navigate({ view: 'lines', id: l.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50">
                    <LineDot color={l.color} />
                    <span className="flex-1 truncate text-sm font-medium text-slate-800">{l.name}</span>
                    <span className="font-mono text-xs text-slate-500">P{l.passageNumber}</span>
                    <span
                      className={cx(
                        'w-20 text-right text-xs',
                        state === 'over' && 'font-semibold text-rose-600',
                        state === 'today' && 'font-semibold text-amber-600',
                        state === 'future' && 'text-slate-500',
                        state === 'none' && 'text-slate-300',
                      )}
                    >
                      {due ? relativeLabel(due) : '予定なし'}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{n}</span>
      <div>
        <div className="font-semibold text-slate-800">{title}</div>
        <div className="text-slate-500">{children}</div>
      </div>
    </li>
  )
}

function StatCard({ icon, label, value, color, onClick }: { icon: ReactNode; label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="card flex items-center gap-3 p-4 text-left transition enabled:hover:shadow-md disabled:cursor-default">
      <span className="flex size-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: color }}>
        {icon}
      </span>
      <span>
        <span className="block text-2xl font-bold leading-none text-slate-900">{value}</span>
        <span className="mt-1 block text-xs text-slate-500">{label}</span>
      </span>
    </button>
  )
}

export function Section({ title, icon, right, children, tone }: { title: string; icon?: ReactNode; right?: ReactNode; children: ReactNode; tone?: 'danger' }) {
  return (
    <section className={cx('card p-1.5', tone === 'danger' && 'border-rose-200 bg-rose-50/30')}>
      <div className="flex items-center gap-2 px-3 pb-1 pt-2">
        {icon}
        <h2 className="flex-1 text-sm font-bold text-slate-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}
