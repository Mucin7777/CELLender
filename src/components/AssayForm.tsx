import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { ASSAY_PRESETS } from '../lib/constants'
import { cultureDay, fmt, todayStr } from '../lib/date'
import { Field, Modal } from './ui'

export function AssayForm({ id, seedingId, date }: { id?: string; seedingId?: string; date?: string }) {
  const { close, toast } = useUI()
  const existing = useStore((s) => s.assays.find((a) => a.id === id))
  const seedings = useStore((s) => s.seedings)
  const lines = useStore((s) => s.lines)
  const { addAssay, updateAssay, deleteAssay } = useStore()
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])

  const options = useMemo(
    () =>
      seedings
        .filter((s) => s.status !== 'discarded' && (s.status !== 'completed' || s.id === (existing?.seedingId ?? seedingId)))
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [seedings, existing, seedingId],
  )

  const [form, setForm] = useState({
    seedingId: existing?.seedingId ?? seedingId ?? options[0]?.id ?? '',
    date: existing?.date ?? date ?? todayStr(),
    time: existing?.time ?? '',
    name: existing?.name ?? '',
    notes: existing?.notes ?? '',
    done: existing?.done ?? false,
    result: existing?.result ?? '',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const seeding = seedings.find((s) => s.id === form.seedingId)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.seedingId || !form.name.trim()) return
    if (existing) {
      updateAssay(existing.id, {
        seedingId: form.seedingId,
        date: form.date,
        time: form.time,
        name: form.name.trim(),
        notes: form.notes,
        result: form.result,
        done: form.done,
        doneAt: form.done ? (existing.doneAt ?? new Date().toISOString()) : null,
      })
      toast('アッセイを更新しました')
    } else {
      addAssay({ seedingId: form.seedingId, date: form.date, time: form.time, name: form.name.trim(), notes: form.notes })
      toast('アッセイ予定を追加しました')
    }
    close()
  }

  const onDelete = () => {
    if (!existing) return
    confirmDialog({
      title: 'アッセイを削除',
      message: `「${existing.name}」を削除します。`,
      confirmLabel: '削除する',
      danger: true,
      onConfirm: () => {
        deleteAssay(existing.id)
        useUI.getState().closeAll()
        toast('アッセイを削除しました')
      },
    })
  }

  if (options.length === 0 && !existing) {
    return (
      <Modal title="アッセイを予定" onClose={close} size="sm">
        <p className="text-sm text-slate-600">アッセイは播種記録に紐づけて登録します。先に播種を記録してください。</p>
        <button className="btn-primary mt-4" onClick={() => { close(); useUI.getState().open({ kind: 'seeding', date: form.date }) }}>
          播種を記録
        </button>
      </Modal>
    )
  }

  return (
    <Modal
      title={existing ? 'アッセイを編集' : 'アッセイを予定'}
      onClose={close}
      footer={
        <>
          {existing && (
            <button type="button" className="btn-ghost mr-auto text-rose-600 hover:bg-rose-50" onClick={onDelete}>
              <Trash2 className="size-4" />
              削除
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={close}>
            キャンセル
          </button>
          <button type="submit" form="assay-form" className="btn-primary" disabled={!form.seedingId || !form.name.trim()}>
            {existing ? '保存' : '追加'}
          </button>
        </>
      }
    >
      <form id="assay-form" onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-4">
        <Field label="対象の播種記録 *" className="col-span-2">
          <select className="input" value={form.seedingId} onChange={(e) => set('seedingId', e.target.value)} required>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {fmt(s.date, 'M/d')} 播種 · {lineById.get(s.lineId)?.name ?? '?'} · {s.plateType}
                {s.purpose ? ` · ${s.purpose}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="アッセイ名 *" className="col-span-2">
          <input className="input" autoFocus={!existing} value={form.name} onChange={(e) => set('name', e.target.value)} list="assay-presets-2" placeholder="例: TEER 測定" required />
          <datalist id="assay-presets-2">
            {ASSAY_PRESETS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="実施日 *" hint={seeding ? `播種から Day ${cultureDay(seeding.date, form.date)}` : undefined}>
          <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </Field>
        <Field label="時刻">
          <input className="input" type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
        <Field label="条件・メモ" className="col-span-2">
          <textarea className="input min-h-16" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="濃度、サンプル数など" />
        </Field>
        {existing && (
          <>
            <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="size-4 accent-brand-600" checked={form.done} onChange={(e) => set('done', e.target.checked)} />
              実施済み
            </label>
            <Field label="結果・所見" className="col-span-2">
              <textarea className="input min-h-16" value={form.result} onChange={(e) => set('result', e.target.value)} />
            </Field>
          </>
        )}
      </form>
    </Modal>
  )
}
