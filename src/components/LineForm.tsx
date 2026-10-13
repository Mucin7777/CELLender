import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore, type NewLine } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { LINE_COLORS } from '../lib/constants'
import { addDaysStr } from '../lib/date'
import { navigate } from '../lib/router'
import { Field, Modal, cx } from './ui'

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
  // 次回予定日を手動で変更したかどうか（未変更なら最終継代日+間隔で自動計算）
  const [nextTouched, setNextTouched] = useState(!!existing)

  const set = <K extends keyof NewLine>(k: K, v: NewLine[K]) =>
    setForm((f) => {
      const nf = { ...f, [k]: v }
      if (!nextTouched && (k === 'lastPassageDate' || k === 'passageIntervalDays')) {
        nf.nextPassageDate = nf.lastPassageDate && nf.passageIntervalDays > 0 ? addDaysStr(nf.lastPassageDate, nf.passageIntervalDays) : nf.nextPassageDate
      }
      return nf
    })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const data = { ...form, name: form.name.trim() }
    if (existing) {
      updateLine(existing.id, data)
      toast('細胞ラインを更新しました')
    } else {
      const newId = addLine(data)
      toast('細胞ラインを追加しました', { label: '詳細を開く', onClick: () => navigate({ view: 'lines', id: newId }) })
    }
    close()
  }

  const onDelete = () => {
    if (!existing) return
    confirmDialog({
      title: '細胞ラインを削除',
      message: `「${existing.name}」と、関連する継代記録・播種記録・アッセイをすべて削除します。この操作は取り消せません。\n使わなくなったラインは「アーカイブ」にすることもできます。`,
      confirmLabel: '削除する',
      danger: true,
      onConfirm: () => {
        deleteLine(existing.id)
        useUI.getState().closeAll()
        navigate({ view: 'lines' })
        toast('細胞ラインを削除しました')
      },
    })
  }

  return (
    <Modal
      title={existing ? '細胞ラインを編集' : '細胞ラインを追加'}
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
          <button type="submit" form="line-form" className="btn-primary" disabled={!form.name.trim()}>
            {existing ? '保存' : '追加'}
          </button>
        </>
      }
    >
      <form id="line-form" onSubmit={submit} className="grid grid-cols-2 gap-x-3 gap-y-4">
        <Field label="名前 *" className="col-span-2">
          <input className="input" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="例: ヒト回腸 Lot1" required />
        </Field>
        <Field label="由来・種類">
          <input className="input" value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="例: ヒト回腸オルガノイド" />
        </Field>
        <Field label="ロット">
          <input className="input" value={form.lot} onChange={(e) => set('lot', e.target.value)} placeholder="例: Lot1" />
        </Field>
        <div className="col-span-2">
          <span className="label">表示色</span>
          <div className="flex flex-wrap items-center gap-2">
            {LINE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className={cx('size-7 rounded-full ring-offset-2 transition', form.color === c ? 'ring-2 ring-slate-400' : 'hover:scale-110')}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
            <input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0" title="カスタム色" />
          </div>
        </div>

        <div className="col-span-2 mt-1 border-t border-slate-100 pt-4 text-xs font-semibold tracking-wide text-slate-400">継代情報</div>
        <Field label="現在の継代数 (P)">
          <input className="input" type="number" min={0} value={form.passageNumber} onChange={(e) => set('passageNumber', Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="継代間隔（日）" hint="0 で自動予定なし">
          <input className="input" type="number" min={0} value={form.passageIntervalDays} onChange={(e) => set('passageIntervalDays', Math.max(0, Number(e.target.value) || 0))} />
        </Field>
        <Field label="最終継代日">
          <input className="input" type="date" value={form.lastPassageDate ?? ''} onChange={(e) => set('lastPassageDate', e.target.value || null)} />
        </Field>
        <Field label="次回継代予定日">
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
        <Field label="培地">
          <input className="input" value={form.medium} onChange={(e) => set('medium', e.target.value)} placeholder="例: DMEM + 10% FBS" />
        </Field>
        <Field label="培養容器">
          <input className="input" value={form.vessel} onChange={(e) => set('vessel', e.target.value)} placeholder="例: T75 フラスコ" />
        </Field>
        <Field label="メモ" className="col-span-2">
          <textarea className="input min-h-20" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
