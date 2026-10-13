import { describe, expect, it } from 'vitest'
import { dayCounts, dueNotifications, zonedWallToUtc, type NData, type NotifySettings } from '../../supabase/functions/_shared/reminders'

const data: NData = {
  lines: [
    { id: 'L1', nextPassageDate: '2026-10-13' },
    { id: 'L2', nextPassageDate: '2026-10-13', archived: true }, // アーカイブ済み → 除外
  ],
  seedings: [
    { id: 'S1', lineId: 'L1', date: '2026-10-09', status: 'assay_scheduled' },
    { id: 'S2', lineId: 'L1', date: '2026-10-01', status: 'completed' }, // 完了 → 配下のアッセイ除外
    { id: 'S3', lineId: 'L1', date: '2026-10-13', status: 'culturing' }, // 今日の播種
  ],
  assays: [
    { id: 'A1', seedingId: 'S1', date: '2026-10-13', time: '10:00', done: false },
    { id: 'A2', seedingId: 'S1', date: '2026-10-13', time: '10:00', done: false },
    { id: 'A3', seedingId: 'S2', date: '2026-10-13', time: '11:00', done: false }, // 完了した播種
    { id: 'A4', seedingId: 'S1', date: '2026-10-13', time: '', done: false }, // 日付のみ → まとめに含む
    { id: 'A5', seedingId: 'S1', date: '2026-10-13', time: '15:00', done: true }, // 実施済み
    { id: 'A6', seedingId: 'gone', date: '2026-10-13', time: '16:00', done: false }, // 削除済みの播種
  ],
  tasks: [
    { id: 'T1', date: '2026-10-13', kind: 'medium', lineId: 'L1', seedingId: null, done: false },
    { id: 'T2', date: '2026-10-13', kind: 'other', lineId: null, seedingId: null, done: true },
  ],
}
const base: NotifySettings = { dailyEnabled: true, dailyTime: '09:00', assayLead: 30, timezone: 'Asia/Tokyo' }
const at = (iso: string) => new Date(iso)

describe('通知の判定', () => {
  it('タイムゾーンの壁時計を UTC に変換する', () => {
    expect(zonedWallToUtc('2026-10-13', '09:00', 'Asia/Tokyo')!.toISOString()).toBe('2026-10-13T00:00:00.000Z')
    // 夏時間で存在しない時刻（米国 2026-03-08 02:30）はスキップ
    expect(zonedWallToUtc('2026-03-08', '02:30', 'America/New_York')).toBeNull()
    expect(zonedWallToUtc('2026-03-08', '03:30', 'America/New_York')!.toISOString()).toBe('2026-03-08T07:30:00.000Z')
  })

  it('完了・アーカイブ・削除済みを除外して件数を数える', () => {
    const c = dayCounts(data, '2026-10-13')
    expect(c).toMatchObject({ passage: 1, seeding: 1, assay: 3, medium: 1, other: 0, total: 6 })
  })

  it('朝のまとめは設定時刻から 10 分以内に 1 件、本文は件数だけ', () => {
    const due = dueNotifications(data, base, at('2026-10-13T00:03:00Z')) // JST 09:03
    const daily = due.find((d) => d.key.startsWith('daily'))!
    expect(daily.key).toBe('daily:2026-10-13')
    expect(daily.url).toBe('#/day/2026-10-13')
    expect(daily.body).toBe('今日の予定は 6 件です（継代 1・播種 1・アッセイ 3・培地交換 1）')
    expect(daily.body).not.toMatch(/L1|S1/)
    expect(dueNotifications(data, base, at('2026-10-12T23:59:00Z')).some((d) => d.key.startsWith('daily'))).toBe(false) // 08:59
    expect(dueNotifications(data, base, at('2026-10-13T00:11:00Z')).some((d) => d.key.startsWith('daily'))).toBe(false) // 09:11（遅すぎ）
  })

  it('予定がない日はまとめを送らない', () => {
    expect(dueNotifications(data, base, at('2026-10-14T00:01:00Z')).length).toBe(0)
  })

  it('アッセイは開始 30 分前に、同じ時刻のものはまとめて 1 通', () => {
    const due = dueNotifications(data, { ...base, dailyEnabled: false }, at('2026-10-13T00:31:00Z')) // JST 09:31
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ key: 'assay:2026-10-13T10:00:30', title: 'アッセイまであと 30 分', body: '10:00 開始のアッセイが 2 件あります' })
  })

  it('開始時刻ちょうど・OFF の設定', () => {
    expect(dueNotifications(data, { ...base, dailyEnabled: false, assayLead: 0 }, at('2026-10-13T01:00:00Z'))[0].title).toBe('アッセイの時間です')
    expect(dueNotifications(data, { ...base, dailyEnabled: false, assayLead: null }, at('2026-10-13T01:00:00Z'))).toHaveLength(0)
  })
})
