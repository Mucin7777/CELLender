import { Beaker, CheckCircle2, Droplets, FlaskConical, GitBranch, ListTodo } from 'lucide-react'
import type { CalendarEvent, CalendarEventType } from '../types'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { EVENT_TYPE_META } from '../lib/constants'
import { Check, ColorBar, cx } from './ui'

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

/** アジェンダの1行。色はラインの識別にだけ使う */
export function AgendaRow({ event, prefix, overdue }: { event: CalendarEvent; prefix?: string; overdue?: boolean }) {
  const open = useUI((s) => s.open)
  const toggle = useToggleDone()
  const lineColor = useStore((s) => (event.lineId ? s.lines.find((l) => l.id === event.lineId)?.color : undefined))
  const Icon = EVENT_ICONS[event.type]
  const label = EVENT_TYPE_META[event.type].label

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => open({ kind: 'event', event })}
      className="flex min-h-16 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition active:bg-black/[.03]"
    >
      <ColorBar color={lineColor} />
      <div className={cx('min-w-0 flex-1', event.done && 'opacity-45')}>
        <div className={cx('truncate text-[15px] font-semibold', event.done && isCheckable(event) && 'line-through')}>{event.title}</div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-sub">
          <Icon className="size-3.5 shrink-0" />
          {prefix && <span className={cx('shrink-0', overdue && 'font-semibold text-rose-600')}>{prefix} ·</span>}
          <span className="shrink-0">{label}</span>
          {event.subtitle && <span className="truncate">· {event.subtitle}</span>}
        </div>
      </div>
      {event.type === 'passage_plan' ? (
        <button
          className="btn-sm btn shrink-0 bg-brand-50 text-brand-700 hover:bg-brand-100"
          onClick={(e) => {
            e.stopPropagation()
            open({ kind: 'passage', lineId: event.refId })
          }}
        >
          継代する
        </button>
      ) : isCheckable(event) ? (
        <Check checked={event.done} onChange={() => toggle(event)} />
      ) : null}
    </div>
  )
}
