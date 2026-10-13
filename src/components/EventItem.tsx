import { ArrowRight, Beaker, Droplets, FlaskConical, GitBranch, ListTodo, CheckCircle2 } from 'lucide-react'
import type { CalendarEvent, CalendarEventType } from '../types'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { EVENT_TYPE_META } from '../lib/constants'
import { Checkbox, cx } from './ui'

export const EVENT_ICONS: Record<CalendarEventType, typeof Beaker> = {
  passage_plan: GitBranch,
  passage_done: CheckCircle2,
  seeding: FlaskConical,
  assay: Beaker,
  medium: Droplets,
  other: ListTodo,
}

export function useLineColor(lineId: string | null): string | undefined {
  return useStore((s) => (lineId ? s.lines.find((l) => l.id === lineId)?.color : undefined))
}

/** イベントの完了トグル（対応するものだけ） */
export function useToggleDone() {
  const { setAssayDone, updateTask } = useStore()
  const open = useUI((s) => s.open)
  return (e: CalendarEvent) => {
    switch (e.type) {
      case 'assay':
        return setAssayDone(e.refId, !e.done)
      case 'medium':
      case 'other':
        return updateTask(e.refId, { done: !e.done })
      case 'passage_plan':
        return open({ kind: 'passage', lineId: e.refId })
    }
  }
}

/** リスト表示用のイベント行（今日・アッセイ画面などで使用） */
export function EventRow({ event, showDate, overdue }: { event: CalendarEvent; showDate?: string; overdue?: boolean }) {
  const open = useUI((s) => s.open)
  const toggle = useToggleDone()
  const lineColor = useLineColor(event.lineId)
  const meta = EVENT_TYPE_META[event.type]
  const Icon = EVENT_ICONS[event.type]
  const checkable = event.type === 'assay' || event.type === 'medium' || event.type === 'other'

  return (
    <div
      className={cx(
        'group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50',
        event.done && 'opacity-60',
      )}
      onClick={() => open({ kind: 'event', event })}
    >
      {checkable ? (
        <Checkbox checked={event.done} onChange={() => toggle(event)} color={meta.color} label="完了" />
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md" style={{ color: meta.color }}>
          <Icon className="size-4.5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 rounded px-1.5 py-px text-[10px] font-semibold text-white" style={{ backgroundColor: meta.color }}>
            {meta.short}
          </span>
          <span className={cx('truncate text-sm font-medium text-slate-800', event.done && checkable && 'line-through')}>{event.title}</span>
        </div>
        {(event.subtitle || showDate) && (
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
            {lineColor && <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: lineColor }} />}
            {showDate && <span className={cx('shrink-0', overdue && 'font-medium text-rose-600')}>{showDate}</span>}
            {event.subtitle && <span className="truncate">{event.subtitle}</span>}
          </div>
        )}
      </div>
      {event.type === 'passage_plan' && (
        <button
          className="btn-secondary btn-sm shrink-0 opacity-90 group-hover:border-brand-200 group-hover:text-brand-700"
          onClick={(e) => {
            e.stopPropagation()
            open({ kind: 'passage', lineId: event.refId })
          }}
        >
          継代する
          <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}
