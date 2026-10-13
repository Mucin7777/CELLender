import { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, ArrowLeft, Beaker, FlaskConical, GitBranch, History, Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { cultureDay, diffDays, fmt, relativeLabel, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import type { CellLine } from '../types'
import { EmptyState, PageHeader, Segmented, StatusBadge, cx } from '../components/ui'
import { Section } from './TodayView'

export function LinesView({ id }: { id?: string }) {
  return id ? <LineDetail id={id} /> : <LineList />
}

function dueState(line: CellLine, today: string) {
  if (!line.nextPassageDate) return { label: '予定なし', cls: 'text-slate-400 bg-slate-100' }
  const d = diffDays(today, line.nextPassageDate)
  if (d < 0) return { label: `${-d}日超過`, cls: 'text-rose-700 bg-rose-100' }
  if (d === 0) return { label: '今日継代', cls: 'text-amber-800 bg-amber-100' }
  if (d === 1) return { label: '明日', cls: 'text-teal-800 bg-teal-100' }
  return { label: `${d}日後`, cls: 'text-slate-600 bg-slate-100' }
}

function LineList() {
  const lines = useStore((s) => s.lines)
  const seedings = useStore((s) => s.seedings)
  const open = useUI((s) => s.open)
  const today = todayStr()
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const shown = useMemo(
    () =>
      lines
        .filter((l) => (tab === 'active' ? !l.archived : l.archived))
        .sort((a, b) => (a.nextPassageDate ?? '9999') .localeCompare(b.nextPassageDate ?? '9999') || a.name.localeCompare(b.name, 'ja')),
    [lines, tab],
  )
  const archivedCount = lines.filter((l) => l.archived).length

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="細胞ライン"
        subtitle="継代中の細胞ライン・ロットを管理します（次回継代が近い順）"
        actions={
          <button className="btn-primary" onClick={() => open({ kind: 'line' })}>
            <Plus className="size-4" />
            ラインを追加
          </button>
        }
      />
      {archivedCount > 0 && (
        <div className="mb-4">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'active', label: '使用中' }, { value: 'archived', label: `アーカイブ (${archivedCount})` }]} />
        </div>
      )}
      {shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<GitBranch className="size-5" />}
            title={tab === 'active' ? '細胞ラインがありません' : 'アーカイブはありません'}
            description="「ヒト回腸 Lot1」「Caco-2」など、維持している細胞を登録しましょう。"
            action={tab === 'active' && <button className="btn-primary" onClick={() => open({ kind: 'line' })}><Plus className="size-4" />ラインを追加</button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((l) => {
            const ds = dueState(l, today)
            const active = seedings.filter((s) => s.lineId === l.id && (s.status === 'culturing' || s.status === 'assay_scheduled')).length
            const elapsed = l.lastPassageDate ? diffDays(l.lastPassageDate, today) : null
            const progress = elapsed !== null && l.passageIntervalDays > 0 ? Math.min(1, Math.max(0, elapsed / l.passageIntervalDays)) : null
            return (
              <div key={l.id} onClick={() => navigate({ view: 'lines', id: l.id })} className="card group cursor-pointer overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="h-1.5" style={{ backgroundColor: l.color }} />
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-bold text-slate-900">{l.name}</div>
                      <div className="truncate text-xs text-slate-500">{[l.origin, l.lot].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    <div className="rounded-lg px-2 py-1 font-mono text-lg font-bold leading-none" style={{ color: l.color, backgroundColor: `${l.color}14` }}>
                      P{l.passageNumber}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-slate-400">前回継代</div>
                      <div className="font-medium text-slate-700">{l.lastPassageDate ? `${fmt(l.lastPassageDate, 'M/d (E)')}` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">次回予定</div>
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        {l.nextPassageDate ? fmt(l.nextPassageDate, 'M/d (E)') : '—'}
                        <span className={cx('rounded px-1.5 py-px text-[10px] font-semibold', ds.cls)}>{ds.label}</span>
                      </div>
                    </div>
                  </div>
                  {progress !== null && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progress * 100}%`, backgroundColor: progress >= 1 ? '#e11d48' : l.color }} />
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">
                        継代後 {elapsed} 日 / 間隔 {l.passageIntervalDays} 日
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      className="btn-primary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        open({ kind: 'passage', lineId: l.id })
                      }}
                      disabled={l.archived}
                    >
                      <GitBranch className="size-3.5" />
                      継代する
                    </button>
                    <button
                      className="btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        open({ kind: 'seeding', lineId: l.id })
                      }}
                      disabled={l.archived}
                    >
                      <FlaskConical className="size-3.5" />
                      播種
                    </button>
                    {active > 0 && <span className="ml-auto text-xs text-slate-500">培養中 {active}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LineDetail({ id }: { id: string }) {
  const st = useStore()
  const { open, toast } = useUI()
  const line = st.lines.find((l) => l.id === id)
  const today = todayStr()
  const passages = useMemo(() => st.passages.filter((p) => p.lineId === id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.passageNumber - a.passageNumber)), [st.passages, id])
  const seedings = useMemo(() => st.seedings.filter((s) => s.lineId === id).sort((a, b) => (a.date < b.date ? 1 : -1)), [st.seedings, id])

  if (!line) {
    return (
      <div className="card mx-auto max-w-xl">
        <EmptyState icon={<GitBranch className="size-5" />} title="細胞ラインが見つかりません" action={<button className="btn-secondary" onClick={() => navigate({ view: 'lines' })}>一覧へ戻る</button>} />
      </div>
    )
  }
  const ds = dueState(line, today)

  return (
    <div className="mx-auto max-w-5xl">
      <button className="btn-ghost btn-sm -ml-2 mb-3" onClick={() => navigate({ view: 'lines' })}>
        <ArrowLeft className="size-4" />
        細胞ライン一覧
      </button>

      <div className="card mb-5 overflow-hidden">
        <div className="h-2" style={{ backgroundColor: line.color }} />
        <div className="flex flex-wrap items-start gap-4 p-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{line.name}</h1>
              {line.archived && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">アーカイブ</span>}
            </div>
            <div className="mt-1 text-sm text-slate-500">{[line.origin, line.lot].filter(Boolean).join(' · ') || '—'}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => open({ kind: 'line', id: line.id })}>
              <Pencil className="size-4" />
              編集
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                st.updateLine(line.id, { archived: !line.archived })
                toast(line.archived ? 'アーカイブを解除しました' : 'アーカイブしました（カレンダーの継代予定は非表示になります）')
              }}
            >
              {line.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              {line.archived ? '復元' : 'アーカイブ'}
            </button>
            {!line.archived && (
              <>
                <button className="btn-secondary" onClick={() => open({ kind: 'seeding', lineId: line.id })}>
                  <FlaskConical className="size-4" />
                  播種を記録
                </button>
                <button className="btn-primary" onClick={() => open({ kind: 'passage', lineId: line.id })}>
                  <GitBranch className="size-4" />
                  継代を記録
                </button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
          <Info label="現在の継代数" value={<span className="font-mono text-xl" style={{ color: line.color }}>P{line.passageNumber}</span>} />
          <Info label="前回継代" value={line.lastPassageDate ? `${fmt(line.lastPassageDate, 'M/d (E)')}` : '—'} sub={line.lastPassageDate ? relativeLabel(line.lastPassageDate) : undefined} />
          <Info
            label="次回継代予定"
            value={
              <input
                type="date"
                className="-ml-1 rounded-md border border-transparent bg-transparent px-1 font-semibold text-slate-800 hover:border-slate-200 focus:border-brand-500 focus:outline-none"
                value={line.nextPassageDate ?? ''}
                onChange={(e) => st.updateLine(line.id, { nextPassageDate: e.target.value || null })}
              />
            }
            sub={<span className={cx('rounded px-1.5 py-px text-[10px] font-semibold', ds.cls)}>{ds.label}</span>}
          />
          <Info label="継代間隔" value={line.passageIntervalDays ? `${line.passageIntervalDays} 日` : '—'} />
        </div>
        {(line.medium || line.vessel || line.notes) && (
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-5 text-sm sm:grid-cols-3">
            {line.medium && <KV k="培地" v={line.medium} />}
            {line.vessel && <KV k="培養容器" v={line.vessel} />}
            {line.notes && <KV k="メモ" v={line.notes} className="sm:col-span-3" />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title={`播種記録 (${seedings.length})`} icon={<FlaskConical className="size-4 text-blue-600" />} right={!line.archived && <button className="btn-ghost btn-sm text-brand-700" onClick={() => open({ kind: 'seeding', lineId: line.id })}><Plus className="size-3.5" />播種</button>}>
          {seedings.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">まだ播種記録はありません</p>
          ) : (
            seedings.map((s) => {
              const sa = st.assays.filter((a) => a.seedingId === s.id)
              const active = s.status === 'culturing' || s.status === 'assay_scheduled'
              return (
                <button key={s.id} onClick={() => navigate({ view: 'seedings', id: s.id })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-sm font-bold text-slate-800">{fmt(s.date, 'M/d')}</div>
                    <div className="text-[10px] text-slate-400">{active ? `Day ${cultureDay(s.date, today)}` : fmt(s.date, 'yyyy')}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">{s.plateType}</div>
                    <div className="truncate text-xs text-slate-500">
                      {s.purpose || '—'}
                      {s.passageNumber !== null && ` · P${s.passageNumber}`}
                    </div>
                  </div>
                  {sa.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Beaker className="size-3" />
                      {sa.filter((a) => a.done).length}/{sa.length}
                    </span>
                  )}
                  <StatusBadge status={s.status} />
                </button>
              )
            })
          )}
        </Section>

        <Section title={`継代履歴 (${passages.length})`} icon={<History className="size-4 text-slate-500" />}>
          {passages.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">「継代を記録」で履歴が残ります</p>
          ) : (
            <div className="relative px-3 pb-2">
              <div className="absolute bottom-4 left-[29px] top-3 w-px bg-slate-200" />
              {passages.map((p, i) => (
                <div key={p.id} className="group relative flex items-start gap-3 py-2">
                  <div className={cx('relative z-10 flex h-6 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold', i === 0 ? 'text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200')} style={i === 0 ? { backgroundColor: line.color } : undefined}>
                    P{p.passageNumber}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-slate-800">{fmt(p.date, 'yyyy/M/d (E)')}</span>
                      {p.splitRatio && <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{p.splitRatio}</span>}
                    </div>
                    {p.notes && <div className="mt-0.5 text-xs text-slate-500">{p.notes}</div>}
                  </div>
                  <button
                    className="icon-btn size-7 opacity-0 transition group-hover:opacity-100"
                    aria-label="取り消し"
                    title="この継代記録を削除"
                    onClick={() =>
                      confirmDialog({
                        title: '継代記録を削除',
                        message: i === 0 ? '最新の継代記録を削除すると、ラインの継代数・予定日も元に戻ります。' : 'この継代記録を削除します。',
                        confirmLabel: '削除',
                        danger: true,
                        onConfirm: () => st.deletePassage(p.id),
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function KV({ k, v, className }: { k: string; v: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-slate-400">{k}</div>
      <div className="whitespace-pre-wrap text-slate-700">{v}</div>
    </div>
  )
}

