import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Beaker, ChevronLeft, Droplets, FlaskConical, GitBranch, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { fmt, relativeLabel, todayStr } from '../lib/date'
import { LineDot, List, Row, Sheet } from './ui'

/** 「＋」から開くアクションシート */
export function AddSheet({ date }: { date?: string }) {
  const { close, open } = useUI(useShallow((s) => ({ close: s.close, open: s.open })))
  const allLines = useStore((s) => s.lines)
  const lines = useMemo(() => allLines.filter((l) => !l.archived), [allLines])
  const [pickLine, setPickLine] = useState(false)
  const d = date ?? todayStr()
  const go = (fn: () => void) => {
    close()
    fn()
  }

  const Icon = ({ children }: { children: React.ReactNode }) => (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-mint text-teal-dark">
      {children}
    </span>
  )

  if (pickLine) {
    return (
      <Sheet
        onClose={close}
        title={
          <button className="-ml-2 flex items-center text-[17px] font-bold" onClick={() => setPickLine(false)}>
            <ChevronLeft className="size-5" />
            どのラインを継代？
          </button>
        }
      >
        {lines.length === 0 ? (
          <p className="py-6 text-center text-sub">細胞ラインがありません</p>
        ) : (
          <List>
            {lines.map((l) => (
              <Row
                key={l.id}
                onClick={() => go(() => open({ kind: 'passage', lineId: l.id }))}
                left={<LineDot color={l.color} className="size-3" />}
                title={l.name}
                sub={l.nextPassageDate ? `予定 ${fmt(l.nextPassageDate, 'M/d')}（${relativeLabel(l.nextPassageDate)}）` : '予定なし'}
                right={<span className="font-num text-[13px] text-sub">P{l.passageNumber}</span>}
                chevron
              />
            ))}
          </List>
        )}
      </Sheet>
    )
  }

  return (
    <Sheet onClose={close} title={date ? `${fmt(d, 'M月d日 (E)')} に追加` : '新規追加'}>
      <List>
        <Row onClick={() => setPickLine(true)} left={<Icon><GitBranch className="size-4.5" /></Icon>} title="継代を記録" sub="P数を進めて次回予定を入れる" chevron />
        <Row onClick={() => go(() => open({ kind: 'seeding', date: d }))} left={<Icon><FlaskConical className="size-4.5" /></Icon>} title="播種を記録" sub="プレートへの播種を登録" chevron />
        <Row onClick={() => go(() => open({ kind: 'assay', date: d }))} left={<Icon><Beaker className="size-4.5" /></Icon>} title="アッセイを予定" sub="播種記録にひもづけて登録" chevron />
        <Row onClick={() => go(() => open({ kind: 'task', date: d }))} left={<Icon><Droplets className="size-4.5" /></Icon>} title="培地交換・その他" sub="培地交換、試薬発注など" chevron />
      </List>
      <List className="mt-3">
        <Row onClick={() => go(() => open({ kind: 'line' }))} left={<Icon><Plus className="size-4.5" /></Icon>} title="細胞ラインを追加" chevron />
      </List>
    </Sheet>
  )
}
