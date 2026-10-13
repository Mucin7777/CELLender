import { useState } from 'react'
import { useStore, type NewLine } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { LINE_COLORS } from '../lib/constants'
import { lineTone } from '../lib/color'
import { addDaysStr } from '../lib/date'
import { navigate } from '../lib/router'
import { Disclosure, Field, Sheet, cx } from './ui'

export function LineForm({ id }: { id?: string }) {
  const { close, toast } = useUI()
  const lines = useStore((s) => s.lines)
  const existing = lines.find((l) => l.id === id)
  const { addLine, updateLine, deleteLine } = useStore()
  const usedColors = new Set(lines.map((l) => l.color))

  const [form, setForm] = useState<NewLine>(
    existing ?? {
      name: '',
      origin: '',
      lot: '',
      color: LINE_COLORS.find((c) => !usedColors.has(c)) ?? LINE_COLORS[lines.length % LINE_COLORS.length],
      passageNumber: 0,
      lastPassageDate: null,
      passageIntervalDays: 7,
      nextPassageDate: null,
      medium: '',
      vessel: '',
      notes: '',
    },
  )
  const [nextTouched, setNextTouched] = useState(!!existing)
  const [more, setMore] = useState(!!existing && !!(existing.shortName || existing.origin || existing.lot || existing.medium || existing.vessel || existing.notes))

  const set = <K extends keyof NewLine>(k: K, v: NewLine[K]) =>
    setForm((f) => {
      const nf = { ...f, [k]: v }
      // 次回予定日を手で変えていなければ「最終継代日 + 間隔」で自動計算
      if (!nextTouched && (k === 'lastPassageDate' || k === 'passageIntervalDays') && nf.lastPassageDate && nf.passageIntervalDays > 0) {
        nf.nextPassageDate = addDaysStr(nf.lastPassageDate, nf.passageIntervalDays)
      }
      return nf
    })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const data = { ...form, name: form.name.trim() }
    if (existing) {
      updateLine(existing.id, data)
      toast('保存しました')
    } else {
      const newId = addLine(data)
      toast('細胞ラインを追加しました', { label: '開く', onClick: () => navigate({ view: 'lines', id: newId }) })
    }
    close()
  }

  const onDelete = () =>
    existing &&
    confirmDialog({
      title: 'この細胞ラインを削除しますか？',
      message: `「${existing.name}」の継代記録・播種記録・アッセイもすべて削除されます。\n使わなくなっただけなら「アーカイブ」がおすすめです。`,
      confirmLabel: '削除',
      danger: true,
      onConfirm: () => {
        deleteLine(existing.id)
        useUI.getState().closeAll()
        navigate({ view: 'lines' })
        toast('削除しました')
      },
    })

  return (
    <Sheet
      title={existing ? 'ラインを編集' : '細胞ラインを追加'}
      onClose={close}
      footer={
        <button type="submit" form="line-form" className="btn-primary flex-1" disabled={!form.name.trim()}>
          {existing ? '保存' : '追加'}
        </button>
      }
    >
      <form id="line-form" onSubmit={submit} className="space-y-4">
        <Field label="名前">
          <input className="input" autoFocus={!existing} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例: ヒト回腸 Lot1" required />
        </Field>
        <div>
          <span className="label" id="line-color-label">色（カレンダーの帯の色）</span>
          <div className="flex items-start gap-4">
            <div className="flex flex-1 flex-wrap gap-2.5" role="radiogroup" aria-labelledby="line-color-label">
              {(LINE_COLORS.includes(form.color) ? LINE_COLORS : [form.color, ...LINE_COLORS]).map((c, i) => {
                const t = lineTone(c)
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={form.color === c}
                    aria-label={`色 ${i + 1}`}
                    onClick={() => set('color', c)}
                    className={cx('size-9 rounded-full ring-offset-2 transition', form.color === c ? 'ring-2 ring-teal' : 'hover:scale-105')}
                    style={{ backgroundColor: t.pale, boxShadow: `inset 0 0 0 2px ${t.deep}` }}
                  />
                )
              })}
            </div>
            <div className="flex shrink-0 flex-col gap-1 pt-0.5" aria-hidden="true">
              <span className="rounded-[4px] border px-1.5 py-[3px] text-[10px] font-bold leading-none" style={{ backgroundColor: lineTone(form.color).pale, color: lineTone(form.color).deep, borderColor: lineTone(form.color).pale }}>
                継代
              </span>
              <span className="rounded-[4px] border px-1.5 py-[3px] text-[10px] font-bold leading-none" style={{ backgroundColor: lineTone(form.color).deep, color: '#FFFFFF', borderColor: lineTone(form.color).deep }}>
                アッセイ
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="現在の継代数">
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">P</span>
              <input className="input pl-7" type="number" inputMode="numeric" min={0} value={form.passageNumber} onChange={(e) => set('passageNumber', Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </Field>
          <Field label="継代間隔（日）">
            <input className="input" type="number" inputMode="numeric" min={0} value={form.passageIntervalDays} onChange={(e) => set('passageIntervalDays', Math.max(0, Number(e.target.value) || 0))} />
          </Field>
          <Field label="最終継代日">
            <input className="input" type="date" value={form.lastPassageDate ?? ''} onChange={(e) => set('lastPassageDate', e.target.value || null)} />
          </Field>
          <Field label="次回の継代予定">
            <input
              className="input"
              type="date"
              value={form.nextPassageDate ?? ''}
              onChange={(e) => {
                setNextTouched(true)
                set('nextPassageDate', e.target.value || null)
              }}
            />
          </Field>
        </div>
        <Disclosure open={more} onToggle={() => setMore((v) => !v)} label="略称・由来・培地・メモ">
          <Field label="略称（カレンダーの帯に表示）" hint="設定の「帯の表示」をライン名にしたときに使います。4 文字程度がおすすめです。">
            <input className="input" value={form.shortName ?? ''} maxLength={8} onChange={(e) => set('shortName', e.target.value)} placeholder={form.name.replace(/\s+/g, '').slice(0, 4) || '回腸1'} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="由来・種類">
              <input className="input" value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="ヒト回腸" />
            </Field>
            <Field label="ロット">
              <input className="input" value={form.lot} onChange={(e) => set('lot', e.target.value)} placeholder="Lot1" />
            </Field>
            <Field label="培地">
              <input className="input" value={form.medium} onChange={(e) => set('medium', e.target.value)} />
            </Field>
            <Field label="培養容器">
              <input className="input" value={form.vessel} onChange={(e) => set('vessel', e.target.value)} />
            </Field>
          </div>
          <Field label="メモ">
            <textarea className="input min-h-20" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </Disclosure>
        {existing && (
          <button type="button" className="min-h-11 w-full text-[15px] font-semibold text-danger" onClick={onDelete}>
            このラインを削除
          </button>
        )}
      </form>
    </Sheet>
  )
}
