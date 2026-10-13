import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { ASSAY_PRESETS } from '../lib/constants'
import { cultureDay, fmt, todayStr } from '../lib/date'
import { Chips, Disclosure, Field, LineDot, Sheet, Toggle, cx } from './ui'

export function AssayForm({ id, seedingId, date }: { id?: string; seedingId?: string; date?: string }) {
  const { close, toast, open } = useUI()
  const existing = useStore((s) => s.assays.find((a) => a.id === id))
  const seedings = useStore((s) => s.seedings)
  const lines = useStore((s) => s.lines)
  const { addAssay, updateAssay, deleteAssay } = useStore()
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])
  const fixed = existing?.seedingId ?? seedingId

  const options = useMemo(
    () =>
      seedings
        .filter((s) => s.id === fixed || s.status === 'culturing' || s.status === 'assay_scheduled')
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [seedings, fixed],
  )

  const [form, setForm] = useState({
    seedingId: fixed ?? options[0]?.id ?? '',
    date: existing?.date ?? date ?? todayStr(),
    time: existing?.time ?? '',
    name: existing?.name ?? '',
    notes: existing?.notes ?? '',
    done: existing?.done ?? false,
    result: existing?.result ?? '',
  })
  const [more, setMore] = useState(!!(existing?.notes || existing?.time))
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const seeding = seedings.find((s) => s.id === form.seedingId)
  const valid = !!form.seedingId && !!form.name.trim()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    const data = { seedingId: form.seedingId, date: form.date, time: form.time, name: form.name.trim(), notes: form.notes }
    if (existing) {
      updateAssay(existing.id, { ...data, result: form.result, done: form.done, doneAt: form.done ? (existing.doneAt ?? new Date().toISOString()) : null })
      toast('保存しました')
    } else {
      addAssay(data)
      toast('アッセイを予定しました')
    }
    close()
  }

  if (options.length === 0) {
    return (
      <Sheet title="アッセイを予定" onClose={close}>
        <p className="text-sub">アッセイは播種記録にひもづけて登録します。先に播種を記録してください。</p>
        <button className="btn-primary mt-4 w-full" onClick={() => { close(); open({ kind: 'seeding', date: form.date }) }}>
          播種を記録
        </button>
      </Sheet>
    )
  }

  return (
    <Sheet
      title={existing ? 'アッセイを編集' : 'アッセイを予定'}
      onClose={close}
      footer={
        <button type="submit" form="assay-form" className="btn-primary flex-1" disabled={!valid}>
          {existing ? '保存' : '予定に追加'}
        </button>
      }
    >
      <form id="assay-form" onSubmit={submit} className="space-y-5">
        <div>
          <span className="label">どの播種に？</span>
          <div className="space-y-1.5">
            {(fixed ? options.filter((s) => s.id === fixed) : options).map((s) => {
              const l = lineById.get(s.lineId)
              const sel = s.id === form.seedingId
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => set('seedingId', s.id)}
                  className={cx('flex min-h-12 w-full items-center gap-3 rounded-xl px-3.5 text-left transition', sel ? 'bg-ink text-white' : 'bg-canvas')}
                >
                  {l && <LineDot color={l.color} />}
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                    {l?.name} · {s.plateType}
                  </span>
                  <span className={cx('shrink-0 text-[12px]', sel ? 'text-white/70' : 'text-sub')}>{fmt(s.date, 'M/d')} 播種</span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <span className="label">アッセイ名</span>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例: TEER 測定" required />
          <Chips options={ASSAY_PRESETS} value={form.name} onPick={(v) => set('name', v)} />
        </div>
        <Field label="実施日" hint={seeding ? `播種から ${cultureDay(seeding.date, form.date)} 日目` : undefined}>
          <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </Field>
        <Disclosure open={more} onToggle={() => setMore((v) => !v)} label="時刻・条件メモ">
          <Field label="時刻">
            <input className="input" type="time" value={form.time} onChange={(e) => set('time', e.target.value)} />
          </Field>
          <Field label="条件・メモ">
            <textarea className="input min-h-16" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="濃度、サンプル数など" />
          </Field>
        </Disclosure>
        {existing && (
          <>
            <Toggle checked={form.done} onChange={(v) => set('done', v)} label="実施済み" />
            <Field label="結果・所見">
              <textarea className="input min-h-20" value={form.result} onChange={(e) => set('result', e.target.value)} />
            </Field>
            <button
              type="button"
              className="min-h-11 w-full text-[15px] font-semibold text-rose-600"
              onClick={() =>
                confirmDialog({
                  title: 'このアッセイを削除しますか？',
                  message: `「${existing.name}」を削除します。`,
                  confirmLabel: '削除',
                  danger: true,
                  onConfirm: () => {
                    deleteAssay(existing.id)
                    useUI.getState().closeAll()
                    toast('削除しました')
                  },
                })
              }
            >
              このアッセイを削除
            </button>
          </>
        )}
      </form>
    </Sheet>
  )
}
