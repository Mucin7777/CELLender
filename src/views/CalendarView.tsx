import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, startOfWeek } from 'date-fns'
import { Check as CheckIcon, ChevronLeft, ChevronRight, Cloud, Plus, Sparkles } from 'lucide-react'
import { useCloud } from '../lib/cloud/sync'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { usePrefs } from '../store/usePrefs'
import { useCalendarEvents } from '../lib/useCalendarEvents'
import { groupByDate } from '../lib/events'
import { fromDateStr, toDateStr, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import { useSwipe } from '../lib/useSwipe'
import type { CalendarEvent, CellLine, DateStr } from '../types'
import { bandLook } from '../components/EventRow'
import { BrandMark } from '../components/Brand'
import { LineDot, List, cx } from '../components/ui'

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const WD_JA = ['日', '月', '火', '水', '木', '金', '土']
const SUN = '#B4513C'
const SAT = '#3E6A99'

const CHIP_H = 20
const CHIP_GAP = 3
const CELL_HEAD = 31

/** 2 週間ぶんの日付（基準日の週の頭から 14 日） */
function periodDays(anchor: DateStr, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(fromDateStr(anchor), { weekStartsOn })
  return Array.from({ length: 14 }, (_, i) => addDays(start, i))
}

/** グリッドの高さから、1 日に表示できる帯の数を求める */
function useChipCapacity(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [cap, setCap] = useState(4)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const rowH = entry.contentRect.height / 2
      setCap(Math.max(1, Math.min(9, Math.floor((rowH - CELL_HEAD - 4 + CHIP_GAP) / (CHIP_H + CHIP_GAP)))))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled])
  return { ref, cap }
}

export function CalendarView() {
  const today = todayStr()
  const lines = useStore((s) => s.lines)
  const loadSample = useStore((s) => s.loadSample)
  const events = useCalendarEvents()
  const { open, calAnchor, setCalAnchor, lastDay } = useUI()
  const { weekStartsOn, bandLabel } = usePrefs()
  const anchor = calAnchor ?? today
  const days = useMemo(() => periodDays(anchor, weekStartsOn), [anchor, weekStartsOn])
  const byDate = useMemo(() => groupByDate(events), [events])
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])
  const { ref: gridRef, cap } = useChipCapacity(lines.length > 0)
  const cloudStatus = useCloud((c) => c.status)

  const shift = (n: number) => setCalAnchor(toDateStr(addDays(fromDateStr(anchor), n)))
  const swipe = useSwipe(() => shift(14), () => shift(-14))

  if (lines.length === 0)
    return <Welcome onSample={loadSample} onAdd={() => open({ kind: 'line' })} onLogin={() => open({ kind: 'login', mode: 'signIn' })} canLogin={cloudStatus === 'signedOut'} />

  const first = days[0]
  const last = days[13]
  const monthTitle = first.getMonth() === last.getMonth() ? `${first.getMonth() + 1}月` : `${first.getMonth() + 1}月 – ${last.getMonth() + 1}月`
  const showsToday = days.some((d) => toDateStr(d) === today)
  const activeLines = lines.filter((l) => !l.archived)

  return (
    <div className="cal-fill -mx-4 flex flex-col bg-white lg:mx-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-hair">
      <header className="flex items-end gap-1 pb-3 pl-4 pr-1.5 pt-3 lg:px-6 lg:pt-5">
        <div className="min-w-0 flex-1">
          <div className="font-num text-[12px] font-medium tracking-[0.08em] text-faint">{first.getFullYear()}</div>
          <div className="mt-0.5 flex items-baseline gap-2.5">
            <h1 className="text-[26px] font-bold leading-none tracking-[0.01em]">{monthTitle}</h1>
            <span className="font-num text-[13px] tabular-nums text-sub">
              {first.getMonth() + 1}.{first.getDate()} — {last.getMonth() + 1}.{last.getDate()}
            </span>
          </div>
        </div>
        <button
          className={cx('btn-sm btn mr-0.5 border bg-white', showsToday ? 'border-hair text-sub' : 'border-teal text-teal-dark')}
          onClick={() => setCalAnchor(null)}
        >
          今日
        </button>
        <button className="icon-btn" onClick={() => shift(-14)} aria-label="前の 2 週間">
          <ChevronLeft className="size-5" />
        </button>
        <button className="icon-btn" onClick={() => shift(14)} aria-label="次の 2 週間">
          <ChevronRight className="size-5" />
        </button>
      </header>

      <div className="grid grid-cols-7 border-y border-hair" aria-hidden="true">
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} className="py-1.5 pl-2 font-num text-[10px] font-semibold tracking-[0.08em]" style={{ color: d.getDay() === 0 ? SUN : d.getDay() === 6 ? SAT : 'var(--color-faint)' }}>
            {WD_EN[d.getDay()]}
          </div>
        ))}
      </div>

      <div ref={gridRef} className="grid min-h-0 flex-1 grid-cols-7 grid-rows-2" {...swipe}>
        {days.map((d, i) => {
          const ds = toDateStr(d)
          const evs = byDate.get(ds) ?? []
          return (
            <DayCell
              key={ds}
              date={d}
              events={evs}
              lineById={lineById}
              cap={cap}
              mode={bandLabel}
              isToday={ds === today}
              isSelected={ds === lastDay && ds !== today}
              lastCol={i % 7 === 6}
              onOpen={() => navigate({ view: 'day', date: ds })}
            />
          )
        })}
      </div>

      <Legend lines={activeLines} />
    </div>
  )
}

