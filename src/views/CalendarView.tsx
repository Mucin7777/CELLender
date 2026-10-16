import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
import { bandLook, compareLane, laneLook, lineShort } from '../components/EventRow'
import { lineTone } from '../lib/color'
import { BrandLogo } from '../components/Brand'
import { LineDot, List, cx } from '../components/ui'

const WD_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const WD_JA = ['日', '月', '火', '水', '木', '金', '土']
const SUN = '#B4513C'
const SAT = '#3E6A99'

const CHIP_H = 20
const CHIP_GAP = 3
/** 日付セルの上端から、最初の帯（またはラインの段）までの高さ */
const CELL_HEAD = 35
const CELL_PAD_B = 4
/** ラインの段：どのラインも同じ高さ */
const LANE_H = 20
const LANE_GAP = 3

/** 2 週間ぶんの日付（基準日の週の頭から 14 日） */
function periodDays(anchor: DateStr, weekStartsOn: 0 | 1): Date[] {
  const start = startOfWeek(fromDateStr(anchor), { weekStartsOn })
  return Array.from({ length: 14 }, (_, i) => addDays(start, i))
}

/** グリッド 1 行（1 週）の高さを測る。段や帯がいくつ入るかの計算に使う */
function useRowHeight(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [rowH, setRowH] = useState(220)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setRowH(entry.contentRect.height / 2))
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled])
  return { ref, rowH }
}

/** 段の下に残った高さに入る帯の数 */
const chipCapacity = (rowH: number, laneSpace: number) =>
  Math.max(1, Math.min(9, Math.floor((rowH - CELL_HEAD - CELL_PAD_B - laneSpace + CHIP_GAP) / (CHIP_H + CHIP_GAP))))

/** ラインの段をいくつ置けるか（ラインに属さない予定のために、帯 1 本ぶんは残す） */
const laneCapacity = (rowH: number) => Math.max(0, Math.floor((rowH - CELL_HEAD - CELL_PAD_B - CHIP_H) / (LANE_H + LANE_GAP)))

export function CalendarView() {
  const today = todayStr()
  const lines = useStore((s) => s.lines)
  const loadSample = useStore((s) => s.loadSample)
  const events = useCalendarEvents()
  const { open, calAnchor, setCalAnchor, lastDay } = useUI(useShallow((s) => ({ open: s.open, calAnchor: s.calAnchor, setCalAnchor: s.setCalAnchor, lastDay: s.lastDay })))
  const { weekStartsOn, bandLabel, calStyle } = usePrefs(useShallow((s) => ({ weekStartsOn: s.weekStartsOn, bandLabel: s.bandLabel, calStyle: s.calStyle })))
  const anchor = calAnchor ?? today
  const days = useMemo(() => periodDays(anchor, weekStartsOn), [anchor, weekStartsOn])
  const byDate = useMemo(() => groupByDate(events), [events])
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])
  const { ref: gridRef, rowH } = useRowHeight(lines.length > 0)
  const lanesMode = calStyle === 'lanes'

  // ラインの段：表示中の 2 週間に予定があるラインを優先し、並び順はラインの登録順のまま
  const laneLines = useMemo(() => {
    if (!lanesMode) return []
    const from = toDateStr(days[0])
    const to = toDateStr(days[13])
    const busy = new Set(events.filter((e) => e.lineId && e.date >= from && e.date <= to).map((e) => e.lineId!))
    const candidates = lines.filter((l) => !l.archived || busy.has(l.id))
    const slots = laneCapacity(rowH)
    if (candidates.length <= slots) return candidates
    const keep = new Set([...candidates.filter((l) => busy.has(l.id)), ...candidates.filter((l) => !busy.has(l.id))].slice(0, slots).map((l) => l.id))
    return candidates.filter((l) => keep.has(l.id))
  }, [lanesMode, days, events, lines, rowH])
  const laneIds = useMemo(() => new Set(laneLines.map((l) => l.id)), [laneLines])
  const laneSpace = laneLines.length * (LANE_H + LANE_GAP)
  const cap = chipCapacity(rowH, laneSpace)
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

      <div className="flex border-y border-hair" aria-hidden="true">
        {laneLines.length > 0 && <div className={cx(GUTTER_W, 'shrink-0 border-r border-hair')} />}
        <div className="grid min-w-0 flex-1 grid-cols-7">
          {days.slice(0, 7).map((d) => (
            <div key={d.getDay()} className="py-1.5 pl-2 font-num text-[10px] font-semibold tracking-[0.08em]" style={{ color: d.getDay() === 0 ? SUN : d.getDay() === 6 ? SAT : 'var(--color-faint)' }}>
              {WD_EN[d.getDay()]}
            </div>
          ))}
        </div>
      </div>

      <div ref={gridRef} className="flex min-h-0 flex-1 flex-col" {...swipe}>
        {[0, 1].map((w) => {
          const week = days.slice(w * 7, w * 7 + 7)
          return (
            <div key={w} className="flex min-h-0 flex-1">
              {laneLines.length > 0 && <LaneLabels lines={laneLines} />}
              <div className="relative grid min-w-0 flex-1 grid-cols-7">
                {week.map((d, i) => {
                  const ds = toDateStr(d)
                  const evs = byDate.get(ds) ?? []
                  return (
                    <DayCell
                      key={ds}
                      date={d}
                      events={evs}
                      chips={lanesMode ? evs.filter((e) => !e.lineId || !laneIds.has(e.lineId)) : evs}
                      laneSpace={laneSpace}
                      lineById={lineById}
                      cap={cap}
                      mode={bandLabel}
                      isToday={ds === today}
                      isSelected={ds === lastDay && ds !== today}
                      lastCol={i === 6}
                      onOpen={() => navigate({ view: 'day', date: ds })}
                    />
                  )
                })}
                {laneLines.length > 0 && <LaneLayer week={week} lines={laneLines} byDate={byDate} />}
              </div>
            </div>
          )
        })}
      </div>

      <Legend lines={activeLines} lanes={lanesMode} />
    </div>
  )
}

