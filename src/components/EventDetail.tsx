import { useStore } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { EVENT_TYPE_META, SEEDING_STATUS_META } from '../lib/constants'
import { cultureDay, fmt, relativeLabel } from '../lib/date'
import { navigate } from '../lib/router'
import type { CalendarEvent } from '../types'
import { EVENT_ICONS } from './Agenda'
import { LineDot, List, Row, Sheet } from './ui'

export function EventDetail({ event: ev }: { event: CalendarEvent }) {
  const { close, closeAll, open, toast } = useUI()
  const st = useStore()
  const line = ev.lineId ? st.lines.find((l) => l.id === ev.lineId) : undefined
  const seeding = ev.seedingId ? st.seedings.find((s) => s.id === ev.seedingId) : undefined
  const assay = ev.type === 'assay' ? st.assays.find((a) => a.id === ev.refId) : undefined
  const task = ev.type === 'medium' || ev.type === 'other' ? st.tasks.find((t) => t.id === ev.refId) : undefined
  const passage = ev.type === 'passage_done' ? st.passages.find((p) => p.id === ev.refId) : undefined

  // ストアの最新状態を反映
  const date =
    ev.type === 'passage_plan' ? (line?.nextPassageDate ?? ev.date) : (assay?.date ?? task?.date ?? passage?.date ?? (ev.type === 'seeding' ? seeding?.date : undefined) ?? ev.date)
  const done = assay?.done ?? task?.done ?? ev.done
  const Icon = EVENT_ICONS[ev.type]
  const title = assay?.name ?? task?.title ?? (ev.type === 'seeding' ? `${line?.name ?? ''} を播種` : line?.name) ?? ev.title
  const notes = assay?.notes || task?.notes || passage?.notes || (ev.type === 'seeding' ? seeding?.notes : '')

  const go = (to: Parameters<typeof navigate>[0]) => {
    closeAll()
    navigate(to)
  }

  const primary = (() => {
    if (ev.type === 'passage_plan' && line)
      return (
        <button className="btn-primary flex-1" onClick={() => { close(); open({ kind: 'passage', lineId: line.id }) }}>
          継代を記録する
        </button>
      )
    if (assay)
      return (
        <button className={assay.done ? 'btn-secondary flex-1' : 'btn-primary flex-1'} onClick={() => st.setAssayDone(assay.id, !assay.done)}>
          {assay.done ? '未実施に戻す' : '実施済みにする'}
        </button>
      )
    if (task)
      return (
        <button className={task.done ? 'btn-secondary flex-1' : 'btn-primary flex-1'} onClick={() => st.updateTask(task.id, { done: !task.done })}>
          {task.done ? '未完了に戻す' : '完了にする'}
        </button>
      )
    if (ev.type === 'seeding' && seeding)
      return (
        <button className="btn-primary flex-1" onClick={() => go({ view: 'seedings', id: seeding.id })}>
          播種記録を開く
        </button>
      )
    if (passage && line)
      return (
        <button className="btn-secondary flex-1" onClick={() => go({ view: 'lines', id: line.id })}>
          ラインを開く
        </button>
      )
    return null
  })()

  const onEdit = assay
    ? () => open({ kind: 'assay', id: assay.id })
    : task
      ? () => open({ kind: 'task', id: task.id })
      : ev.type === 'seeding' && seeding
        ? () => open({ kind: 'seeding', id: seeding.id })
        : undefined

  const onDelete = assay || task || passage
    ? () =>
        confirmDialog({
          title: passage ? '継代記録を取り消しますか？' : '削除しますか？',
          message: passage ? '最新の継代なら、ラインのP数と予定日も元に戻ります。' : `「${title}」を削除します。`,
          confirmLabel: passage ? '取り消す' : '削除',
          danger: true,
          onConfirm: () => {
            if (assay) st.deleteAssay(assay.id)
            if (task) st.deleteTask(task.id)
            if (passage) st.deletePassage(passage.id)
            closeAll()
            toast(passage ? '継代記録を取り消しました' : '削除しました')
          },
        })
    : undefined

  return (
    <Sheet
      onClose={close}
      headerRight={onEdit && <button className="btn-ghost btn-sm" onClick={onEdit}>編集</button>}
      footer={primary}
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-sub">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-sub">{EVENT_TYPE_META[ev.type].label}{done && ' · 完了'}</div>
          <div className="text-[22px] font-bold leading-snug">{title}</div>
          <div className="mt-0.5 text-[14px] text-sub">
            {fmt(date, 'M月d日 (E)')}
            {assay?.time && ` ${assay.time}`}・{relativeLabel(date)}
          </div>
        </div>
      </div>

      <List className="bg-canvas">
        {ev.movable && (
          <label className="flex min-h-14 items-center gap-3 px-4">
            <span className="flex-1 text-[15px] font-semibold">日付を変更</span>
            <input
              type="date"
              className="rounded-lg bg-white px-2 py-1.5 text-[15px] outline-none focus:ring-2 focus:ring-brand-500"
              value={date}
              onChange={(e) => e.target.value && st.moveEvent({ ...ev, date }, e.target.value)}
            />
          </label>
        )}
        {ev.type === 'passage_plan' && line && (
          <Row title="継代数" right={<span className="font-mono text-[15px]">P{line.passageNumber} → P{line.passageNumber + 1}</span>} />
        )}
        {passage && <Row title="継代後" right={<span className="font-mono text-[15px]">P{passage.passageNumber}{passage.splitRatio && ` (${passage.splitRatio})`}</span>} />}
        {line && (
          <Row
            onClick={() => go({ view: 'lines', id: line.id })}
            left={<LineDot color={line.color} className="size-3" />}
            title={line.name}
            sub={`細胞ライン · 現在 P${line.passageNumber}`}
            chevron
          />
        )}
        {seeding && ev.type !== 'seeding' && (
          <Row
            onClick={() => go({ view: 'seedings', id: seeding.id })}
            title={`${fmt(seeding.date, 'M/d')} 播種 · ${seeding.plateType}`}
            sub={`${cultureDay(seeding.date, date)}日目 · ${SEEDING_STATUS_META[seeding.status].label}${seeding.purpose ? ` · ${seeding.purpose}` : ''}`}
            chevron
          />
        )}
      </List>

      {(notes || assay?.result) && (
        <div className="mt-4 space-y-3 rounded-2xl bg-canvas px-4 py-3 text-[14px]">
          {notes && (
            <div>
              <div className="text-[12px] font-medium text-sub">メモ</div>
              <p className="whitespace-pre-wrap">{notes}</p>
            </div>
          )}
          {assay?.result && (
            <div>
              <div className="text-[12px] font-medium text-sub">結果</div>
              <p className="whitespace-pre-wrap">{assay.result}</p>
            </div>
          )}
        </div>
      )}

      {onDelete && (
        <button className="mt-4 min-h-11 w-full text-[15px] font-semibold text-rose-600" onClick={onDelete}>
          {passage ? 'この継代記録を取り消す' : '削除'}
        </button>
      )}
    </Sheet>
  )
}
