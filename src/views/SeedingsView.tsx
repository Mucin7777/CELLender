import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, FlaskConical, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { SEEDING_STATUS_META } from '../lib/constants'
import { addDaysStr, cultureDay, cultureLabel, fmt, relativeLabel, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import { useCalendarEvents } from '../lib/useCalendarEvents'
import type { Seeding, SeedingStatus } from '../types'
import { EventRow } from '../components/EventRow'
import { lineTone } from '../lib/color'
import { Check, EmptyState, LineDot, List, PageTitle, Row, SectionLabel, Segmented, StatusBadge, cx } from '../components/ui'

export function SeedingsView({ id }: { id?: string }) {
  return id ? <SeedingDetail id={id} /> : <SeedingList />
}

type Tab = 'active' | 'assays' | 'done'
const isActive = (s: Seeding) => s.status === 'culturing' || s.status === 'assay_scheduled'

function SeedingList() {
  const { seedings, lines, assays } = useStore()
  const open = useUI((s) => s.open)
  const today = todayStr()
  const [tab, setTab] = useState<Tab>('active')
  const lineById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])

  const list = useMemo(
    () => seedings.filter((s) => (tab === 'active' ? isActive(s) : !isActive(s))).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [seedings, tab],
  )

  return (
    <div>
      <PageTitle
        title="播種"
        right={
          <button className="icon-btn border border-hair bg-white text-teal-dark" onClick={() => open({ kind: 'seeding' })} aria-label="播種を記録">
            <Plus className="size-5" />
          </button>
        }
      />
      <div className="mb-4">
        <Segmented
          full
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: `培養中 ${seedings.filter(isActive).length}` },
            { value: 'assays', label: 'アッセイ' },
            { value: 'done', label: '終了' },
          ]}
        />
      </div>

      {tab === 'assays' ? (
        <AssayTab />
      ) : list.length === 0 ? (
        <div className="group-card">
          <EmptyState
            icon={<FlaskConical className="size-8" />}
            title={tab === 'active' ? '培養中の播種はありません' : '終了した播種はありません'}
            action={tab === 'active' && <button className="btn-primary" onClick={() => open({ kind: 'seeding' })}>播種を記録</button>}
          />
        </div>
      ) : (
        <List>
          {list.map((s) => {
            const line = lineById.get(s.lineId)
            const next = assays.filter((a) => a.seedingId === s.id && !a.done).sort((a, b) => (a.date < b.date ? -1 : 1))[0]
            const active = isActive(s)
            return (
              <button key={s.id} onClick={() => navigate({ view: 'seedings', id: s.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-black/[.03]">
                <span
                  className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl leading-none"
                  style={{ backgroundColor: lineTone(line?.color).pale, color: lineTone(line?.color).deep }}
                >
                  {active ? (
                    <>
                      <span className="font-num text-[18px] font-semibold tabular-nums">{Math.abs(cultureDay(s.date, today))}</span>
                      <span className="mt-0.5 text-[10px] font-bold">{cultureDay(s.date, today) < 0 ? '日後' : '日目'}</span>
                    </>
                  ) : (
                    <span className="text-[13px] font-bold">{fmt(s.date, 'M/d')}</span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{line?.name ?? '(削除済み)'}</div>
                  <div className="truncate text-[13px] text-sub">
                    {s.plateType}
                    {s.purpose && ` · ${s.purpose}`}
                  </div>
                  {active && next && (
                    <div className={cx('mt-0.5 truncate text-[13px] font-medium', next.date <= today ? 'text-amber-700' : 'text-sub')}>
                      次: {next.name}（{relativeLabel(next.date)}）
                    </div>
                  )}
                </div>
                {!active && <StatusBadge status={s.status} />}
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </button>
            )
          })}
        </List>
      )}
    </div>
  )
}

/** アッセイの予定と実施履歴 */
function AssayTab() {
  const events = useCalendarEvents()
  const today = todayStr()
  const [historyCount, setHistoryCount] = useState(10)
  const assayEvents = events.filter((e) => e.type === 'assay')
  const pending = assayEvents.filter((e) => !e.done)
  const history = assayEvents.filter((e) => e.done).reverse()
  const tomorrow = addDaysStr(today, 1)
  const groups = [
    { title: '遅れている', tone: 'danger' as const, items: pending.filter((e) => e.date < today) },
    { title: '今日', items: pending.filter((e) => e.date === today) },
    { title: '明日', items: pending.filter((e) => e.date === tomorrow) },
    { title: 'それ以降', items: pending.filter((e) => e.date > tomorrow) },
  ].filter((g) => g.items.length > 0)

  return (
    <div>
      {groups.length === 0 && <div className="group-card py-8 text-center text-[14px] text-sub">予定されているアッセイはありません</div>}
      {groups.map((g, gi) => (
        <div key={g.title} className={gi > 0 ? 'mt-6' : undefined}>
          <SectionLabel tone={g.tone}>{g.title}</SectionLabel>
          <List>
            {g.items.map((e) => (
              <EventRow key={e.key} event={e} prefix={g.title === '今日' || g.title === '明日' ? undefined : fmt(e.date, 'M/d')} overdue={g.tone === 'danger'} />
            ))}
          </List>
        </div>
      ))}
      {history.length > 0 && (
        <>
          <SectionLabel>実施済み</SectionLabel>
          <List>
            {history.slice(0, historyCount).map((e) => (
              <EventRow key={e.key} event={e} prefix={fmt(e.date, 'M/d')} />
            ))}
            {history.length > historyCount && (
              <button className="min-h-12 w-full text-[14px] font-semibold text-teal-dark" onClick={() => setHistoryCount((n) => n + 20)}>
                さらに表示
              </button>
            )}
          </List>
        </>
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
  const assays = useMemo(
    () => st.assays.filter((a) => a.seedingId === id).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.time.localeCompare(b.time))),
    [st.assays, id],
  )
  const tasks = useMemo(() => st.tasks.filter((t) => t.seedingId === id).sort((a, b) => (a.date < b.date ? -1 : 1)), [st.tasks, id])
  const [showDoneTasks, setShowDoneTasks] = useState(false)

  const back = (
    <button className="flex min-h-11 items-center px-2 text-[15px] font-semibold text-teal-dark" onClick={() => navigate({ view: 'seedings' })}>
      <ChevronLeft className="size-5" />
      播種
    </button>
  )
  if (!seeding) return <EmptyState title="播種記録が見つかりません" action={back} />

  const duplicate = () => {
    const { lineId, plateType, passageNumber, density, wells, purpose, notes } = seeding
    const newId = st.addSeeding({ lineId, plateType, passageNumber, density, wells, purpose, notes, date: today })
    toast('同じ条件で今日の播種を作成しました')
    navigate({ view: 'seedings', id: newId })
  }
  const visibleTasks = showDoneTasks ? tasks : tasks.filter((t) => !t.done)

  return (
    <div>
      <PageTitle
        back={back}
        sub={`${fmt(seeding.date, 'M/d (E)')} 播種 · ${cultureLabel(seeding.date, today)}`}
        title={seeding.plateType}
        right={<button className="btn-ghost btn-sm" onClick={() => open({ kind: 'seeding', id: seeding.id })}>編集</button>}
      />

      <button
        className="group-card flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-black/[.03]"
        onClick={() => line && navigate({ view: 'lines', id: line.id })}
      >
        {line && <LineDot color={line.color} />}
        <span className="flex-1 truncate text-[15px] font-semibold">{line?.name ?? '(削除済み)'}</span>
        {seeding.passageNumber !== null && <span className="font-num text-[14px] text-sub">P{seeding.passageNumber}</span>}
        <ChevronRight className="size-4 text-faint" />
      </button>
      {seeding.purpose && <p className="mt-3 px-1 text-[15px]">{seeding.purpose}</p>}

      <div className="mt-4">
        <Segmented
          full
          value={seeding.status}
          onChange={(v) => st.updateSeeding(seeding.id, { status: v })}
          options={(Object.keys(SEEDING_STATUS_META) as SeedingStatus[]).map((k) => ({ value: k, label: SEEDING_STATUS_META[k].short }))}
        />
      </div>

      <SectionLabel
        right={
          <button className="flex min-h-9 items-center gap-0.5 text-[13px] font-semibold text-teal-dark" onClick={() => open({ kind: 'assay', seedingId: seeding.id })}>
            <Plus className="size-4" />
            追加
          </button>
        }
      >
        アッセイ {assays.length > 0 && <span className="font-normal text-faint">{assays.filter((a) => a.done).length}/{assays.length}</span>}
      </SectionLabel>
      {assays.length === 0 ? (
        <button className="group-card flex min-h-14 w-full items-center justify-center gap-1 text-[15px] font-semibold text-teal-dark" onClick={() => open({ kind: 'assay', seedingId: seeding.id })}>
          <Plus className="size-4" />
          アッセイを予定する
        </button>
      ) : (
        <List>
          {assays.map((a) => {
            const overdue = !a.done && a.date < today
            return (
              <div key={a.id} role="button" onClick={() => open({ kind: 'assay', id: a.id })} className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2.5 active:bg-black/[.03]">
                <div className={cx('min-w-0 flex-1', a.done && 'opacity-45')}>
                  <div className={cx('truncate text-[15px] font-semibold', a.done && 'line-through')}>{a.name}</div>
                  <div className={cx('mt-0.5 text-[13px]', overdue ? 'font-semibold text-danger' : 'text-sub')}>
                    {fmt(a.date, 'M/d (E)')}
                    {a.time && ` ${a.time}`} · {cultureLabel(seeding.date, a.date)} · {a.done ? '実施済み' : relativeLabel(a.date)}
                  </div>
                  {a.result && <div className="mt-0.5 truncate text-[13px] text-emerald-700">結果: {a.result}</div>}
                </div>
                <Check checked={a.done} onChange={() => st.setAssayDone(a.id, !a.done)} label="実施済み" />
              </div>
            )
          })}
        </List>
      )}

      {tasks.length > 0 && (
        <>
          <SectionLabel
            right={
              tasks.some((t) => t.done) && (
                <button className="min-h-9 text-[13px] font-semibold text-sub" onClick={() => setShowDoneTasks((v) => !v)}>
                  {showDoneTasks ? '完了を隠す' : '完了も表示'}
                </button>
              )
            }
          >
            培地交換など
          </SectionLabel>
          <List>
            {visibleTasks.length === 0 && <div className="py-4 text-center text-[14px] text-sub">残りの予定はありません</div>}
            {visibleTasks.map((t) => (
              <div key={t.id} role="button" onClick={() => open({ kind: 'task', id: t.id })} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 active:bg-black/[.03]">
                <span className={cx('flex-1 text-[15px]', t.done && 'text-faint line-through')}>{t.title}</span>
                <span className={cx('text-[13px]', !t.done && t.date < today ? 'font-semibold text-danger' : 'text-sub')}>
                  {fmt(t.date, 'M/d')}・{cultureLabel(seeding.date, t.date)}
                </span>
                <Check checked={t.done} onChange={() => st.updateTask(t.id, { done: !t.done })} />
              </div>
            ))}
          </List>
        </>
      )}

      {(seeding.density || seeding.wells || seeding.notes) && (
        <>
          <SectionLabel>詳細</SectionLabel>
          <List>
            {seeding.density && <Row title="播種密度" right={<span className="text-[15px] text-sub">{seeding.density}</span>} />}
            {seeding.wells && <Row title="ウェル数" right={<span className="text-[15px] text-sub">{seeding.wells}</span>} />}
            {seeding.notes && <p className="whitespace-pre-wrap px-4 py-3 text-[14px]">{seeding.notes}</p>}
          </List>
        </>
      )}

      <button className="mt-6 flex min-h-11 w-full items-center justify-center gap-1.5 text-[15px] font-semibold text-teal-dark" onClick={duplicate}>
        <Copy className="size-4" />
        同じ条件で今日また播種する
      </button>
    </div>
  )
}
