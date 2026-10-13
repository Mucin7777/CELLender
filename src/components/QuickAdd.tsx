import { useMemo, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { EVENT_TYPE_META } from '../lib/constants'
import { fmt } from '../lib/date'
import { EVENT_ICONS } from './EventItem'
import { LineDot, Modal } from './ui'

type Choice = 'passage_plan' | 'passage_done' | 'seeding' | 'assay' | 'medium' | 'other'

const CHOICES: { key: Choice; label: string; desc: string }[] = [
  { key: 'passage_plan', label: '継代予定を設定', desc: 'この日をラインの次回継代日にする' },
  { key: 'passage_done', label: '継代を記録', desc: '実施した継代を記録（P数を+1）' },
  { key: 'seeding', label: '播種を記録', desc: 'プレートへの播種を新規登録' },
  { key: 'assay', label: 'アッセイを予定', desc: '播種記録に紐づくアッセイ' },
  { key: 'medium', label: '培地交換', desc: '培地交換の予定' },
  { key: 'other', label: 'その他の予定', desc: '試薬発注、メモなど' },
]

export function QuickAdd({ date }: { date: string }) {
  const { close, open, toast } = useUI()
  const allLines = useStore((s) => s.lines)
  const lines = useMemo(() => allLines.filter((l) => !l.archived), [allLines])
  const updateLine = useStore((s) => s.updateLine)
  const [pickLine, setPickLine] = useState<null | 'passage_plan' | 'passage_done'>(null)

  const choose = (c: Choice) => {
    if (c === 'passage_plan' || c === 'passage_done') return setPickLine(c)
    close()
    if (c === 'seeding') open({ kind: 'seeding', date })
    else if (c === 'assay') open({ kind: 'assay', date })
    else open({ kind: 'task', date, taskKind: c })
  }

  return (
    <Modal title={`${fmt(date, 'M月d日 (E)')} に追加`} size="sm" onClose={close}>
      {!pickLine ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CHOICES.map((c) => {
            const meta = EVENT_TYPE_META[c.key]
            const Icon = EVENT_ICONS[c.key === 'passage_done' ? 'passage_plan' : c.key]
            return (
              <button key={c.key} onClick={() => choose(c.key)} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: meta.color }}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{c.label}</span>
                  <span className="block text-[11px] leading-snug text-slate-500">{c.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div>
          <button className="btn-ghost btn-sm -ml-2 mb-2" onClick={() => setPickLine(null)}>
            <ChevronLeft className="size-4" />
            戻る
          </button>
          <p className="mb-2 text-sm text-slate-600">細胞ラインを選択</p>
          {lines.length === 0 && <p className="text-sm text-slate-400">細胞ラインがありません。</p>}
          <div className="space-y-1">
            {lines.map((l) => (
              <button
                key={l.id}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                onClick={() => {
                  close()
                  if (pickLine === 'passage_plan') {
                    updateLine(l.id, { nextPassageDate: date })
                    toast(`${l.name} の次回継代を ${fmt(date)} に設定しました`)
                  } else {
                    open({ kind: 'passage', lineId: l.id })
                  }
                }}
              >
                <LineDot color={l.color} className="size-3" />
                <span className="flex-1 truncate text-sm font-medium">{l.name}</span>
                <span className="font-mono text-xs text-slate-400">P{l.passageNumber}</span>
                {l.nextPassageDate && <span className="text-xs text-slate-400">予定 {fmt(l.nextPassageDate, 'M/d')}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
