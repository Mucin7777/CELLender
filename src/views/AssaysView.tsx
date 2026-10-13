import { useMemo, useState } from 'react'
import { Beaker, History, Plus, Search } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { addDaysStr, cultureDay, fmt, relativeLabel, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import type { Assay } from '../types'
import { Checkbox, EmptyState, LineDot, PageHeader, Segmented, cx } from '../components/ui'

export function AssaysView() {
  const { assays, seedings, lines, setAssayDone } = useStore()
  const open = useUI((s) => s.open)
  const today = todayStr()
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const [q, setQ] = useState('')
  const seedingById = useMemo(() => new Map(seedings.map((s) => [s.id, s])), [seedings])
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])

  const query = q.trim().toLowerCase()
  const matches = (a: Assay) => {
    if (!query) return true
    const s = seedingById.get(a.seedingId)
    const l = s && lineById.get(s.lineId)
    return [a.name, a.notes, a.result, s?.purpose, s?.plateType, l?.name].join(' ').toLowerCase().includes(query)
  }

  const groups = useMemo(() => {
    const pending = assays.filter((a) => !a.done && matches(a)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.time.localeCompare(b.time)))
    const tomorrow = addDaysStr(today, 1)
    const week = addDaysStr(today, 7)
    return [
      { key: 'overdue', title: '期限超過', tone: 'text-rose-600', items: pending.filter((a) => a.date < today) },
      { key: 'today', title: '今日', tone: 'text-pink-600', items: pending.filter((a) => a.date === today) },
      { key: 'tomorrow', title: '明日', tone: 'text-slate-800', items: pending.filter((a) => a.date === tomorrow) },
      { key: 'week', title: '7日以内', tone: 'text-slate-800', items: pending.filter((a) => a.date > tomorrow && a.date <= week) },
      { key: 'later', title: 'それ以降', tone: 'text-slate-500', items: pending.filter((a) => a.date > week) },
    ].filter((g) => g.items.length > 0)
  }, [assays, today, query, seedingById, lineById])

  const history = useMemo(
    () => assays.filter((a) => a.done && matches(a)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [assays, query, seedingById, lineById],
  )

  const Row = ({ a }: { a: Assay }) => {
    const s = seedingById.get(a.seedingId)
    const l = s ? lineById.get(s.lineId) : undefined
    return (
      <div className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50" onClick={() => open({ kind: 'assay', id: a.id })}>
        <Checkbox checked={a.done} onChange={() => setAssayDone(a.id, !a.done)} color="#db2777" label="実施済み" />
        <div className="w-20 shrink-0 text-xs">
          <div className="font-semibold text-slate-700">{fmt(a.date, 'M/d (E)')}</div>
          <div className="text-slate-400">{a.time || relativeLabel(a.date)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className={cx('truncate text-sm font-semibold text-slate-800', a.done && 'text-slate-500')}>{a.name}</div>
          <button
            className="flex max-w-full items-center gap-1.5 truncate text-xs text-slate-500 hover:text-brand-700"
            onClick={(e) => {
              e.stopPropagation()
              if (s) navigate({ view: 'seedings', id: s.id })
            }}
          >
            {l && <LineDot color={l.color} className="size-2" />}
            <span className="truncate">
              {l?.name} · {s ? `${fmt(s.date, 'M/d')}播種 ${s.plateType} · Day ${cultureDay(s.date, a.date)}` : ''}
            </span>
          </button>
          {a.done && a.result && <div className="mt-0.5 truncate text-xs text-emerald-700">結果: {a.result}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="アッセイ"
        subtitle="播種記録に紐づくアッセイの予定と実施履歴"
        actions={
          <button className="btn-primary" onClick={() => open({ kind: 'assay' })}>
            <Plus className="size-4" />
            アッセイを予定
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: `予定 ${assays.filter((a) => !a.done).length}` },
            { value: 'history', label: `実施履歴 ${assays.filter((a) => a.done).length}` },
          ]}
        />
        <div className="relative ml-auto w-full sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input py-1.5 pl-8" placeholder="検索（名前・結果・ライン…）" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {tab === 'upcoming' ? (
        groups.length === 0 ? (
          <div className="card">
            <EmptyState icon={<Beaker className="size-5" />} title="予定されているアッセイはありません" description="播種記録の画面や、カレンダーからアッセイを予定できます。" />
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.key} className="card p-1.5">
                <h2 className={cx('px-3 pb-1 pt-2 text-sm font-bold', g.tone)}>
                  {g.title} <span className="font-normal text-slate-400">{g.items.length}</span>
                </h2>
                {g.items.map((a) => (
                  <Row key={a.id} a={a} />
                ))}
              </section>
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <div className="card">
          <EmptyState icon={<History className="size-5" />} title="実施済みのアッセイはまだありません" />
        </div>
      ) : (
        <section className="card p-1.5">
          {history.map((a) => (
            <Row key={a.id} a={a} />
          ))}
        </section>
      )}
    </div>
  )
}
