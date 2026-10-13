import { CalendarDays, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { EVENT_TYPE_META } from '../lib/constants'
import { cultureDay, fmt, relativeLabel } from '../lib/date'
import { navigate } from '../lib/router'
import type { CalendarEvent } from '../types'
import { EVENT_ICONS } from './EventItem'
import { LineDot, Modal, StatusBadge } from './ui'

export function EventDetail({ event: initial }: { event: CalendarEvent }) {
  const { close, closeAll, open, toast } = useUI()
  const st = useStore()
  const line = initial.lineId ? st.lines.find((l) => l.id === initial.lineId) : undefined
  const seeding = initial.seedingId ? st.seedings.find((s) => s.id === initial.seedingId) : undefined
  const assay = initial.type === 'assay' ? st.assays.find((a) => a.id === initial.refId) : undefined
  const task = initial.type === 'medium' || initial.type === 'other' ? st.tasks.find((t) => t.id === initial.refId) : undefined
  const passage = initial.type === 'passage_done' ? st.passages.find((p) => p.id === initial.refId) : undefined

  // 最新状態を反映
  const date = initial.type === 'passage_plan' ? (line?.nextPassageDate ?? initial.date) : (assay?.date ?? task?.date ?? seeding?.date ?? passage?.date ?? initial.date)
  const done = assay?.done ?? task?.done ?? initial.done
  const meta = EVENT_TYPE_META[initial.type]
  const Icon = EVENT_ICONS[initial.type]

  const goLine = () => {
    closeAll()
    if (line) navigate({ view: 'lines', id: line.id })
  }
  const goSeeding = () => {
    closeAll()
    if (seeding) navigate({ view: 'seedings', id: seeding.id })
  }

  const notes = assay?.notes || task?.notes || passage?.notes || (initial.type === 'seeding' ? seeding?.notes : '')

  return (
    <Modal
      size="sm"
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg text-white" style={{ backgroundColor: meta.color }}>
            <Icon className="size-4" />
          </span>
          {meta.label}
        </span>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {(assay || task) && (
            <button
              className="btn-ghost text-rose-600 hover:bg-rose-50"
              onClick={() =>
                confirmDialog({
                  title: '削除しますか？',
                  message: `「${assay?.name ?? task?.title}」を削除します。`,
                  confirmLabel: '削除',
                  danger: true,
                  onConfirm: () => {
                    if (assay) st.deleteAssay(assay.id)
                    if (task) st.deleteTask(task.id)
                    closeAll()
                    toast('削除しました')
                  },
                })
              }
            >
              <Trash2 className="size-4" />
            </button>
          )}
          {passage && (
            <button
              className="btn-ghost text-rose-600 hover:bg-rose-50"
              onClick={() =>
                confirmDialog({
                  title: '継代記録を取り消し',
                  message: '最新の継代記録の場合、ラインの継代数と予定日も元に戻ります。',
                  confirmLabel: '取り消す',
                  danger: true,
                  onConfirm: () => {
                    st.deletePassage(passage.id)
                    closeAll()
                    toast('継代記録を取り消しました')
                  },
                })
              }
            >
              <Trash2 className="size-4" />
              取り消し
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {assay && (
              <button className="btn-secondary" onClick={() => open({ kind: 'assay', id: assay.id })}>
                <Pencil className="size-4" />
                編集
              </button>
            )}
            {task && (
              <button className="btn-secondary" onClick={() => open({ kind: 'task', id: task.id })}>
                <Pencil className="size-4" />
                編集
              </button>
            )}
            {initial.type === 'seeding' && seeding && (
              <button className="btn-secondary" onClick={() => open({ kind: 'seeding', id: seeding.id })}>
                <Pencil className="size-4" />
                編集
              </button>
            )}
            {assay && (
              <button className="btn-primary" onClick={() => st.setAssayDone(assay.id, !assay.done)}>
                {assay.done ? '未完了に戻す' : '実施済みにする'}
              </button>
            )}
            {task && (
              <button className="btn-primary" onClick={() => st.updateTask(task.id, { done: !task.done })}>
                {task.done ? '未完了に戻す' : '完了にする'}
              </button>
            )}
            {initial.type === 'passage_plan' && line && (
              <button
                className="btn-primary"
                onClick={() => {
                  close()
                  open({ kind: 'passage', lineId: line.id })
                }}
              >
                継代を記録
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="text-lg font-bold text-slate-900">{assay?.name ?? task?.title ?? line?.name ?? initial.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-4" />
              {fmt(date, 'yyyy/M/d (E)')}
              {assay?.time && ` ${assay.time}`}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{relativeLabel(date)}</span>
            {done && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">完了</span>}
          </div>
        </div>

        {initial.type === 'passage_plan' && line && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="現在" value={`P${line.passageNumber}`} />
            <Stat label="前回継代" value={line.lastPassageDate ? fmt(line.lastPassageDate, 'M/d') : '—'} />
            <Stat label="間隔" value={line.passageIntervalDays ? `${line.passageIntervalDays}日` : '—'} />
          </div>
        )}
        {initial.type === 'passage_plan' && line && (
          <label className="block">
            <span className="label">予定日を変更</span>
            <input className="input" type="date" value={line.nextPassageDate ?? ''} onChange={(e) => st.updateLine(line.id, { nextPassageDate: e.target.value || null })} />
          </label>
        )}
        {passage && (
          <div className="grid grid-cols-2 gap-2 text-center">
            <Stat label="継代後" value={`P${passage.passageNumber}`} />
            <Stat label="分割比" value={passage.splitRatio || '—'} />
          </div>
        )}

        {line && (
          <button onClick={goLine} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40">
            <LineDot color={line.color} className="size-3" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400">細胞ライン</div>
              <div className="truncate text-sm font-medium text-slate-800">{line.name}</div>
            </div>
            <span className="font-mono text-xs text-slate-500">P{line.passageNumber}</span>
            <ExternalLink className="size-4 text-slate-400" />
          </button>
        )}
        {seeding && (
          <button onClick={goSeeding} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-400">播種記録 · {fmt(seeding.date, 'M/d')} 播種 · Day {cultureDay(seeding.date, date)}</div>
              <div className="truncate text-sm font-medium text-slate-800">
                {seeding.plateType}
                {seeding.purpose && <span className="font-normal text-slate-500"> — {seeding.purpose}</span>}
              </div>
            </div>
            <StatusBadge status={seeding.status} />
            <ExternalLink className="size-4 shrink-0 text-slate-400" />
          </button>
        )}

        {notes && (
          <div>
            <div className="label">メモ</div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{notes}</p>
          </div>
        )}
        {assay?.result && (
          <div>
            <div className="label">結果</div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{assay.result}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  )
}
