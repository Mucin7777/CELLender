import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { fmt, todayStr } from '../lib/date'
import type { TaskKind } from '../types'
import { Disclosure, Field, Segmented, Sheet } from './ui'

export function TaskForm(props: { id?: string; date?: string; taskKind?: TaskKind; lineId?: string; seedingId?: string }) {
  const { close, toast } = useUI()
  const existing = useStore((s) => s.tasks.find((t) => t.id === props.id))
  const lines = useStore((s) => s.lines)
  const seedings = useStore((s) => s.seedings)
  const { addTask, updateTask, deleteTask } = useStore()

  const [form, setForm] = useState({
    date: existing?.date ?? props.date ?? todayStr(),
    kind: existing?.kind ?? props.taskKind ?? ('medium' as TaskKind),
    title: existing?.title ?? (props.taskKind === 'other' ? '' : '培地交換'),
    lineId: existing?.lineId ?? props.lineId ?? '',
    seedingId: existing?.seedingId ?? props.seedingId ?? '',
    notes: existing?.notes ?? '',
  })
  const [more, setMore] = useState(!!(form.lineId || form.notes))
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const lineSeedings = seedings.filter((s) => s.lineId === form.lineId && (s.status === 'culturing' || s.status === 'assay_scheduled'))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const data = { ...form, title: form.title.trim(), lineId: form.lineId || null, seedingId: form.seedingId || null }
    if (existing) updateTask(existing.id, data)
    else addTask(data)
    toast(existing ? '保存しました' : '予定を追加しました')
    close()
  }

  return (
    <Sheet
      title={existing ? '予定を編集' : '予定を追加'}
      onClose={close}
      footer={
        <button type="submit" form="task-form" className="btn-primary flex-1" disabled={!form.title.trim()}>
          {existing ? '保存' : '追加'}
        </button>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4">
        <Segmented
          full
          value={form.kind}
          onChange={(k) => setForm((f) => ({ ...f, kind: k, title: k === 'medium' ? f.title || '培地交換' : f.title === '培地交換' ? '' : f.title }))}
          options={[
            { value: 'medium', label: '培地交換' },
            { value: 'other', label: 'その他' },
          ]}
        />
        <Field label="内容">
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="例: 試薬発注" required />
        </Field>
        <Field label="日付">
          <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </Field>
        <Disclosure open={more} onToggle={() => setMore((v) => !v)} label="細胞ライン・メモ">
          <Field label="細胞ライン">
            <select className="input" value={form.lineId} onChange={(e) => setForm((f) => ({ ...f, lineId: e.target.value, seedingId: '' }))}>
              <option value="">なし</option>
              {lines.filter((l) => !l.archived || l.id === form.lineId).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          {form.lineId && lineSeedings.length > 0 && (
            <Field label="播種記録">
              <select className="input" value={form.seedingId} onChange={(e) => set('seedingId', e.target.value)}>
                <option value="">なし（ライン全体）</option>
                {lineSeedings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fmt(s.date, 'M/d')} 播種 · {s.plateType}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="メモ">
            <textarea className="input min-h-16" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </Disclosure>
        {existing && (
          <button
            type="button"
            className="min-h-11 w-full text-[15px] font-semibold text-danger"
            onClick={() => {
              deleteTask(existing.id)
              useUI.getState().closeAll()
              toast('削除しました')
            }}
          >
            この予定を削除
          </button>
        )}
      </form>
    </Sheet>
  )
}
