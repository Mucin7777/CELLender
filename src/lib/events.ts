import type { AppData, CalendarEvent, DateStr } from '../types'
import { todayStr } from './date'

/** AppData からカレンダー表示用のイベント一覧を生成する */
export function buildCalendarEvents(data: AppData): CalendarEvent[] {
  const lineById = new Map(data.lines.map((l) => [l.id, l]))
  const seedingById = new Map(data.seedings.map((s) => [s.id, s]))
  const events: CalendarEvent[] = []

  for (const line of data.lines) {
    if (line.archived || !line.nextPassageDate) continue
    events.push({
      key: `pp-${line.id}`,
      type: 'passage_plan',
      date: line.nextPassageDate,
      title: line.name,
      subtitle: `P${line.passageNumber} → P${line.passageNumber + 1}`,
      lineId: line.id,
      refId: line.id,
      done: false,
      movable: true,
    })
  }

  for (const p of data.passages) {
    const line = lineById.get(p.lineId)
    if (!line) continue
    events.push({
      key: `pd-${p.id}`,
      type: 'passage_done',
      date: p.date,
      title: line.name,
      subtitle: `P${p.passageNumber}${p.splitRatio ? ` (${p.splitRatio})` : ''}`,
      lineId: line.id,
      refId: p.id,
      done: true,
      movable: false,
    })
  }

  for (const s of data.seedings) {
    const line = lineById.get(s.lineId)
    events.push({
      key: `sd-${s.id}`,
      type: 'seeding',
      date: s.date,
      title: line?.name ?? '(削除されたライン)',
      subtitle: s.plateType,
      lineId: s.lineId,
      seedingId: s.id,
      refId: s.id,
      done: s.date <= todayStr(),
      movable: true,
    })
  }

  for (const a of data.assays) {
    const s = seedingById.get(a.seedingId)
    const line = s ? lineById.get(s.lineId) : undefined
    events.push({
      key: `as-${a.id}`,
      type: 'assay',
      date: a.date,
      title: a.name || 'アッセイ',
      subtitle: [line?.name, s?.plateType].filter(Boolean).join(' / '),
      lineId: s?.lineId ?? null,
      seedingId: a.seedingId,
      refId: a.id,
      done: a.done,
      movable: !a.done,
    })
  }

  for (const t of data.tasks) {
    const line = t.lineId ? lineById.get(t.lineId) : undefined
    events.push({
      key: `tk-${t.id}`,
      type: t.kind,
      date: t.date,
      title: t.title,
      subtitle: line?.name,
      lineId: t.lineId,
      seedingId: t.seedingId ?? undefined,
      refId: t.id,
      done: t.done,
      movable: !t.done,
    })
  }

  return events.sort(compareEvents)
}

const TYPE_ORDER: Record<CalendarEvent['type'], number> = {
  passage_plan: 0,
  assay: 1,
  seeding: 2,
  medium: 3,
  other: 4,
  passage_done: 5,
}

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.done !== b.done) return a.done ? 1 : -1
  return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.title.localeCompare(b.title, 'ja')
}

export function groupByDate(events: CalendarEvent[]): Map<DateStr, CalendarEvent[]> {
  const map = new Map<DateStr, CalendarEvent[]>()
  for (const e of events) {
    const arr = map.get(e.date)
    if (arr) arr.push(e)
    else map.set(e.date, [e])
  }
  return map
}
