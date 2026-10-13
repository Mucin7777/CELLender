import { useMemo, useState } from 'react'
import { ArrowLeft, Beaker, Copy, Droplets, FlaskConical, Pencil, Plus, Search } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { SEEDING_STATUS_META } from '../lib/constants'
import { cultureDay, fmt, relativeLabel, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import type { Seeding, SeedingStatus } from '../types'
import { Checkbox, EmptyState, LineDot, PageHeader, Segmented, StatusBadge, cx } from '../components/ui'
import { Section } from './TodayView'

export function SeedingsView({ id }: { id?: string }) {
  return id ? <SeedingDetail id={id} /> : <SeedingList />
}

type Tab = 'active' | 'completed' | 'discarded' | 'all'

function SeedingList() {
  const { seedings, lines, assays } = useStore()
  const open = useUI((s) => s.open)
  const today = todayStr()
  const [tab, setTab] = useState<Tab>('active')
  const [lineFilter, setLineFilter] = useState('')
  const [q, setQ] = useState('')
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])

  const matchTab = (s: Seeding) =>
    tab === 'all' || (tab === 'active' ? s.status === 'culturing' || s.status === 'assay_scheduled' : s.status === tab)

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase()
    return seedings
      .filter(matchTab)
      .filter((s) => !lineFilter || s.lineId === lineFilter)
      .filter((s) => !query || [s.plateType, s.purpose, s.notes, lineById.get(s.lineId)?.name].join(' ').toLowerCase().includes(query))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [seedings, tab, lineFilter, q, lineById])

  const count = (t: Tab) => seedings.filter((s) => t === 'all' || (t === 'active' ? s.status === 'culturing' || s.status === 'assay_scheduled' : s.status === t)).length

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="播種記録"
        subtitle="プレートへの播種を、継代とは独立した単位で管理します"
        actions={
          <button className="btn-primary" onClick={() => open({ kind: 'seeding' })}>
            <Plus className="size-4" />
            播種を記録
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: `進行中 ${count('active')}` },
            { value: 'completed', label: `完了 ${count('completed')}` },
            { value: 'discarded', label: `廃棄 ${count('discarded')}` },
            { value: 'all', label: 'すべて' },
          ]}
        />
        <select className="input w-auto py-1.5" value={lineFilter} onChange={(e) => setLineFilter(e.target.value)}>
          <option value="">すべてのライン</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className="input py-1.5 pl-8" placeholder="検索（目的・プレート…）" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FlaskConical className="size-5" />}
            title="該当する播種記録はありません"
            description="細胞ラインからプレートに播種したら、ここに記録しましょう。"
            action={<button className="btn-primary" onClick={() => open({ kind: 'seeding' })}><Plus className="size-4" />播種を記録</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => {
            const line = lineById.get(s.lineId)
            const sa = assays.filter((a) => a.seedingId === s.id).sort((a, b) => (a.date < b.date ? -1 : 1))
            const doneCount = sa.filter((a) => a.done).length
            const next = sa.find((a) => !a.done)
            const active = s.status === 'culturing' || s.status === 'assay_scheduled'
            return (
              <div key={s.id} onClick={() => navigate({ view: 'seedings', id: s.id })} className="card cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-xl py-1.5" style={{ backgroundColor: `${line?.color ?? '#94a3b8'}14` }}>
                    <span className="text-[10px] font-medium" style={{ color: line?.color }}>{active ? 'Day' : fmt(s.date, 'yyyy')}</span>
                    <span className="text-lg font-bold leading-tight" style={{ color: line?.color }}>{active ? cultureDay(s.date, today) : fmt(s.date, 'M/d')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {line && <LineDot color={line.color} />}
                      <span className="truncate text-sm font-bold text-slate-900">{line?.name ?? '(削除済み)'}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {fmt(s.date, 'M/d (E)')} 播種 · {s.plateType}
                      {s.passageNumber !== null && ` · P${s.passageNumber}`}
                    </div>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                {s.purpose && <p className="mt-3 line-clamp-2 text-sm text-slate-700">{s.purpose}</p>}
                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-3 text-xs">
                  {sa.length > 0 ? (
                    <>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Beaker className="size-3.5" />
                        {doneCount}/{sa.length}
                      </span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-pink-500" style={{ width: `${(doneCount / sa.length) * 100}%` }} />
                      </div>
                      {next && (
                        <span className={cx('truncate', next.date < today ? 'font-semibold text-rose-600' : next.date === today ? 'font-semibold text-pink-600' : 'text-slate-500')}>
                          {next.name} · {relativeLabel(next.date)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400">アッセイ未設定</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SeedingDetail({ id }: { id: string }) {
  const st = useStore()
  const { open, toast } = useUI()
  const today = todayStr()
  const seeding = st.seedings.find((s) => s.id === id)
  const line = seeding ? st.lines.find((l) => l.id === seeding.lineId) : undefined
  const assays = useMemo(() => st.assays.filter((a) => a.seedingId === id).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.time.localeCompare(b.time))), [st.assays, id])
  const tasks = useMemo(() => st.tasks.filter((t) => t.seedingId === id).sort((a, b) => (a.date < b.date ? -1 : 1)), [st.tasks, id])

  if (!seeding) {
    return (
      <div className="card mx-auto max-w-xl">
        <EmptyState icon={<FlaskConical className="size-5" />} title="播種記録が見つかりません" action={<button className="btn-secondary" onClick={() => navigate({ view: 'seedings' })}>一覧へ戻る</button>} />
      </div>
    )
  }

  const duplicate = () => {
    const { lineId, plateType, passageNumber, density, wells, purpose, notes } = seeding
    const newId = st.addSeeding({ lineId, plateType, passageNumber, density, wells, purpose, notes, date: today })
    toast('播種記録を複製しました（播種日は今日）')
    navigate({ view: 'seedings', id: newId })
    open({ kind: 'seeding', id: newId })
  }

  const day = cultureDay(seeding.date, today)

  return (
    <div className="mx-auto max-w-5xl">
      <button className="btn-ghost btn-sm -ml-2 mb-3" onClick={() => navigate({ view: 'seedings' })}>
        <ArrowLeft className="size-4" />
        播種記録一覧
      </button>

      <div className="card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 p-5">
          <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl py-2" style={{ backgroundColor: `${line?.color ?? '#94a3b8'}18`, color: line?.color }}>
            <span className="text-[11px] font-semibold">Day</span>
            <span className="text-2xl font-bold leading-none">{day}</span>
          </div>
          <div className="min-w-0 flex-1">
            <button className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700" onClick={() => line && navigate({ view: 'lines', id: line.id })}>
              {line && <LineDot color={line.color} />}
              {line?.name ?? '(削除済み)'}
              {seeding.passageNumber !== null && <span className="font-mono text-xs">· P{seeding.passageNumber}</span>}
            </button>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {fmt(seeding.date, 'M/d (E)')} 播種 · {seeding.plateType}
            </h1>
            {seeding.purpose && <p className="mt-1 text-sm text-slate-600">{seeding.purpose}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={duplicate} title="同条件で新しい播種記録を作成">
              <Copy className="size-4" />
              複製
            </button>
            <button className="btn-secondary" onClick={() => open({ kind: 'seeding', id: seeding.id })}>
              <Pencil className="size-4" />
              編集
            </button>
            <button className="btn-primary" onClick={() => open({ kind: 'assay', seedingId: seeding.id })}>
              <Plus className="size-4" />
              アッセイ
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
          <span className="mr-1 text-xs text-slate-500">状態:</span>
          {(Object.keys(SEEDING_STATUS_META) as SeedingStatus[]).map((k) => (
            <button
              key={k}
              onClick={() => st.updateSeeding(seeding.id, { status: k })}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition',
                seeding.status === k ? SEEDING_STATUS_META[k].className : 'bg-white text-slate-500 ring-slate-200 hover:bg-slate-50',
              )}
            >
              {SEEDING_STATUS_META[k].label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 p-5 text-sm sm:grid-cols-4">
          <KV k="播種日" v={fmt(seeding.date, 'yyyy/M/d (E)')} />
          <KV k="プレート" v={seeding.plateType || '—'} />
          <KV k="播種密度" v={seeding.density || '—'} />
          <KV k="使用ウェル" v={seeding.wells || '—'} />
          {seeding.notes && <KV k="メモ" v={seeding.notes} className="col-span-2 sm:col-span-4" />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Section title={`アッセイ (${assays.filter((a) => a.done).length}/${assays.length})`} icon={<Beaker className="size-4 text-pink-600" />} right={<button className="btn-ghost btn-sm text-brand-700" onClick={() => open({ kind: 'assay', seedingId: seeding.id })}><Plus className="size-3.5" />追加</button>}>
            {assays.length === 0 ? (
              <EmptyState icon={<Beaker className="size-5" />} title="アッセイ予定はまだありません" action={<button className="btn-secondary btn-sm" onClick={() => open({ kind: 'assay', seedingId: seeding.id })}>アッセイを予定</button>} />
            ) : (
              <div className="relative px-3 pb-2">
                <div className="absolute bottom-5 left-[21px] top-4 w-px bg-slate-200" />
                {assays.map((a) => {
                  const overdue = !a.done && a.date < today
                  const isToday = a.date === today
                  return (
                    <div key={a.id} className="group relative flex cursor-pointer items-start gap-3 rounded-xl py-2.5 pr-2 hover:bg-slate-50" onClick={() => open({ kind: 'assay', id: a.id })}>
                      <div className="relative z-10 mt-0.5 bg-white">
                        <Checkbox checked={a.done} onChange={() => st.setAssayDone(a.id, !a.done)} color="#db2777" label="実施済み" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className={cx('text-sm font-semibold text-slate-800', a.done && 'text-slate-400 line-through')}>{a.name}</span>
                          <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">Day {cultureDay(seeding.date, a.date)}</span>
                        </div>
                        <div className={cx('text-xs', overdue ? 'font-medium text-rose-600' : isToday ? 'font-medium text-pink-600' : 'text-slate-500')}>
                          {fmt(a.date, 'M/d (E)')}
                          {a.time && ` ${a.time}`} · {a.done ? `完了${a.doneAt ? ` (${fmt(a.doneAt.slice(0, 10), 'M/d')})` : ''}` : relativeLabel(a.date)}
                        </div>
                        {a.notes && <div className="mt-0.5 text-xs text-slate-500">{a.notes}</div>}
                        {a.result && <div className="mt-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-800">結果: {a.result}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="培地交換・その他" icon={<Droplets className="size-4 text-amber-600" />} right={<button className="btn-ghost btn-sm text-brand-700" onClick={() => open({ kind: 'task', lineId: seeding.lineId, seedingId: seeding.id, taskKind: 'medium' })}><Plus className="size-3.5" />追加</button>}>
            {tasks.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">予定はありません</p>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50" onClick={() => open({ kind: 'task', id: t.id })}>
                  <Checkbox checked={t.done} onChange={() => st.updateTask(t.id, { done: !t.done })} color="#ca8a04" />
                  <span className={cx('flex-1 text-sm', t.done ? 'text-slate-400 line-through' : 'text-slate-700')}>{t.title}</span>
                  <span className={cx('text-xs', !t.done && t.date < today ? 'font-medium text-rose-600' : 'text-slate-500')}>
                    {fmt(t.date, 'M/d')} · Day {cultureDay(seeding.date, t.date)}
                  </span>
                </div>
              ))
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function KV({ k, v, className }: { k: string; v: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-slate-400">{k}</div>
      <div className="whitespace-pre-wrap font-medium text-slate-700">{v}</div>
    </div>
  )
}
