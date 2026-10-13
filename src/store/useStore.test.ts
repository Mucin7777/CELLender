import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from './useStore'
import { buildCalendarEvents } from '../lib/events'
import { selectData } from './useStore'

const s = () => useStore.getState()

const newLine = () =>
  s().addLine({
    name: 'Caco-2', origin: '', lot: '', color: '#000', passageNumber: 10, lastPassageDate: '2026-10-01',
    passageIntervalDays: 3, nextPassageDate: '2026-10-04', medium: '', vessel: '', notes: '',
  })

beforeEach(() => s().clearAll())

describe('passages', () => {
  it('increments passage number and schedules next date from interval', () => {
    const id = newLine()
    s().recordPassage(id, { date: '2026-10-05', splitRatio: '1:8', notes: '' })
    const line = s().lines.find((l) => l.id === id)!
    expect(line.passageNumber).toBe(11)
    expect(line.lastPassageDate).toBe('2026-10-05')
    expect(line.nextPassageDate).toBe('2026-10-08')
    expect(s().passages).toHaveLength(1)
    expect(s().passages[0].passageNumber).toBe(11)
  })

  it('reverts the line when the latest passage is deleted', () => {
    const id = newLine()
    s().recordPassage(id, { date: '2026-10-05', splitRatio: '', notes: '' })
    s().recordPassage(id, { date: '2026-10-08', splitRatio: '', notes: '' })
    const latest = s().passages.find((p) => p.passageNumber === 12)!
    s().deletePassage(latest.id)
    const line = s().lines.find((l) => l.id === id)!
    expect(line.passageNumber).toBe(11)
    expect(line.lastPassageDate).toBe('2026-10-05')
    expect(line.nextPassageDate).toBe('2026-10-08')
  })

  it('deleting a line cascades to its records', () => {
    const id = newLine()
    s().recordPassage(id, { date: '2026-10-05', splitRatio: '', notes: '' })
    const sid = s().addSeeding({ lineId: id, date: '2026-10-05', plateType: '96', passageNumber: 11, density: '', wells: '', purpose: '', notes: '' })
    s().addAssay({ seedingId: sid, date: '2026-10-07', time: '', name: 'MTT', notes: '' })
    s().deleteLine(id)
    expect(s().passages).toHaveLength(0)
    expect(s().seedings).toHaveLength(0)
    expect(s().assays).toHaveLength(0)
  })
})

describe('seeding status sync', () => {
  it('follows assay lifecycle', () => {
    const id = newLine()
    const sid = s().addSeeding({ lineId: id, date: '2026-10-05', plateType: '96', passageNumber: 11, density: '', wells: '', purpose: '', notes: '' })
    const status = () => s().seedings.find((x) => x.id === sid)!.status
    expect(status()).toBe('culturing')
    const a1 = s().addAssay({ seedingId: sid, date: '2026-10-07', time: '', name: 'A', notes: '' })
    const a2 = s().addAssay({ seedingId: sid, date: '2026-10-08', time: '', name: 'B', notes: '' })
    expect(status()).toBe('assay_scheduled')
    s().setAssayDone(a1, true)
    expect(status()).toBe('assay_scheduled')
    s().setAssayDone(a2, true)
    expect(status()).toBe('completed')
    s().setAssayDone(a2, false)
    expect(status()).toBe('assay_scheduled')
    s().deleteAssay(a1)
    s().deleteAssay(a2)
    expect(status()).toBe('culturing')
  })

  it('does not touch discarded seedings', () => {
    const id = newLine()
    const sid = s().addSeeding({ lineId: id, date: '2026-10-05', plateType: '96', passageNumber: 11, density: '', wells: '', purpose: '', notes: '' })
    s().updateSeeding(sid, { status: 'discarded' })
    s().addAssay({ seedingId: sid, date: '2026-10-07', time: '', name: 'A', notes: '' })
    expect(s().seedings[0].status).toBe('discarded')
  })
})

describe('calendar events', () => {
  it('builds events for plans, passages, seedings, assays and can move them', () => {
    const id = newLine()
    s().recordPassage(id, { date: '2026-10-05', splitRatio: '', notes: '' })
    const sid = s().addSeeding({ lineId: id, date: '2026-10-05', plateType: '96', passageNumber: 11, density: '', wells: '', purpose: '', notes: '' })
    s().addAssay({ seedingId: sid, date: '2026-10-07', time: '', name: 'MTT', notes: '' })
    const events = buildCalendarEvents(selectData(s()))
    expect(events.map((e) => e.type).sort()).toEqual(['assay', 'passage_done', 'passage_plan', 'seeding'])

    const plan = events.find((e) => e.type === 'passage_plan')!
    expect(plan.date).toBe('2026-10-08')
    s().moveEvent(plan, '2026-10-09')
    expect(s().lines[0].nextPassageDate).toBe('2026-10-09')

    const assay = events.find((e) => e.type === 'assay')!
    s().moveEvent(assay, '2026-10-10')
    expect(s().assays[0].date).toBe('2026-10-10')
  })

  it('hides passage plans of archived lines', () => {
    const id = newLine()
    s().updateLine(id, { archived: true })
    expect(buildCalendarEvents(selectData(s())).filter((e) => e.type === 'passage_plan')).toHaveLength(0)
  })
})
