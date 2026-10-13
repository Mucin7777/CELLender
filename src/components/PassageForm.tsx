import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { addDaysStr, fmt, todayStr } from '../lib/date'
import { Field, LineDot, Modal } from './ui'

export function PassageForm({ lineId }: { lineId: string }) {
  const { close, open, toast } = useUI()
  const line = useStore((s) => s.lines.find((l) => l.id === lineId))
  const recordPassage = useStore((s) => s.recordPassage)
  const [date, setDate] = useState(todayStr())
  const [splitRatio, setSplitRatio] = useState('')
  const [notes, setNotes] = useState('')
  const interval = line?.passageIntervalDays ?? 0
  const [next, setNext] = useState<string>(interval > 0 ? addDaysStr(todayStr(), interval) : '')
  const [alsoSeed, setAlsoSeed] = useState(false)

  if (!line) return null

  const onDateChange = (v: string) => {
    setDate(v)
    if (interval > 0 && v) setNext(addDaysStr(v, interval))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    recordPassage(line.id, { date, splitRatio, notes, nextPassageDate: next || null })
    close()
    if (alsoSeed) {
      open({ kind: 'seeding', lineId: line.id, date })
    } else {
      toast(`${line.name} を P${line.passageNumber + 1} に継代しました`, {
        label: '播種も記録',
        onClick: () => useUI.getState().open({ kind: 'seeding', lineId: line.id, date }),
      })
    }
  }

  return (
    <Modal
      title="継代を記録"
      size="sm"
      onClose={close}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={close}>
            キャンセル
          </button>
          <button type="submit" form="passage-form" className="btn-primary">
            記録する
          </button>
        </>
      }
    >
      <form id="passage-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <LineDot color={line.color} className="size-3" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-slate-900">{line.name}</div>
            <div className="text-xs text-slate-500">
              {line.lastPassageDate ? `前回 ${fmt(line.lastPassageDate)}` : '継代記録なし'}
            </div>
          </div>
          <div className="text-right font-mono text-sm">
            <span className="text-slate-400">P{line.passageNumber}</span>
            <span className="mx-1 text-slate-300">→</span>
            <span className="font-bold text-brand-700">P{line.passageNumber + 1}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="継代日">
            <input className="input" type="date" value={date} onChange={(e) => onDateChange(e.target.value)} required />
          </Field>
          <Field label="分割比">
            <input className="input" value={splitRatio} onChange={(e) => setSplitRatio(e.target.value)} placeholder="例: 1:4" list="split-ratios" />
            <datalist id="split-ratios">
              {['1:2', '1:3', '1:4', '1:5', '1:6', '1:8', '1:10'].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="次回継代予定日" hint={interval > 0 ? `継代間隔 ${interval} 日から自動計算` : undefined}>
          <input className="input" type="date" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="メモ">
          <textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="コンフルエンシー、形態など" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="size-4 accent-brand-600" checked={alsoSeed} onChange={(e) => setAlsoSeed(e.target.checked)} />
          続けて播種を記録する
        </label>
      </form>
    </Modal>
  )
}
