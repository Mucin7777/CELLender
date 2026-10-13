import { useMemo, useState } from 'react'
import { ChevronLeft, FlaskConical, GitBranch, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUI, confirmDialog } from '../store/useUI'
import { cultureLabel, diffDays, fmt, relativeLabel, todayStr } from '../lib/date'
import { navigate } from '../lib/router'
import type { CellLine } from '../types'
import { lineTone } from '../lib/color'
import { EmptyState, List, PageTitle, Row, SectionLabel, StatusBadge, cx } from '../components/ui'

export function LinesView({ id }: { id?: string }) {
  return id ? <LineDetail id={id} /> : <LineList />
}

/** 次回継代までの状態を小さなラベルで表す */
export function DuePill({ line }: { line: CellLine }) {
  if (!line.nextPassageDate) return <span className="text-[13px] text-faint">予定なし</span>
  const d = diffDays(todayStr(), line.nextPassageDate)
  const [label, cls] =
    d < 0 ? [`${-d}日超過`, 'bg-danger-soft text-danger'] : d === 0 ? ['今日', 'bg-amber-50 text-amber-700'] : d === 1 ? ['明日', 'bg-mint-soft text-ink'] : [`${d}日後`, 'text-sub']
  return <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[13px] font-semibold', cls)}>{label}</span>
}

/** ライン色の角丸に P 数を入れたアイコン */
export function PBadge({ line, size = 'md' }: { line: CellLine; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cx('flex shrink-0 items-center justify-center rounded-xl font-num font-semibold tabular-nums', size === 'lg' ? 'h-14 min-w-14 px-2 text-[20px]' : 'h-10 min-w-10 px-1 text-[13px]')}
      style={{ backgroundColor: lineTone(line.color).pale, color: lineTone(line.color).deep }}
    >
      P{line.passageNumber}
    </span>
  )
}

function LineList() {
  const lines = useStore((s) => s.lines)
  const open = useUI((s) => s.open)
  const [showArchived, setShowArchived] = useState(false)
  const sorted = useMemo(
    () => [...lines].sort((a, b) => (a.nextPassageDate ?? '9999').localeCompare(b.nextPassageDate ?? '9999') || a.name.localeCompare(b.name, 'ja')),
    [lines],
  )
  const active = sorted.filter((l) => !l.archived)
  const archived = sorted.filter((l) => l.archived)

  return (
    <div>
      <PageTitle
        title="細胞ライン"
        right={
          <button className="icon-btn border border-hair bg-white text-teal-dark" onClick={() => open({ kind: 'line' })} aria-label="ラインを追加">
            <Plus className="size-5" />
          </button>
        }
      />
      {active.length === 0 ? (
        <div className="group-card">
          <EmptyState
            icon={<GitBranch className="size-8" />}
            title="細胞ラインがありません"
            description="維持している細胞を登録すると、継代の予定が自動で入ります。"
            action={<button className="btn-primary" onClick={() => open({ kind: 'line' })}>ラインを追加</button>}
          />
        </div>
      ) : (
        <>
          <p className="mb-2 px-1 text-[13px] text-sub">次の継代が近い順</p>
          <List>
            {active.map((l) => (
              <Row
                key={l.id}
                onClick={() => navigate({ view: 'lines', id: l.id })}
                left={<PBadge line={l} />}
                title={l.name}
                sub={l.nextPassageDate ? `次回 ${fmt(l.nextPassageDate, 'M/d (E)')}` : '次回予定なし'}
                right={<DuePill line={l} />}
                chevron
              />
            ))}
          </List>
        </>
      )}
      {archived.length > 0 && (
        <>
          <button className="mt-6 min-h-11 px-1 text-[14px] font-semibold text-sub" onClick={() => setShowArchived((v) => !v)}>
            アーカイブ（{archived.length}）{showArchived ? 'を隠す' : 'を表示'}
          </button>
          {showArchived && (
            <List>
              {archived.map((l) => (
                <Row key={l.id} dim onClick={() => navigate({ view: 'lines', id: l.id })} left={<PBadge line={l} />} title={l.name} chevron />
              ))}
            </List>
          )}
        </>
      )}
    </div>
  )
}

