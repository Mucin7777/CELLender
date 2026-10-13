import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { addDaysStr, fmt, todayStr } from '../lib/date'
import { Chips, Disclosure, Field, LineDot, Sheet, Toggle } from './ui'

export function PassageForm({ lineId }: { lineId: string }) {
  const { close, open, toast } = useUI()
  const line = useStore((s) => s.lines.find((l) => l.id === lineId))
  const recordPassage = useStore((s) => s.recordPassage)
  const interval = line?.passageIntervalDays ?? 0
  const [date, setDate] = useState(todayStr())
  const [next, setNext] = useState(interval > 0 ? addDaysStr(todayStr(), interval) : '')
  const [splitRatio, setSplitRatio] = useState('')
  const [notes, setNotes] = useState('')
  const [more, setMore] = useState(false)
  const [alsoSeed, setAlsoSeed] = useState(false)

  if (!line) return null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    recordPassage(line.id, { date, splitRatio, notes, nextPassageDate: next || null })
    close()
    if (alsoSeed) open({ kind: 'seeding', lineId: line.id, date })
    else
      toast(`P${line.passageNumber + 1} に継代しました`, {
        label: '播種も記録',
        onClick: () => useUI.getState().open({ kind: 'seeding', lineId: line.id, date }),
      })
  }

  return (
    <Sheet
      title="継代を記録"
      onClose={close}
      footer={
        <button type="submit" form="passage-form" className="btn-primary flex-1">
          P{line.passageNumber + 1} に継代する
        </button>
      }
    >
      <form id="passage-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3.5">
          <LineDot color={line.color} className="size-3" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{line.name}</div>
            <div className="text-[13px] text-sub">{line.lastPassageDate ? `前回 ${fmt(line.lastPassageDate)}` : '継代記録なし'}</div>
          </div>
          <div className="font-num text-[15px]">
            <span className="text-faint">P{line.passageNumber} → </span>
            <span className="font-bold text-teal-dark">P{line.passageNumber + 1}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="継代日">
            <input
              className="input"
              type="date"
              value={date}
              required
              onChange={(e) => {
                setDate(e.target.value)
                if (interval > 0 && e.target.value) setNext(addDaysStr(e.target.value, interval))
              }}
            />
          </Field>
          <Field label="次回の予定" hint={interval > 0 ? `${interval}日後で自動計算` : undefined}>
            <input className="input" type="date" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
        </div>
        <Disclosure open={more} onToggle={() => setMore((v) => !v)} label="分割比・メモ">
          <div>
            <span className="label">分割比</span>
            <input className="input" value={splitRatio} onChange={(e) => setSplitRatio(e.target.value)} placeholder="例: 1:4" />
            <Chips options={['1:2', '1:3', '1:4', '1:5', '1:6', '1:8', '1:10']} value={splitRatio} onPick={setSplitRatio} />
          </div>
          <Field label="メモ">
            <textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="コンフルエンシー、形態など" />
          </Field>
        </Disclosure>
        <Toggle checked={alsoSeed} onChange={setAlsoSeed} label="続けて播種を記録する" />
      </form>
    </Sheet>
  )
}