function DayCell({
  date,
  events,
  chips,
  laneSpace,
  lineById,
  cap,
  mode,
  isToday,
  isSelected,
  lastCol,
  onOpen,
}: {
  date: Date
  /** この日のすべての予定（読み上げ用） */
  events: CalendarEvent[]
  /** 帯として出す予定（ラインの段に出したものは除く） */
  chips: CalendarEvent[]
  /** ラインの段が占める高さ（帯はその下に並べる） */
  laneSpace: number
  lineById: Map<string, CellLine>
  cap: number
  mode: 'type' | 'line'
  isToday: boolean
  isSelected: boolean
  lastCol: boolean
  onOpen: () => void
}) {
  const wd = date.getDay()
  const sorted = [...chips].sort((a, b) => Number(a.done) - Number(b.done))
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
        'active:bg-mint',
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
      {laneSpace > 0 && <span aria-hidden="true" className="shrink-0" style={{ height: laneSpace - CHIP_GAP }} />}
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

/** ライン名の列（段と同じ高さで左端にそろえる）。スマホは略称、PC は名前 */
const GUTTER_W = 'w-[52px] lg:w-[104px]'

function LaneLabels({ lines }: { lines: CellLine[] }) {
  return (
    <div aria-hidden="true" className={cx(GUTTER_W, 'flex shrink-0 flex-col border-b border-r border-hair bg-white')} style={{ paddingTop: CELL_HEAD, gap: LANE_GAP }}>
      {lines.map((line) => (
        <div key={line.id} className="flex items-center overflow-hidden pl-1.5 pr-1 text-[10px] font-bold leading-none lg:pl-4 lg:text-[11px]" style={{ height: LANE_H, color: lineTone(line.color).deep }}>
          <span className="truncate lg:hidden">{lineShort(line)}</span>
          <span className="hidden truncate lg:inline">{line.name}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * ラインの段：1 ラインにつき 1 段、どのラインも同じ高さで、週の端から端まで同じ淡い色の帯が続く。
 * 予定のある日だけ、その上に印（継代は濃い色など）を重ねる。タップは下の日付セルが受け取る。
 */
function LaneLayer({ week, lines, byDate }: { week: Date[]; lines: CellLine[]; byDate: Map<DateStr, CalendarEvent[]> }) {
  const dates = week.map(toDateStr)
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 flex flex-col" style={{ top: CELL_HEAD, gap: LANE_GAP }}>
      {lines.map((line) => {
        const tone = lineTone(line.color)
        const perDay = dates.map((ds) => (byDate.get(ds) ?? []).filter((e) => e.lineId === line.id).sort(compareLane))
        return (
          <div key={line.id} className="grid grid-cols-7" style={{ height: LANE_H }}>
            {perDay.map((evs, i) => (
              <div
                key={dates[i]}
                className={cx('relative min-w-0', i === 0 && 'ml-[3px] rounded-l-full', i === 6 && 'mr-[3px] rounded-r-full')}
                style={{ backgroundColor: tone.pale }}
              >
                {evs.length > 0 && <LaneMark event={evs[0]} line={line} more={evs.length - 1} />}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function LaneMark({ event, line, more }: { event: CalendarEvent; line: CellLine; more: number }) {
  const look = laneLook(event, line)
  return (
    <span
      className={cx(
        'absolute inset-y-0 inset-x-[2px] flex items-center gap-[2px] overflow-hidden rounded-[4px] border-[1.5px] px-[3px] text-[10px] font-bold leading-none',
        look.faded && 'opacity-45',
      )}
      style={look.style}
    >
      {look.tick && <CheckIcon className="size-2.5 shrink-0" strokeWidth={3.2} />}
      {look.dot && <span className="size-[5px] shrink-0 rounded-full" style={{ backgroundColor: look.style.color as string }} />}
      <span className={cx('min-w-0 overflow-hidden whitespace-nowrap', look.strike && 'line-through')}>{look.label}</span>
      {more > 0 && <span className="ml-auto shrink-0 font-num text-[9px]">+{more}</span>}
    </span>
  )
}

/** 凡例の見本に使う中立の色（実際の色はライン） */
const SAMPLE_TONE = lineTone('#7D928D')

function Legend({ lines, lanes }: { lines: CellLine[]; lanes: boolean }) {
  return (
    <div className="space-y-2 border-t border-hair px-4 pb-2.5 pt-2.5 lg:px-6">
      {lines.length > 0 && (
        <div className={cx('no-scrollbar flex gap-x-3.5 gap-y-1.5 overflow-x-auto lg:flex-wrap', lanes && 'lg:hidden')}>
          {lines.map((l) => (
            <span key={l.id} className="flex shrink-0 items-center gap-1.5 text-[11px] text-sub">
              <LineDot color={l.color} className="size-2.5" />
              {l.name}
            </span>
          ))}
        </div>
      )}
      {lanes ? (
        <div
          className="flex items-center gap-1.5 text-[10px] font-bold text-sub"
          aria-label="段の見方：1 段＝1 ライン。濃い塗り＝継代、点線＝培地交換、点つき＝播種、中間色＝アッセイ"
        >
          <span className="rounded-[4px] border-[1.5px] px-1.5 py-[2px] leading-none text-white" style={{ backgroundColor: SAMPLE_TONE.deep, borderColor: SAMPLE_TONE.deep }}>
            継代
          </span>
          <span className="rounded-[4px] border-[1.5px] border-dashed bg-white px-1.5 py-[2px] leading-none" style={{ color: SAMPLE_TONE.deep, borderColor: SAMPLE_TONE.deep }}>
            培地
          </span>
          <span className="flex items-center gap-[3px] rounded-[4px] border-[1.5px] px-1.5 py-[2px] leading-none" style={{ backgroundColor: SAMPLE_TONE.pale, color: SAMPLE_TONE.deep, borderColor: SAMPLE_TONE.edge }}>
            <span className="size-[5px] rounded-full" style={{ backgroundColor: SAMPLE_TONE.deep }} />
            播種
          </span>
          <span className="rounded-[4px] border-[1.5px] px-1.5 py-[2px] leading-none text-ink" style={{ backgroundColor: SAMPLE_TONE.edge, borderColor: SAMPLE_TONE.edge }}>
            アッセイ
          </span>
          <span className="ml-auto font-medium text-faint">1 段＝1 ライン</span>
        </div>
      ) : (
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
      )}
    </div>
  )
}

function Welcome({ onSample, onAdd, onLogin, canLogin }: { onSample: () => void; onAdd: () => void; onLogin: () => void; canLogin: boolean }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center pt-6 text-center">
      <h1 className="flex flex-col items-center pt-4 text-[22px] font-bold leading-tight">
        <BrandLogo height={60} className="max-w-full" />
        <span className="mt-4">へようこそ</span>
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

