import { useMemo, useRef, useState, type TouchEvent } from 'react'
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ja } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { usePrefs } from '../store/usePrefs'
import { useCalendarEvents } from '../lib/useCalendarEvents'
import { groupByDate } from '../lib/events'
import { addDaysStr, fmt, fromDateStr, relativeLabel, toDateStr, todayStr } from '../lib/date'
import type { CalendarEvent, DateStr } from '../types'
import { AgendaRow } from '../components/Agenda'
import { List, SectionLabel, cx } from '../components/ui'

const WD = ['日', '月', '火', '水', '木', '金', '土']

/** 左右スワイプ検出 */
function useSwipe(onLeft: () => void, onRight: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent) => {
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!start.current) return
      const dx = e.changedTouches[0].clientX - start.current.x
      const dy = e.changedTouches[0].clientY - start.current.y
      start.current = null
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)()
    },
  }
}

export function HomeView() {
  const today = todayStr()
  const events = useCalendarEvents()
  const lines = useStore((s) => s.lines)
  const loadSample = useStore((s) => s.loadSample)
  const open = useUI((s) => s.open)
  const { weekStartsOn, showMonth, set: setPrefs } = usePrefs()
  const [selected, setSelected] = useState<DateStr>(today)
  const [anchor, setAnchor] = useState<Date>(() => new Date())

  const lineColor = useMemo(() => new Map(lines.map((l) => [l.id, l.color])), [lines])
  const byDate = useMemo(() => groupByDate(events), [events])

  const days = useMemo(() => {
    if (showMonth) {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(anchor), { weekStartsOn }),
        end: endOfWeek(endOfMonth(anchor), { weekStartsOn }),
      })
    }
    return eachDayOfInterval({ start: startOfWeek(anchor, { weekStartsOn }), end: endOfWeek(anchor, { weekStartsOn }) })
  }, [anchor, showMonth, weekStartsOn])

  const shift = (dir: 1 | -1) => setAnchor((a) => (showMonth ? addMonths(a, dir) : addDays(a, dir * 7)))
  const swipe = useSwipe(() => shift(1), () => shift(-1))
  const pick = (ds: DateStr) => {
    setSelected(ds)
    setAnchor(fromDateStr(ds))
  }
  const goToday = () => pick(today)

  const isToday = selected === today
  const dayEvents = byDate.get(selected) ?? []
  const overdue = useMemo(
    () => events.filter((e) => !e.done && e.date < today && e.type !== 'seeding' && e.type !== 'passage_done'),
    [events, today],
  )
  const upcoming = useMemo(() => {
    const end = addDaysStr(today, 7)
    return events.filter((e) => !e.done && e.date > today && e.date <= end && e.type !== 'passage_done')
  }, [events, today])
  const upcomingByDate = useMemo(() => groupByDate(upcoming), [upcoming])

  // 日付セルに表示するドット（ライン色。最大3つ）
  const dots = (ds: DateStr) => {
    const evs = (byDate.get(ds) ?? []).filter((e) => !e.done || e.type === 'seeding')
    return evs.slice(0, 3).map((e) => (e.lineId ? (lineColor.get(e.lineId) ?? '#9ca3af') : '#9ca3af'))
  }

  if (lines.length === 0) return <Welcome onSample={loadSample} onAdd={() => open({ kind: 'line' })} />

  const headerDate = fromDateStr(selected)

  return (
    <div>
      {/* ヘッダー */}
      <header className="flex items-end gap-2 pb-3 pt-2">
        <button className="min-w-0 flex-1 text-left" onClick={goToday}>
          <div className="text-[13px] font-medium text-sub">{format(headerDate, 'yyyy年M月d日 (E)', { locale: ja })}</div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">{isToday ? '今日' : relativeLabel(selected)}</h1>
        </button>
        {!isToday && (
          <button className="btn-sm btn bg-white text-brand-700" onClick={goToday}>
            今日
          </button>
        )}
        <button
          className={cx('icon-btn', showMonth && 'bg-brand-50 text-brand-700')}
          onClick={() => setPrefs({ showMonth: !showMonth })}
          aria-label={showMonth ? '週表示' : '月表示'}
          title={showMonth ? '週表示' : '月表示'}
        >
          <CalendarDays className="size-5" />
        </button>
      </header>

      {/* カレンダー（週 or 月） */}
      <div className="group-card mb-5 px-2 pb-2 pt-1" {...swipe}>
        <div className="flex items-center px-1">
          <button className="icon-btn size-9" onClick={() => shift(-1)} aria-label="前へ">
            <ChevronLeft className="size-4.5" />
          </button>
          <div className="flex-1 text-center text-[13px] font-semibold text-sub">{format(anchor, 'yyyy年 M月', { locale: ja })}</div>
          <button className="icon-btn size-9" onClick={() => shift(1)} aria-label="次へ">
            <ChevronRight className="size-4.5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {days.slice(0, 7).map((d) => (
            <div key={d.getDay()} className={cx('pb-1 text-[11px] font-medium', d.getDay() === 0 ? 'text-rose-400' : d.getDay() === 6 ? 'text-sky-500' : 'text-faint')}>
              {WD[d.getDay()]}
            </div>
          ))}
          {days.map((d) => {
            const ds = toDateStr(d)
            const sel = ds === selected
            const isT = ds === today
            const out = showMonth && !isSameMonth(d, anchor)
            return (
              <button key={ds} onClick={() => setSelected(ds)} className="flex min-h-12 flex-col items-center gap-1 rounded-xl py-1" aria-label={fmt(ds, 'M月d日')}>
                <span
                  className={cx(
                    'flex size-8 items-center justify-center rounded-full text-[15px] font-semibold transition',
                    sel ? 'bg-ink text-white' : isT ? 'text-brand-600' : out ? 'text-gray-300' : 'text-ink',
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {dots(ds).map((c, i) => (
                    <span key={i} className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 遅れているもの（今日を見ているときだけ） */}
      {isToday && overdue.length > 0 && (
        <>
          <SectionLabel tone="danger">遅れているもの {overdue.length}</SectionLabel>
          <List className="mb-2">
            {overdue.map((e) => (
              <AgendaRow key={e.key} event={e} prefix={relativeLabel(e.date)} overdue />
            ))}
          </List>
        </>
      )}

      {/* 選択日の予定 */}
      <SectionLabel
        right={
          <button className="flex min-h-9 items-center gap-0.5 text-[13px] font-semibold text-brand-700" onClick={() => open({ kind: 'add', date: selected })}>
            <Plus className="size-4" />
            追加
          </button>
        }
      >
        {isToday ? '今日の予定' : `${fmt(selected, 'M月d日 (E)')} の予定`}
        {dayEvents.length > 0 && <span className="ml-1 font-normal text-faint">{dayEvents.filter((e) => e.done).length}/{dayEvents.length}</span>}
      </SectionLabel>
      {dayEvents.length === 0 ? (
        <div className="group-card py-8 text-center text-[14px] text-sub">予定はありません</div>
      ) : (
        <List>
          {sortForDay(dayEvents).map((e) => (
            <AgendaRow key={e.key} event={e} />
          ))}
        </List>
      )}

      {/* 今後7日（今日を見ているときだけ） */}
      {isToday && upcoming.length > 0 && (
        <>
          <SectionLabel>この先 7 日間</SectionLabel>
          <div className="space-y-3">
            {[...upcomingByDate.entries()].map(([ds, evs]) => (
              <div key={ds}>
                <button onClick={() => pick(ds)} className="mb-1 flex min-h-8 items-baseline gap-2 px-1 text-left">
                  <span className="text-[14px] font-bold">{fmt(ds, 'M/d (E)')}</span>
                  <span className="text-[12px] text-faint">{relativeLabel(ds)}</span>
                </button>
                <List>
                  {evs.map((e) => (
                    <AgendaRow key={e.key} event={e} />
                  ))}
                </List>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** 未完了 → 完了 の順、同じなら種類順 */
function sortForDay(evs: CalendarEvent[]) {
  return [...evs].sort((a, b) => Number(a.done) - Number(b.done))
}

function Welcome({ onSample, onAdd }: { onSample: () => void; onAdd: () => void }) {
  return (
    <div className="pt-6">
      <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
        <svg viewBox="0 0 64 64" className="size-10" aria-hidden>
          <circle cx="26" cy="28" r="12" fill="#ccfbf1" />
          <circle cx="26" cy="28" r="4.5" fill="#0d9488" />
          <circle cx="43" cy="41" r="9" fill="#5eead4" />
          <circle cx="43" cy="41" r="3.2" fill="#0d9488" />
        </svg>
      </div>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight">Cellendar へようこそ</h1>
      <p className="mt-2 text-[15px] text-sub">継代・播種・アッセイの予定を、ひとつの画面で。</p>
      <List className="mt-6">
        {[
          ['1', '細胞ラインを登録', '継代間隔を入れると次回予定が自動で入ります'],
          ['2', '継代するたびにボタンを押す', 'P数が進み、次の予定がカレンダーに入ります'],
          ['3', '播種とアッセイを記録', '播種ごとにアッセイ予定を管理できます'],
        ].map(([n, t, d]) => (
          <div key={n} className="flex gap-3 px-4 py-3.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-700">{n}</span>
            <div>
              <div className="font-semibold">{t}</div>
              <div className="text-[13px] text-sub">{d}</div>
            </div>
          </div>
        ))}
      </List>
      <div className="mt-6 space-y-2">
        <button className="btn-primary w-full" onClick={onAdd}>
          <Plus className="size-5" />
          細胞ラインを追加
        </button>
        <button className="btn-secondary w-full bg-white" onClick={onSample}>
          <Sparkles className="size-4" />
          サンプルデータで試す
        </button>
      </div>
    </div>
  )
}