function LineDetail({ id }: { id: string }) {
  const st = useStore()
  const { open, toast } = useUI()
  const today = todayStr()
  const line = st.lines.find((l) => l.id === id)
  const passages = useMemo(
    () => st.passages.filter((p) => p.lineId === id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.passageNumber - a.passageNumber)),
    [st.passages, id],
  )
  const seedings = useMemo(() => st.seedings.filter((s) => s.lineId === id).sort((a, b) => (a.date < b.date ? 1 : -1)), [st.seedings, id])
  const [allHistory, setAllHistory] = useState(false)

  const back = (
    <button className="flex min-h-11 items-center px-2 text-[15px] font-semibold text-teal-dark" onClick={() => navigate({ view: 'lines' })}>
      <ChevronLeft className="size-5" />
      細胞ライン
    </button>
  )

  if (!line) return <EmptyState title="細胞ラインが見つかりません" action={back} />

  return (
    <div>
      <PageTitle
        back={back}
        title={line.name}
        sub={[line.origin, line.lot].filter(Boolean).join(' · ') || undefined}
        right={<button className="btn-ghost btn-sm" onClick={() => open({ kind: 'line', id: line.id })}>編集</button>}
      />

      {/* 主要情報と主アクション */}
      <div className="group-card p-4">
        <div className="flex items-center gap-4">
          <PBadge line={line} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-sub">次回の継代</div>
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-bold">{line.nextPassageDate ? fmt(line.nextPassageDate, 'M/d (E)') : '—'}</span>
              <DuePill line={line} />
            </div>
          </div>
        </div>
        {line.archived ? (
          <button className="btn-secondary mt-4 w-full" onClick={() => st.updateLine(line.id, { archived: false })}>
            アーカイブから戻す
          </button>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => open({ kind: 'passage', lineId: line.id })}>
              <GitBranch className="size-4.5" />
              継代する
            </button>
            <button className="btn-secondary" onClick={() => open({ kind: 'seeding', lineId: line.id })}>
              <FlaskConical className="size-4.5" />
              播種する
            </button>
          </div>
        )}
      </div>

      <List className="mt-3">
        <Row title="前回の継代" right={<span className="text-[15px] text-sub">{line.lastPassageDate ? `${fmt(line.lastPassageDate, 'M/d (E)')}・${relativeLabel(line.lastPassageDate)}` : '—'}</span>} />
        <label className="flex min-h-14 items-center gap-3 px-4">
          <span className="flex-1 text-[15px] font-semibold">次回の予定日</span>
          <input
            type="date"
            className="rounded-lg bg-canvas px-2 py-1.5 text-[15px] outline-none focus:ring-2 focus:ring-teal"
            value={line.nextPassageDate ?? ''}
            onChange={(e) => st.updateLine(line.id, { nextPassageDate: e.target.value || null })}
          />
        </label>
        <Row title="継代間隔" right={<span className="text-[15px] text-sub">{line.passageIntervalDays ? `${line.passageIntervalDays} 日` : '—'}</span>} />
        {line.medium && <Row title="培地" right={<span className="truncate text-[15px] text-sub">{line.medium}</span>} />}
        {line.vessel && <Row title="培養容器" right={<span className="truncate text-[15px] text-sub">{line.vessel}</span>} />}
      </List>
      {line.notes && <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-[14px]">{line.notes}</p>}

      <SectionLabel
        right={!line.archived && (
          <button className="flex min-h-9 items-center gap-0.5 text-[13px] font-semibold text-teal-dark" onClick={() => open({ kind: 'seeding', lineId: line.id })}>
            <Plus className="size-4" />
            播種
          </button>
        )}
      >
        播種記録
      </SectionLabel>
      {seedings.length === 0 ? (
        <div className="group-card py-6 text-center text-[14px] text-sub">まだありません</div>
      ) : (
        <List>
          {seedings.map((s) => {
            const active = s.status === 'culturing' || s.status === 'assay_scheduled'
            return (
              <Row
                key={s.id}
                onClick={() => navigate({ view: 'seedings', id: s.id })}
                title={`${fmt(s.date, 'M/d')} · ${s.plateType}`}
                sub={[active && cultureLabel(s.date, today), s.purpose].filter(Boolean).join(' · ') || undefined}
                right={<StatusBadge status={s.status} />}
                chevron
              />
            )
          })}
        </List>
      )}

      <SectionLabel>継代履歴</SectionLabel>
      {passages.length === 0 ? (
        <div className="group-card py-6 text-center text-[14px] text-sub">「継代する」を押すと記録されます</div>
      ) : (
        <List>
          {(allHistory ? passages : passages.slice(0, 5)).map((p, i) => (
            <Row
              key={p.id}
              left={<span className={cx('w-12 font-num text-[14px] font-semibold tabular-nums', i === 0 ? '' : 'text-sub')} style={i === 0 ? { color: lineTone(line.color).deep } : undefined}>P{p.passageNumber}</span>}
              title={fmt(p.date, 'yyyy/M/d (E)')}
              sub={[p.splitRatio, p.notes].filter(Boolean).join(' · ') || undefined}
              right={
                i === 0 && (
                  <button
                    className="btn-sm btn text-sub"
                    onClick={() =>
                      confirmDialog({
                        title: 'この継代を取り消しますか？',
                        message: 'P数と予定日も元に戻ります。',
                        confirmLabel: '取り消す',
                        danger: true,
                        onConfirm: () => {
                          st.deletePassage(p.id)
                          toast('継代記録を取り消しました')
                        },
                      })
                    }
                  >
                    取り消し
                  </button>
                )
              }
            />
          ))}
          {passages.length > 5 && !allHistory && (
            <button className="min-h-12 w-full text-[14px] font-semibold text-teal-dark" onClick={() => setAllHistory(true)}>
              すべて表示（{passages.length}件）
            </button>
          )}
        </List>
      )}

      {!line.archived && (
        <button
          className="mt-6 min-h-11 w-full text-[15px] font-semibold text-sub"
          onClick={() => {
            st.updateLine(line.id, { archived: true })
            toast('アーカイブしました')
            navigate({ view: 'lines' })
          }}
        >
          このラインをアーカイブ
        </button>
      )}
    </div>
  )
}
