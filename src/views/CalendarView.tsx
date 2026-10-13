import { useMemo, useState, type DragEvent } from 'react'
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Filter, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { usePrefs, type CalendarMode } from '../store/usePrefs'
import { useCalendarEvents } from '../lib/useCalendarEvents'
import { groupByDate } from '../lib/events'
import { EVENT_TYPE_META } from '../lib/constants'
import { fmt, relativeLabel, toDateStr, todayStr } from '../lib/date'
import type { CalendarEvent, CalendarEventType, DateStr } from '../types'
import { EVENT_ICONS, EventRow } from '../components/EventItem'
import { LineDot, Segmented, cx } from '../components/ui'

const DRAG_MIME = 'application/x-cellendar-event'

export function CalendarView() {
  const prefs = usePrefs()
  const lines = useStore((s) => s.lines)
  const { open, toast } = useUI()
  const moveEvent = useStore((s) => s.moveEvent)
  const allEvents = useCalendarEvents()
  const today = todayStr()
  const [cursor, setCursor] = useState(() => new Date())
  const [selected, setSelected] = useState<DateStr>(today)
  const [showFilters, setShowFilters] = useState(false)
  const [dragOver, setDragOver] = useState<DateStr | null>(null)

  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])
  const events = useMemo(
    () =>
      allEvents.filter(
        (e) =>
          !prefs.hiddenTypes.includes(e.type) &&
          !(e.lineId && prefs.hiddenLines.includes(e.lineId)) &&
          (prefs.showDone || !e.done),
      ),
    [allEvents, prefs.hiddenTypes, prefs.hiddenLines, prefs.showDone],
  )
  const byDate = useMemo(() => groupByDate(events), [events])

  const mode = prefs.calendarMode
  const wso = prefs.weekStartsOn
  const days = useMemo(() => {
    if (mode === 'month') {
      return eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: wso }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: wso }) })
    }
    if (mode === 'week') {
      return eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: wso }), end: endOfWeek(cursor, { weekStartsOn: wso }) })
    }
    return eachDayOfInterval({ start: cursor, end: addDays(cursor, 34) })
  }, [mode, cursor, wso])

  const step = (dir: 1 | -1) => {
    setCursor((c) => (mode === 'month' ? addMonths(c, dir) : mode === 'week' ? addWeeks(c, dir) : addDays(c, dir * 35)))
  }
  const goToday = () => {
    setCursor(new Date())
    setSelected(today)
  }

  const title =
    mode === 'month'
      ? format(cursor, 'yyyy年 M月', { locale: ja })
      : mode === 'week'
        ? `${format(days[0], 'yyyy年 M/d', { locale: ja })} – ${format(days[6], 'M/d', { locale: ja })}`
        : `${format(days[0], 'yyyy/M/d')} 〜`

  const eventColor = (e: CalendarEvent) =>
    prefs.colorMode === 'line' && e.lineId ? (lineById.get(e.lineId)?.color ?? EVENT_TYPE_META[e.type].color) : EVENT_TYPE_META[e.type].color

  // --- drag & drop ---
  const onDragStart = (ev: DragEvent, e: CalendarEvent) => {
    ev.dataTransfer.setData(DRAG_MIME, e.key)
    ev.dataTransfer.effectAllowed = 'move'
  }
  const onDrop = (ev: DragEvent, date: DateStr) => {
    ev.preventDefault()
    setDragOver(null)
    const key = ev.dataTransfer.getData(DRAG_MIME)
    const e = allEvents.find((x) => x.key === key)
    if (!e || !e.movable || e.date === date) return
    moveEvent(e, date)
    toast(`「${e.title}」を ${fmt(date)} に移動しました`, { label: '元に戻す', onClick: () => moveEvent({ ...e, date }, e.date) })
  }
  const dropProps = (date: DateStr) => ({
    onDragOver: (ev: DragEvent) => {
      if (!ev.dataTransfer.types.includes(DRAG_MIME)) return
      ev.preventDefault()
      if (dragOver !== date) setDragOver(date)
    },
    onDragLeave: () => setDragOver((d) => (d === date ? null : d)),
    onDrop: (ev: DragEvent) => onDrop(ev, date),
  })

  const Chip = ({ e, compact }: { e: CalendarEvent; compact?: boolean }) => {
    const color = eventColor(e)
    const Icon = EVENT_ICONS[e.type]
    const lineColor = e.lineId ? lineById.get(e.lineId)?.color : undefined
    const strike = e.done && (e.type === 'assay' || e.type === 'medium' || e.type === 'other')
    return (
      <button
        draggable={e.movable}
        onDragStart={(ev) => onDragStart(ev, e)}
        onClick={(ev) => {
          ev.stopPropagation()
          open({ kind: 'event', event: e })
        }}
        title={`${EVENT_TYPE_META[e.type].label}: ${e.title}${e.subtitle ? ` (${e.subtitle})` : ''}`}
        className={cx(
          'flex w-full min-w-0 flex-col rounded-md px-1.5 text-left text-[11px] leading-tight transition hover:brightness-95',
          compact ? 'py-0.5' : 'py-1',
          e.done && 'opacity-60',
          e.movable && 'cursor-grab active:cursor-grabbing',
        )}
        style={{
          backgroundColor: e.done ? '#f1f5f9' : `${color}1f`,
          color: e.done ? '#64748b' : color,
          boxShadow: `inset 2px 0 0 ${color}`,
        }}
      >
        <span className="flex w-full min-w-0 items-center gap-1">
          <Icon className="size-3 shrink-0" />
          {prefs.colorMode === 'type' && lineColor && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: lineColor }} />}
          <span className={cx('truncate font-medium', e.done ? 'text-slate-500' : 'text-slate-800', strike && 'line-through')}>{e.title}</span>
        </span>
        {!compact && e.subtitle && <span className="w-full truncate pl-4 text-[10px] text-slate-500">{e.subtitle}</span>}
      </button>
    )
  }

  const selectedEvents = byDate.get(selected) ?? []
  const weekdayHeaders = days.slice(0, 7).map((d) => d.getDay())

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 xl:flex-row">
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <div className="flex items-center">
            <button className="icon-btn" onClick={() => step(-1)} aria-label="前へ">
              <ChevronLeft className="size-5" />
            </button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="次へ">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <h2 className="min-w-0 text-base font-bold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
          <button className="btn-secondary btn-sm" onClick={goToday}>
            今日
          </button>
          <div className="ml-auto flex items-center gap-2">
            <Segmented<CalendarMode>
              size="sm"
              value={mode}
              onChange={(m) => prefs.set({ calendarMode: m })}
              options={[
                { value: 'month', label: '月' },
                { value: 'week', label: '週' },
                { value: 'list', label: 'リスト' },
              ]}
            />
            <button className={cx('icon-btn', showFilters && 'bg-slate-100 text-slate-800')} onClick={() => setShowFilters((v) => !v)} aria-label="フィルター">
              <Filter className="size-4" />
            </button>
            <button className="btn-primary btn-sm hidden sm:inline-flex" onClick={() => open({ kind: 'quickAdd', date: selected })}>
              <Plus className="size-4" />
              追加
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="animate-fade-in space-y-2.5 border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 w-14 shrink-0 font-semibold text-slate-500">種類</span>
              {(Object.keys(EVENT_TYPE_META) as CalendarEventType[]).map((t) => {
                const on = !prefs.hiddenTypes.includes(t)
                return (
                  <button
                    key={t}
                    onClick={() => prefs.toggleType(t)}
                    className={cx('flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition', on ? 'border-slate-200 bg-white text-slate-700' : 'border-transparent bg-transparent text-slate-400 line-through')}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: on ? EVENT_TYPE_META[t].color : '#cbd5e1' }} />
                    {EVENT_TYPE_META[t].label}
                  </button>
                )
              })}
            </div>
            {lines.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-14 shrink-0 font-semibold text-slate-500">ライン</span>
                {lines.filter((l) => !l.archived).map((l) => {
                  const on = !prefs.hiddenLines.includes(l.id)
                  return (
                    <button
                      key={l.id}
                      onClick={() => prefs.toggleLine(l.id)}
                      className={cx('flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition', on ? 'border-slate-200 bg-white text-slate-700' : 'border-transparent text-slate-400 line-through')}
                    >
                      <LineDot color={on ? l.color : '#cbd5e1'} className="size-2" />
                      {l.name}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="w-14 shrink-0 font-semibold text-slate-500">表示</span>
              <div className="flex items-center gap-2">
                色分け
                <Segmented size="sm" value={prefs.colorMode} onChange={(v) => prefs.set({ colorMode: v })} options={[{ value: 'type', label: '種類' }, { value: 'line', label: 'ライン' }]} />
              </div>
              <div className="flex items-center gap-2">
                週の始まり
                <Segmented size="sm" value={String(prefs.weekStartsOn) as '0' | '1'} onChange={(v) => prefs.set({ weekStartsOn: v === '1' ? 1 : 0 })} options={[{ value: '0', label: '日' }, { value: '1', label: '月' }]} />
              </div>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" className="accent-brand-600" checked={prefs.showDone} onChange={(e) => prefs.set({ showDone: e.target.checked })} />
                完了済みを表示
              </label>
            </div>
          </div>
        )}

        {/* body */}
        {mode !== 'list' && (
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 text-center text-[11px] font-semibold text-slate-500">
            {weekdayHeaders.map((wd) => (
              <div key={wd} className={cx('py-1.5', wd === 0 && 'text-rose-500', wd === 6 && 'text-sky-600')}>
                {['日', '月', '火', '水', '木', '金', '土'][wd]}
              </div>
            ))}
          </div>
        )}

        {mode === 'month' && (
          <div className="grid flex-1 auto-rows-fr grid-cols-7" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
            {days.map((d) => {
              const ds = toDateStr(d)
              const evs = byDate.get(ds) ?? []
              const inMonth = isSameMonth(d, cursor)
              const isToday = ds === today
              const isSel = ds === selected
              const max = 3
              return (
                <div
                  key={ds}
                  {...dropProps(ds)}
                  onClick={() => setSelected(ds)}
                  onDoubleClick={() => open({ kind: 'quickAdd', date: ds })}
                  className={cx(
                    'group relative flex min-h-[64px] min-w-0 cursor-pointer flex-col gap-0.5 border-b border-r border-slate-100 p-1 transition sm:min-h-[104px] sm:p-1.5',
                    !inMonth && 'bg-slate-50/70',
                    isSel && 'bg-brand-50/60',
                    dragOver === ds && 'bg-brand-100/70 ring-2 ring-inset ring-brand-400',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cx(
                        'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                        isToday ? 'bg-brand-600 text-white' : !inMonth ? 'text-slate-300' : d.getDay() === 0 ? 'text-rose-500' : d.getDay() === 6 ? 'text-sky-600' : 'text-slate-700',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <button
                      className="icon-btn hidden size-6 opacity-0 transition group-hover:opacity-100 sm:inline-flex"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        open({ kind: 'quickAdd', date: ds })
                      }}
                      aria-label="追加"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  {/* desktop: chips */}
                  <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {evs.slice(0, max).map((e) => (
                      <Chip key={e.key} e={e} compact />
                    ))}
                    {evs.length > max && (
                      <button
                        className="rounded px-1.5 text-left text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setSelected(ds)
                          prefs.set({ calendarMode: 'week' })
                          setCursor(d)
                        }}
                      >
                        他 {evs.length - max} 件
                      </button>
                    )}
                  </div>
                  {/* mobile: dots */}
                  <div className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                    {evs.slice(0, 6).map((e) => (
                      <span key={e.key} className={cx('size-1.5 rounded-full', e.done && 'opacity-40')} style={{ backgroundColor: eventColor(e) }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {mode === 'week' && (
          <div className="grid min-h-[420px] flex-1 grid-cols-7">
            {days.map((d) => {
              const ds = toDateStr(d)
              const evs = byDate.get(ds) ?? []
              const isToday = ds === today
              return (
                <div
                  key={ds}
                  {...dropProps(ds)}
                  onClick={() => setSelected(ds)}
                  onDoubleClick={() => open({ kind: 'quickAdd', date: ds })}
                  className={cx(
                    'group flex min-w-0 cursor-pointer flex-col gap-1 border-r border-slate-100 p-1 sm:p-1.5',
                    ds === selected && 'bg-brand-50/60',
                    dragOver === ds && 'bg-brand-100/70 ring-2 ring-inset ring-brand-400',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cx('flex size-7 items-center justify-center rounded-full text-sm font-bold', isToday ? 'bg-brand-600 text-white' : 'text-slate-700')}>{d.getDate()}</span>
                    <button
                      className="icon-btn hidden size-6 opacity-0 transition group-hover:opacity-100 sm:inline-flex"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        open({ kind: 'quickAdd', date: ds })
                      }}
                      aria-label="追加"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <div className="hidden flex-col gap-1 sm:flex">
                    {evs.map((e) => (
                      <Chip key={e.key} e={e} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {evs.map((e) => (
                      <span key={e.key} className={cx('size-2 rounded-full', e.done && 'opacity-40')} style={{ backgroundColor: eventColor(e) }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {mode === 'list' && (
          <div className="scrollbar-thin flex-1 divide-y divide-slate-100 overflow-y-auto">
            {days.filter((d) => byDate.has(toDateStr(d))).length === 0 && (
              <p className="p-8 text-center text-sm text-slate-400">この期間の予定はありません</p>
            )}
            {days.map((d) => {
              const ds = toDateStr(d)
              const evs = byDate.get(ds)
              if (!evs) return null
              return (
                <div key={ds} className="flex flex-col gap-1 px-2 py-2 sm:flex-row sm:gap-4 sm:px-4">
                  <div className="flex shrink-0 items-baseline gap-2 px-1 pt-2 sm:w-28 sm:flex-col sm:gap-0">
                    <span className={cx('text-sm font-bold', ds === today ? 'text-brand-700' : d.getDay() === 0 ? 'text-rose-500' : d.getDay() === 6 ? 'text-sky-600' : 'text-slate-800')}>{fmt(ds, 'M/d (E)')}</span>
                    <span className="text-xs text-slate-400">{relativeLabel(ds)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {evs.map((e) => (
                      <EventRow key={e.key} event={e} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* selected-day panel */}
      {mode !== 'list' && (
        <aside className="card flex shrink-0 flex-col xl:w-80">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">{fmt(selected, 'M月d日 (E)')}</div>
              <div className="text-xs text-slate-400">
                {relativeLabel(selected)} · {selectedEvents.length} 件
              </div>
            </div>
            <button className="btn-primary btn-sm" onClick={() => open({ kind: 'quickAdd', date: selected })}>
              <Plus className="size-4" />
              追加
            </button>
          </div>
          <div className="scrollbar-thin p-1.5 xl:flex-1 xl:overflow-y-auto">
            {selectedEvents.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">予定はありません</p>
            ) : (
              selectedEvents.map((e) => <EventRow key={e.key} event={e} />)
            )}
          </div>
          <div className="hidden border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400 xl:block">
            ヒント: 予定はドラッグで日付を移動できます。日付をダブルクリックで追加。
          </div>
        </aside>
      )}
    </div>
  )
}

