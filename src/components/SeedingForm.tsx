import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore, type NewSeeding } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { ASSAY_PRESETS, PLATE_TYPES, SEEDING_STATUS_META } from '../lib/constants'
import { addDaysStr, fmt, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import type { SeedingStatus } from '../types'
import { Chips, Disclosure, Field, LineDot, Segmented, Sheet, cx } from './ui'

interface AssayDraft {
  key: number
  name: string
  day: number
}
let draftSeq = 0

export function SeedingForm({ id, lineId, date }: { id?: string; lineId?: string; date?: string }) {
  const { close, toast, open } = useUI()
  const lines = useStore((s) => s.lines)
  const existing = useStore((s) => s.seedings.find((x) => x.id === id))
  const { addSeeding, updateSeeding, deleteSeeding, addAssay, addTask } = useStore()
  const activeLines = lines.filter((l) => !l.archived || l.id === existing?.lineId)
  const initialLine = lines.find((l) => l.id === (existing?.lineId ?? lineId)) ?? activeLines[0]

  const [form, setForm] = useState<NewSeeding & { status: SeedingStatus }>(
    existing ?? {
      lineId: initialLine?.id ?? '',
      date: date ?? todayStr(),
      plateType: '96ウェルプレート',
      passageNumber: initialLine?.passageNumber ?? null,
      density: '',
      wells: '',
      purpose: '',
      notes: '',
      status: 'culturing',
    },
  )
  const [drafts, setDrafts] = useState<AssayDraft[]>([])
  const [mediumEvery, setMediumEvery] = useState(0)
  const [more, setMore] = useState(!!existing)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const pickLine = (lid: string) => {
    const l = lines.find((x) => x.id === lid)
    setForm((f) => ({ ...f, lineId: lid, passageNumber: existing ? f.passageNumber : (l?.passageNumber ?? null) }))
  }

  const lastDay = Math.max(0, ...drafts.map((a) => a.day))
  const mediumUntil = lastDay > 0 ? lastDay : 14
  const mediumCount = mediumEvery > 0 ? Math.floor((mediumUntil - 1) / mediumEvery) : 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.lineId) return
    if (existing) {
      updateSeeding(existing.id, form)
      toast('保存しました')
      close()
      return
    }
    const sid = addSeeding({ ...form, status: 'culturing' })
    for (const a of drafts) if (a.name.trim()) addAssay({ seedingId: sid, date: addDaysStr(form.date, a.day), time: '', name: a.name.trim(), notes: '' })
    for (let i = 1; i <= mediumCount; i++)
      addTask({ date: addDaysStr(form.date, i * mediumEvery), kind: 'medium', title: '培地交換', lineId: form.lineId, seedingId: sid, notes: '' })
    toast('播種を記録しました', { label: '開く', onClick: () => navigate({ view: 'seedings', id: sid }) })
    close()
  }

  const onDelete = () =>
    existing &&
    confirmDialog({
      title: 'この播種記録を削除しますか？',
      message: 'ひもづくアッセイ・培地交換の予定も削除されます。',
      confirmLabel: '削除',
      danger: true,
      onConfirm: () => {
        deleteSeeding(existing.id)
        useUI.getState().closeAll()
        navigate({ view: 'seedings' })
        toast('削除しました')
      },
    })

  if (activeLines.length === 0) {
    return (
      <Sheet title="播種を記録" onClose={close}>
        <p className="text-sub">先に細胞ラインを登録してください。</p>
        <button className="btn-primary mt-4 w-full" onClick={() => { close(); open({ kind: 'line' }) }}>
          細胞ラインを追加
        </button>
      </Sheet>
    )
  }

  return (
    <Sheet
      title={existing ? '播種記録を編集' : '播種を記録'}
      onClose={close}
      footer={
        <button type="submit" form="seeding-form" className="btn-primary flex-1" disabled={!form.lineId}>
          {existing ? '保存' : drafts.length + mediumCount > 0 ? `登録（予定 ${drafts.filter((d) => d.name.trim()).length + mediumCount} 件も追加）` : '登録'}
        </button>
      }
    >
      <form id="seeding-form" onSubmit={submit} className="space-y-5">
        <div>
          <span className="label">どの細胞から？</span>
          <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
            {activeLines.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => pickLine(l.id)}
                className={cx(
                  'flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold transition',
                  form.lineId === l.id ? 'bg-ink text-white' : 'bg-canvas',
                )}
              >
                <LineDot color={l.color} />
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="播種日">
            <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
          </Field>
          <Field label="継代数">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">P</span>
              <input className="input pl-7" type="number" inputMode="numeric" min={0} value={form.passageNumber ?? ''} onChange={(e) => set('passageNumber', e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          </Field>
        </div>
        <div>
          <span className="label">プレート</span>
          <input className="input" value={form.plateType} onChange={(e) => set('plateType', e.target.value)} />
          <Chips options={PLATE_TYPES.slice(0, 8)} value={form.plateType} onPick={(v) => set('plateType', v)} />
        </div>
        <Field label="実験内容">
          <input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="例: 薬剤 A の毒性評価" />
        </Field>

        {!existing && (
          <div className="rounded-2xl bg-canvas p-4">
            <div className="flex items-center">
              <span className="flex-1 text-[14px] font-semibold">アッセイ予定</span>
              <button
                type="button"
                className="btn-sm btn bg-white text-brand-700"
                onClick={() => setDrafts((d) => [...d, { key: ++draftSeq, name: '', day: (d.at(-1)?.day ?? 1) + 1 }])}
              >
                <Plus className="size-4" />
                追加
              </button>
            </div>
            {drafts.length === 0 && <p className="mt-1 text-[13px] text-sub">あとから追加することもできます</p>}
            <div className="mt-2 space-y-3">
              {drafts.map((a) => (
                <div key={a.key} className="rounded-xl bg-white p-3">
                  <div className="flex items-center gap-2">
                    <input
                      className="input flex-1 bg-canvas py-2.5"
                      value={a.name}
                      placeholder="アッセイ名"
                      onChange={(e) => setDrafts((d) => d.map((x) => (x.key === a.key ? { ...x, name: e.target.value } : x)))}
                    />
                    <button type="button" className="icon-btn size-9" onClick={() => setDrafts((d) => d.filter((x) => x.key !== a.key))} aria-label="削除">
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
                    {ASSAY_PRESETS.map((p) => (
                      <button key={p} type="button" onClick={() => setDrafts((d) => d.map((x) => (x.key === a.key ? { ...x, name: p } : x)))} className="min-h-8 shrink-0 rounded-full bg-canvas px-2.5 text-[12px]">
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[14px] text-sub">
                    播種から
                    <input
                      className="input w-16 bg-canvas px-2 py-2 text-center"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={a.day}
                      onChange={(e) => setDrafts((d) => d.map((x) => (x.key === a.key ? { ...x, day: Math.max(0, Number(e.target.value) || 0) } : x)))}
                    />
                    日目
                    <span className="ml-auto font-semibold text-ink">{fmt(addDaysStr(form.date, a.day), 'M/d (E)')}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-hair pt-3 text-[14px] text-sub">
              培地交換
              <input className="input w-14 bg-white px-2 py-2 text-center" type="number" inputMode="numeric" min={0} value={mediumEvery} onChange={(e) => setMediumEvery(Math.max(0, Number(e.target.value) || 0))} />
              日ごと
              <span className="ml-auto text-[13px]">{mediumCount > 0 ? `${mediumCount} 件追加` : '0 = なし'}</span>
            </div>
          </div>
        )}

        <Disclosure open={more} onToggle={() => setMore((v) => !v)} label="密度・ウェル数・メモ">
          <div className="grid grid-cols-2 gap-3">
            <Field label="播種密度">
              <input className="input" value={form.density} onChange={(e) => set('density', e.target.value)} placeholder="5,000 cells/well" />
            </Field>
            <Field label="ウェル数">
              <input className="input" value={form.wells} onChange={(e) => set('wells', e.target.value)} placeholder="60 wells" />
            </Field>
          </div>
          <Field label="メモ">
            <textarea className="input min-h-16" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </Disclosure>

        {existing && (
          <>
            <div>
              <span className="label">状態</span>
              <Segmented
                full
                value={form.status}
                onChange={(v) => set('status', v)}
                options={(Object.keys(SEEDING_STATUS_META) as SeedingStatus[]).map((k) => ({ value: k, label: SEEDING_STATUS_META[k].short }))}
              />
            </div>
            <button type="button" className="min-h-11 w-full text-[15px] font-semibold text-rose-600" onClick={onDelete}>
              この播種記録を削除
            </button>
          </>
        )}
      </form>
    </Sheet>
  )
}