function DayCell({
  date,
  events,
  lineById,
  cap,
  mode,
  isToday,
  isSelected,
  lastCol,
  onOpen,
}: {
  date: Date
  events: CalendarEvent[]
  lineById: Map<string, CellLine>
  cap: number
  mode: 'type' | 'line'
  isToday: boolean
  isSelected: boolean
  lastCol: boolean
  onOpen: () => void
}) {
  const wd = date.getDay()
  const sorted = [...events].sort((a, b) => Number(a.done) - Number(b.done))
  const overflow = sorted.length > cap
  const shown = overflow ? sorted.slice(0, Math.max(0, cap - 1)) : sorted
  const pending = events.filter((e) => !e.done).length
  const label = `${date.getMonth() + 1}月${date.getDate()}日（${WD_JA[wd]}）${isToday ? '、今日' : ''}、予定${events.length}件${pending ? `（未完了${pending}件）` : ''}`

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cx(
        'group flex min-h-0 min-w-0 flex-col items-stretch gap-[3px] overflow-hidden border-b border-hair px-[3px] pb-1 pt-1.5 text-left transition',
        !lastCol && 'border-r border-r-[#EDF3F0]',
        isSelected ? 'bg-mint-soft' : isToday ? 'bg-[#F4FAF7]' : 'bg-white hover:bg-mint-soft/50',
        'focus-visible:-outline-offset-2',
      )}
    >
      <span
        className={cx(
          'mb-0.5 ml-0.5 flex h-[24px] min-w-[24px] items-center justify-center self-start rounded-full px-1 font-num text-[13px] font-semibold tabular-nums',
          isToday && 'bg-teal text-white',
          isSelected && 'shadow-[inset_0_0_0_1.5px_var(--color-teal)] text-teal-dark',
        )}
        style={isToday || isSelected ? undefined : { color: wd === 0 ? SUN : wd === 6 ? SAT : 'var(--color-ink)' }}
      >
        {date.getDate() === 1 ? `${date.getMonth() + 1}/1` : date.getDate()}
      </span>
      {shown.map((e) => {
        const look = bandLook(e, e.lineId ? lineById.get(e.lineId) : undefined, mode)
        return (
          <span
            key={e.key}
            className={cx('flex h-[20px] shrink-0 items-center gap-[3px] overflow-hidden rounded-[4px] border px-1 text-[10px] font-bold leading-none', look.faded && 'opacity-45')}
            style={look.style}
          >
            {look.tick && <CheckIcon className="size-2.5 shrink-0" strokeWidth={3.2} />}
            {look.dot && <span className="size-[5px] shrink-0 rounded-full" style={{ backgroundColor: look.style.color as string }} />}
            <span className={cx('overflow-hidden whitespace-nowrap', look.strike && 'line-through')}>{look.label}</span>
          </span>
        )
      })}
      {overflow && <span className="px-1 font-num text-[10px] font-semibold text-faint">+{sorted.length - shown.length}</span>}
    </button>
  )
}

