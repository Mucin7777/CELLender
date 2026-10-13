import type { CSSProperties } from 'react'
import { Beaker, Check as CheckIcon, CheckCircle2, ChevronRight, Droplets, FlaskConical, GitBranch, ListTodo } from 'lucide-react'
import type { CalendarEvent, CalendarEventType, CellLine } from '../types'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { EVENT_TYPE_META } from '../lib/constants'
import { NEUTRAL_TONE, lineTone, type LineTone } from '../lib/color'
import type { BandLabelMode } from '../store/usePrefs'
import { Check, cx } from './ui'

export const EVENT_ICONS: Record<CalendarEventType, typeof Beaker> = {
  passage_plan: GitBranch,
  passage_done: CheckCircle2,
  seeding: FlaskConical,
  assay: Beaker,
  medium: Droplets,
  other: ListTodo,
}

export const isCheckable = (e: CalendarEvent) => e.type === 'assay' || e.type === 'medium' || e.type === 'other'

export function useToggleDone() {
  const { setAssayDone, updateTask } = useStore()
  return (e: CalendarEvent) => {
    if (e.type === 'assay') setAssayDone(e.refId, !e.done)
    else if (e.type === 'medium' || e.type === 'other') updateTask(e.refId, { done: !e.done })
  }
}

/** カレンダーの帯に出すラインの略称 */
export const lineShort = (line: CellLine | undefined): string =>
  !line ? '' : line.shortName?.trim() || line.name.replace(/\s+/g, '').slice(0, 4)

export const eventTone = (line: CellLine | undefined): LineTone => (line ? lineTone(line.color) : NEUTRAL_TONE)

export interface BandLook {
  label: string
  style: CSSProperties
  /** 播種の印（種の点） */
  dot: boolean
  /** 継代済みの印 */
  tick: boolean
  strike: boolean
  faded: boolean
}

/**
 * 予定の帯の見た目。色 = どのラインか、形 = 何をするか。
 *  継代: 淡い色で塗る / 播種: 淡い色＋点 / 培地交換: 白地＋細い枠 / アッセイ: 濃い色で塗る / その他: 枠のみ
 */
export function bandLook(e: CalendarEvent, line: CellLine | undefined, mode: BandLabelMode): BandLook {
  const t = eventTone(line)
  const typeLabel = EVENT_TYPE_META[e.type].short
  const byLine = mode === 'line' && line && (e.type === 'passage_plan' || e.type === 'passage_done' || e.type === 'seeding' || e.type === 'medium')
  const look: BandLook = {
    label: byLine ? lineShort(line) : typeLabel,
    style: { backgroundColor: t.pale, color: t.deep, borderColor: t.pale },
    dot: e.type === 'seeding',
    tick: e.type === 'passage_done',
    strike: e.done && isCheckable(e),
    faded: e.done,
  }
  if (e.type === 'medium') look.style = { backgroundColor: '#FFFFFF', color: t.deep, borderColor: t.edge }
  if (e.type === 'assay') {
    look.label = e.title
    look.style = { backgroundColor: t.deep, color: '#FFFFFF', borderColor: t.deep }
  }
  if (e.type === 'other') {
    look.label = e.title
    look.style = { backgroundColor: 'transparent', color: NEUTRAL_TONE.deep, borderColor: NEUTRAL_TONE.edge }
  }
  return look
}

/** 予定の種類を一文字で示すタイル。色の決まりはカレンダーの帯と同じ */
export function EventTile({ event, line, size = 40 }: { event: CalendarEvent; line: CellLine | undefined; size?: number }) {
  const t = eventTone(line)
  let style: CSSProperties = { backgroundColor: t.pale, color: t.deep, borderColor: t.pale }
  if (event.type === 'medium') style = { backgroundColor: '#FFFFFF', color: t.deep, borderColor: t.edge }
  if (event.type === 'assay') style = { backgroundColor: t.deep, color: '#FFFFFF', borderColor: t.deep }
  if (event.type === 'other') style = { backgroundColor: NEUTRAL_TONE.pale, color: NEUTRAL_TONE.deep, borderColor: NEUTRAL_TONE.pale }
  return (
    <span
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center rounded-[11px] border text-[15px] font-bold"
      style={{ ...style, width: size, height: size }}
    >
      {EVENT_TYPE_META[event.type].mono}
      {event.type === 'seeding' && <span className="absolute right-[5px] top-[5px] size-[5px] rounded-full" style={{ backgroundColor: t.deep }} />}
    </span>
  )
}

/** 予定の 1 行（日付の画面・アッセイ一覧で共通） */
export function EventRow({ event, prefix, overdue }: { event: CalendarEvent; prefix?: string; overdue?: boolean }) {
  const open = useUI((s) => s.open)
  const toggle = useToggleDone()
  const line = useStore((s) => (event.lineId ? s.lines.find((l) => l.id === event.lineId) : undefined))
  const t = eventTone(line)
  const meta = EVENT_TYPE_META[event.type]

  return (
    <div className="flex min-h-[68px] w-full items-center gap-3 py-2.5 pl-3.5 pr-2">
      <button
        type="button"
        onClick={() => open({ kind: 'event', event })}
        className="-my-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left"
        aria-label={`${event.title} ${meta.label}の詳細`}
      >
        <EventTile event={event} line={line} />
        <span className={cx('min-w-0 flex-1', event.done && 'opacity-50')}>
          <span className="flex items-center gap-1 text-[12px] font-bold" style={{ color: overdue ? undefined : t.deep }}>
            {prefix && <span className={cx(overdue && 'text-danger')}>{prefix} ·</span>}
            <span className={cx(overdue && 'text-danger')}>{meta.label}</span>
            {event.time && <span className="font-num font-semibold">· {event.time}</span>}
          </span>
          <span className={cx('mt-0.5 block truncate text-[15px] font-bold', event.done && isCheckable(event) && 'line-through')}>{event.title}</span>
          {event.subtitle && <span className="mt-0.5 block truncate text-[12.5px] text-sub">{event.subtitle}</span>}
        </span>
      </button>
      <RowAction event={event} onToggle={() => toggle(event)} onPassage={() => open({ kind: 'passage', lineId: event.refId })} />
    </div>
  )
}

function RowAction({ event, onToggle, onPassage }: { event: CalendarEvent; onToggle: () => void; onPassage: () => void }) {
  if (isCheckable(event)) return <Check checked={event.done} onChange={onToggle} label={`${event.title}を${event.done ? '未完了に戻す' : '完了にする'}`} />
  if (event.type === 'passage_plan')
    return (
      <button
        type="button"
        onClick={onPassage}
        aria-label={`${event.title}の継代を記録する`}
        title="継代を記録"
        className="group -m-2.5 flex size-11 shrink-0 items-center justify-center"
      >
        <span className="flex size-6 items-center justify-center rounded-full border-2 border-gray-sage bg-white text-teal transition group-hover:border-teal group-hover:bg-mint-soft">
          <CheckIcon className="size-3.5 opacity-0 transition group-hover:opacity-100" strokeWidth={3} />
        </span>
      </button>
    )
  if (event.type === 'passage_done')
    return (
      <span className="-m-2.5 flex size-11 shrink-0 items-center justify-center" aria-label="継代済み" role="img">
        <span className="flex size-6 items-center justify-center rounded-full bg-teal text-white">
          <CheckIcon className="size-3.5" strokeWidth={3} />
        </span>
      </span>
    )
  return <ChevronRight className="mx-1 size-4 shrink-0 text-faint" aria-hidden="true" />
}
