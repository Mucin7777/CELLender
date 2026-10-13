import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useStore, type NewSeeding } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { ASSAY_PRESETS, PLATE_TYPES, SEEDING_STATUS_META } from '../lib/constants'
import { addDaysStr, diffDays, fmt, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import type { SeedingStatus } from '../types'
import { Field, Modal } from './ui'

interface AssayDraft {
  key: number
  name: string
  day: number
}

let draftSeq = 0

export function SeedingForm({ id, lineId, date }: { id?: string; lineId?: string; date?: string }) {
  const { close, toast } = useUI()
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
  const [assayDrafts, setAssayDrafts] = useState<AssayDraft[]>([])
  const [mediumEvery, setMediumEvery] = useState(0)

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const onLineChange = (lid: string) => {
    const l = lines.find((x) => x.id === lid)
    setForm((f) => ({ ...f, lineId: lid, passageNumber: existing ? f.passageNumber : (l?.passageNumber ?? null) }))
  }

  const lastAssayDay = Math.max(0, ...assayDrafts.map((a) => a.day))
  const mediumUntil = lastAssayDay > 0 ? lastAssayDay : 14
  const mediumCount = mediumEvery > 0 ? Math.floor((mediumUntil - 1) / mediumEvery) : 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.lineId) return
    if (existing) {
      updateSeeding(existing.id, form)
      toast('播種記録を更新しました')
      close()
      return
    }
    const sid = addSeeding({ ...form, status: 'culturing' })
    for (const a of assayDrafts) {
      if (!a.name.trim()) continue
      addAssay({ seedingId: sid, date: addDaysStr(form.date, a.day), time: '', name: a.name.trim(), notes: '' })
    }
    for (let i = 1; i <= mediumCount; i++) {
      addTask({ date: addDaysStr(form.date, i * mediumEvery), kind: 'medium', title: '培地交換', lineId: form.lineId, seedingId: sid, notes: '' })
    }
    toast('播種記録を追加しました', { label: '詳細を開く', onClick: () => navigate({ view: 'seedings', id: sid }) })
    close()
  }

  const onDelete = () => {
    if (!existing) return
    confirmDialog({
      title: '播種記録を削除',
      message: 'この播種記録と、紐づくアッセイ・培地交換予定をすべて削除します。',
      confirmLabel: '削除する',
      danger: true,
      onConfirm: () => {
        deleteSeeding(existing.id)
        useUI.getState().closeAll()
        navigate({ view: 'seedings' })
        toast('播種記録を削除しました')
      },
    })
  }

  if (activeLines.length === 0) {
    return (
      <Modal title="播種を記録" onClose={close} size="sm">
        <p className="text-sm text-slate-600">先に細胞ラインを登録してください。</p>
        <button className="btn-primary mt-4" onClick={() => { close(); useUI.getState().open({ kind: 'line' }) }}>
          細胞ラインを追加
        </button>
      </Modal>
    )
  }

  return (
    <Modal
      title={existing ? '播種記録を編集' : '播種を記録'}
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
          <button type="submit" form="seeding-form" className="btn-primary" disabled={!form.lineId}>
            {existing ? '保存' : '登録'}
          </button>
        </>
      }
    >
      <form id="seeding-form" onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-4">
        <Field label="由来の細胞ライン *" className="col-span-2">
          <select className="input" value={form.lineId} onChange={(e) => onLineChange(e.target.value)} required>
            {activeLines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}（現在 P{l.passageNumber}）
              </option>
            ))}
          </select>
        </Field>
        <Field label="播種日 *">
          <input className="input" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </Field>
        <Field label="播種時の継代数 (P)">
          <input
            className="input"
            type="number"
            min={0}
            value={form.passageNumber ?? ''}
            onChange={(e) => set('passageNumber', e.target.value === '' ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="プレート・容器" className="col-span-2">
          <input className="input" value={form.plateType} onChange={(e) => set('plateType', e.target.value)} list="plate-types" />
          <datalist id="plate-types">
            {PLATE_TYPES.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="播種密度">
          <input className="input" value={form.density} onChange={(e) => set('density', e.target.value)} placeholder="例: 5,000 cells/well" />
        </Field>
        <Field label="使用ウェル数">
          <input className="input" value={form.wells} onChange={(e) => set('wells', e.target.value)} placeholder="例: 60 wells" />
        </Field>
        <Field label="実験内容・目的" className="col-span-2">
          <input className="input" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="例: 薬剤 A の毒性評価" />
        </Field>
        <Field label="メモ" className="col-span-2">
          <textarea className="input min-h-16" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        {existing && (
          <Field label="状態" className="col-span-2">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as SeedingStatus)}>
              {Object.entries(SEEDING_STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {!existing && (
          <div className="col-span-2 space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">アッセイ予定（任意）</span>
              <button
                type="button"
                className="btn-ghost btn-sm text-brand-700"
                onClick={() => setAssayDrafts((d) => [...d, { key: ++draftSeq, name: '', day: (d.at(-1)?.day ?? 2) + (d.length ? 1 : 0) }])}
              >
                <Plus className="size-3.5" />
                追加
              </button>
            </div>
            {assayDrafts.length === 0 && <p className="text-xs text-slate-400">播種と同時にアッセイ予定を登録できます。後から追加することもできます。</p>}
            {assayDrafts.map((a) => (
              <div key={a.key} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  value={a.name}
                  list="assay-presets"
                  placeholder="アッセイ名"
                  onChange={(e) => setAssayDrafts((d) => d.map((x) => (x.key === a.key ? { ...x, name: e.target.value } : x)))}
                />
                <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                  Day
                  <input
                    className="input w-16 px-2"
                    type="number"
                    min={0}
                    value={a.day}
                    onChange={(e) => setAssayDrafts((d) => d.map((x) => (x.key === a.key ? { ...x, day: Math.max(0, Number(e.target.value) || 0) } : x)))}
                  />
                </div>
                <span className="hidden w-16 shrink-0 text-xs text-slate-400 sm:inline">{fmt(addDaysStr(form.date, a.day), 'M/d(E)')}</span>
                <button type="button" className="icon-btn shrink-0" onClick={() => setAssayDrafts((d) => d.filter((x) => x.key !== a.key))} aria-label="削除">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <datalist id="assay-presets">
              {ASSAY_PRESETS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              培地交換を
              <input className="input w-16 px-2" type="number" min={0} value={mediumEvery} onChange={(e) => setMediumEvery(Math.max(0, Number(e.target.value) || 0))} />
              日ごとに自動登録
              {mediumCount > 0 && <span className="text-brand-700">（Day {mediumUntil} まで {mediumCount} 件）</span>}
            </div>
          </div>
        )}
        {existing && form.date !== existing.date && (
          <p className="col-span-2 text-xs text-amber-600">播種日を {diffDays(existing.date, form.date) > 0 ? '後' : '前'}にずらしても、アッセイ日は自動では変わりません。</p>
        )}
      </form>
    </Modal>
  )
}