function Legend({ lines }: { lines: CellLine[] }) {
  return (
    <div className="space-y-2 border-t border-hair px-4 pb-2.5 pt-2.5 lg:px-6">
      {lines.length > 0 && (
        <div className="no-scrollbar flex gap-x-3.5 gap-y-1.5 overflow-x-auto lg:flex-wrap">
          {lines.map((l) => (
            <span key={l.id} className="flex shrink-0 items-center gap-1.5 text-[11px] text-sub">
              <LineDot color={l.color} className="size-2.5" />
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-sub" aria-label="帯の見方：塗り＝継代、点つき＝播種、枠のみ＝培地交換、濃い塗り＝アッセイ。色はライン">
        <span className="rounded-[4px] border border-[#E4ECE8] bg-[#E4ECE8] px-1.5 py-[3px] leading-none">継代</span>
        <span className="flex items-center gap-[3px] rounded-[4px] border border-[#E4ECE8] bg-[#E4ECE8] px-1.5 py-[3px] leading-none">
          <span className="size-[5px] rounded-full bg-sub" />
          播種
        </span>
        <span className="rounded-[4px] border border-gray-sage bg-white px-1.5 py-[3px] leading-none">培地</span>
        <span className="rounded-[4px] border border-sub bg-sub px-1.5 py-[3px] leading-none text-white">アッセイ</span>
        <span className="ml-auto font-medium text-faint">色＝ライン</span>
      </div>
    </div>
  )
}

function Welcome({ onSample, onAdd, onLogin, canLogin }: { onSample: () => void; onAdd: () => void; onLogin: () => void; canLogin: boolean }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center pt-6 text-center">
      <BrandMark size={128} />
      <h1 className="mt-5 text-[26px] font-bold leading-tight">
        <span className="font-num font-semibold">cellender</span> へようこそ
      </h1>
      <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-sub">
        継代・播種・アッセイの予定を、
        <br />
        ひとつのカレンダーで。
      </p>
      <List className="mt-7 w-full text-left">
        {[
          ['1', '細胞ラインを登録', '継代間隔を入れると次回予定が自動で入ります'],
          ['2', '継代するたびに記録', 'P 数が進み、次の予定がカレンダーに入ります'],
          ['3', '播種とアッセイを管理', '播種ごとにアッセイ予定をチェックできます'],
        ].map(([n, t, d]) => (
          <div key={n} className="flex gap-3 px-4 py-3.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mint font-num text-[13px] font-semibold text-teal-dark">{n}</span>
            <div>
              <div className="font-bold">{t}</div>
              <div className="text-[13px] text-sub">{d}</div>
            </div>
          </div>
        ))}
      </List>
      <div className="mt-6 w-full space-y-2">
        <button className="btn-primary w-full" onClick={onAdd}>
          <Plus className="size-5" />
          細胞ラインを追加
        </button>
        <button className="btn-secondary w-full" onClick={onSample}>
          <Sparkles className="size-4" />
          サンプルデータで試す
        </button>
        {canLogin && (
          <button className="btn-ghost w-full" onClick={onLogin}>
            <Cloud className="size-4" />
            登録済みのアカウントでログイン
          </button>
        )}
      </div>
    </div>
  )
}

