import { useEffect, useMemo } from 'react'
import { startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useUI } from '../store/useUI'
import { usePrefs } from '../store/usePrefs'
import { useCalendarEvents } from '../lib/useCalendarEvents'
import { addDaysStr, diffDays, fmt, fromDateStr, relativeLabel, toDateStr, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import { useSwipe } from '../lib/useSwipe'
import type { DateStr } from '../types'
import { EventRow } from '../components/EventRow'
import { BrandMark } from '../components/Brand'
import { List, SectionLabel } from '../components/ui'

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const WD_JA = ['日', '月', '火', '水', '木', '金', '土']

/** カレンダーの日付をタップしたときの、その日の予定画面 */
export function DayView({ date }: { date: DateStr }) {
  const today = todayStr()
  const events = useCalendarEvents()
  const { open, calAnchor, setCalAnchor, setLastDay } = useUI()
  const weekStartsOn = usePrefs((s) => s.weekStartsOn)
  const d = fromDateStr(date)

  // カレンダーに戻ったとき、この日を含む 2 週間が表示されるようにする
  useEffect(() => {
    setLastDay(date)
    const start = toDateStr(startOfWeek(fromDateStr(calAnchor ?? today), { weekStartsOn }))
    const offset = diffDays(start, date)
    if (offset < 0 || offset > 13) setCalAnchor(date)
  }, [date, calAnchor, today, weekStartsOn, setLastDay, setCalAnchor])

  const dayEvents = useMemo(() => events.filter((e) => e.date === date), [events, date])
  const overdue = useMemo(
    () => (date === today ? events.filter((e) => !e.done && e.date < today && e.type !== 'seeding' && e.type !== 'passage_done') : []),
    [events, date, today],
  )
  const tracked = dayEvents.filter((e) => e.type !== 'seeding')
  const doneCount = tracked.filter((e) => e.done).length
  const pct = tracked.length ? Math.round((doneCount / tracked.length) * 100) : 0

  const go = (n: number) => navigate({ view: 'day', date: addDaysStr(date, n) })
  const swipe = useSwipe(() => go(1), () => go(-1))

  return (
    <div {...swipe} className="min-h-[60dvh]">
      <div className="-ml-2 -mr-2 flex items-center">
        <button className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-[15px] font-bold text-teal-dark hover:bg-mint-soft" onClick={() => navigate({ view: 'home' })}>
          <ChevronLeft className="size-5" />
          {d.getMonth() + 1}月のカレンダー
        </button>
        <div className="flex-1" />
        <button className="icon-btn" onClick={() => go(-1)} aria-label="前の日">
          <ChevronLeft className="size-5" />
        </button>
        <button className="icon-btn" onClick={() => go(1)} aria-label="次の日">
          <ChevronRight className="size-5" />
        </button>
      </div>

      <header className="mt-1 px-1">
        <div className="font-num text-[12px] font-medium tracking-[0.08em] text-faint">
          {d.getFullYear()} · {WD_EN[d.getDay()]}
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5">
          <h1 className="text-[28px] font-bold leading-tight tracking-[0.01em]">{fmt(date, 'M月d日')}</h1>
          <span className="text-[14px] font-medium text-sub">
            {WD_JA[d.getDay()]}曜日 · {relativeLabel(date, today)}
          </span>
        </div>
      </header>

      {tracked.length > 0 && (
        <div className="mt-4 flex items-center gap-3 px-1" aria-label={`完了 ${doneCount} / ${tracked.length}`}>
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-mint-soft">
            <div className="h-full rounded-full bg-teal transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-num text-[13px] font-semibold tabular-nums text-sub">
            {doneCount} / {tracked.length}
          </span>
        </div>
      )}

      {overdue.length > 0 && (
        <>
          <SectionLabel tone="danger">遅れているもの {overdue.length}</SectionLabel>
          <List>
            {overdue.map((e) => (
              <EventRow key={e.key} event={e} prefix={fmt(e.date, 'M/d')} overdue />
            ))}
          </List>
        </>
      )}

      {dayEvents.length === 0 ? (
        <div className="group-card mt-6 flex flex-col items-center px-6 pb-7 pt-8 text-center">
          <BrandMark size={96} />
          <p className="mt-4 font-bold">この日の予定はありません</p>
          <p className="mt-1 text-[13px] text-sub">継代・播種・アッセイなどを追加できます</p>
          <button className="btn-primary mt-5" onClick={() => open({ kind: 'add', date })}>
            <Plus className="size-5" />
            予定を追加
          </button>
        </div>
      ) : (
        <>
          <SectionLabel>予定</SectionLabel>
          <List>
            {[...dayEvents]
              .sort((a, b) => Number(a.done) - Number(b.done))
              .map((e) => (
                <EventRow key={e.key} event={e} />
              ))}
          </List>
          <button className="btn-secondary mt-3 w-full" onClick={() => open({ kind: 'add', date })}>
            <Plus className="size-4" />
            この日に予定を追加
          </button>
        </>
      )}
    </div>
  )
}

