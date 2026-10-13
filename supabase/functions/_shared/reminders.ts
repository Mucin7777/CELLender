/**
 * 通知の判定（サーバーの Edge Function とアプリのテストで共用する純粋な関数）
 *
 * - 毎日の予定まとめ：設定時刻（初期 09:00）に、その日の予定の件数だけを知らせる。予定がない日は送らない。
 * - 時刻指定アッセイ：開始の N 分前（または開始時刻）に知らせる。
 * - 完了・廃棄・アーカイブ済み・削除済みの対象は除外。日付だけの予定は朝のまとめに含める。
 * - ロック画面に細胞名や実験名を出さないよう、本文は件数と時刻だけにする。
 * - Cron が少し遅れても取り戻せるよう、予定時刻から最大 10 分以内なら送る（それより古いものは送らない）。
 */

// ---- データの型（アプリの AppData のうち通知に必要な部分） ----
export interface NLine {
  id: string
  archived?: boolean
  nextPassageDate?: string | null
}
export interface NSeeding {
  id: string
  lineId: string
  date: string
  status: 'culturing' | 'assay_scheduled' | 'completed' | 'discarded'
}
export interface NAssay {
  id: string
  seedingId: string
  date: string
  time?: string
  done: boolean
}
export interface NTask {
  id: string
  date: string
  kind: 'medium' | 'other'
  lineId: string | null
  seedingId: string | null
  done: boolean
}
export interface NData {
  lines?: NLine[]
  seedings?: NSeeding[]
  assays?: NAssay[]
  tasks?: NTask[]
}

export interface NotifySettings {
  dailyEnabled: boolean
  /** 'HH:MM' */
  dailyTime: string
  /** アッセイの何分前に知らせるか。0 = 開始時刻、null = 知らせない */
  assayLead: number | null
  /** IANA タイムゾーン（例: 'Asia/Tokyo'） */
  timezone: string
}

export interface DueNotification {
  /** 重複送信を防ぐためのキー（端末ごとに 1 回） */
  key: string
  title: string
  body: string
  /** 通知タップで開く画面 */
  url: string
  /** 同じ予定の通知をまとめるタグ */
  tag: string
}

export const CATCH_UP_MINUTES = 10

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// ---- タイムゾーン ----

/** その瞬間の、指定タイムゾーンでの日付と時刻 */
export function zonedParts(at: Date, timeZone: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

/**
 * 指定タイムゾーンの「日付 + 時刻」を UTC の瞬間に変換する。
 * 夏時間の切り替えで存在しない時刻なら null（その通知はスキップ）。
 */
export function zonedWallToUtc(date: string, time: string, timeZone: string): Date | null {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return null
  const [y, mo, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const wall = Date.UTC(y, mo - 1, d, hh, mm)
  // オフセットを 2 回推定して収束させる
  let guess = wall
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), timeZone)
    const [py, pmo, pd] = p.date.split('-').map(Number)
    const [ph, pm] = p.time.split(':').map(Number)
    const seen = Date.UTC(py, pmo - 1, pd, ph, pm)
    guess += wall - seen
  }
  const check = zonedParts(new Date(guess), timeZone)
  return check.date === date && check.time === time ? new Date(guess) : null
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// ---- 対象の絞り込み ----

function index(data: NData) {
  const lines = new Map((data.lines ?? []).map((l) => [l.id, l]))
  const seedings = new Map((data.seedings ?? []).map((s) => [s.id, s]))
  const activeSeeding = (id: string | null | undefined) => {
    if (!id) return true
    const s = seedings.get(id)
    if (!s) return false // 削除済み
    if (s.status === 'completed' || s.status === 'discarded') return false
    const line = lines.get(s.lineId)
    return !!line && !line.archived
  }
  const activeLine = (id: string | null | undefined) => {
    if (!id) return true
    const l = lines.get(id)
    return !!l && !l.archived
  }
  return { lines, seedings, activeSeeding, activeLine }
}

export interface DayCounts {
  passage: number
  seeding: number
  assay: number
  medium: number
  other: number
  total: number
}

/** その日の未完了の予定の件数（朝のまとめ用） */
export function dayCounts(data: NData, date: string): DayCounts {
  const ix = index(data)
  const passage = (data.lines ?? []).filter((l) => !l.archived && l.nextPassageDate === date).length
  const seeding = (data.seedings ?? []).filter((s) => s.date === date && (s.status === 'culturing' || s.status === 'assay_scheduled') && ix.activeLine(s.lineId)).length
  const assay = (data.assays ?? []).filter((a) => a.date === date && !a.done && ix.activeSeeding(a.seedingId)).length
  const tasks = (data.tasks ?? []).filter((t) => t.date === date && !t.done && ix.activeLine(t.lineId) && ix.activeSeeding(t.seedingId))
  const medium = tasks.filter((t) => t.kind === 'medium').length
  const other = tasks.length - medium
  return { passage, seeding, assay, medium, other, total: passage + seeding + assay + medium + other }
}

/** 時刻つきの未完了アッセイ（日付・時刻ごとにまとめる） */
export function timedAssays(data: NData): { date: string; time: string; count: number }[] {
  const ix = index(data)
  const groups = new Map<string, { date: string; time: string; count: number }>()
  for (const a of data.assays ?? []) {
    if (a.done || !a.time || !TIME_RE.test(a.time) || !DATE_RE.test(a.date) || !ix.activeSeeding(a.seedingId)) continue
    const k = `${a.date}T${a.time}`
    const g = groups.get(k) ?? { date: a.date, time: a.time, count: 0 }
    g.count += 1
    groups.set(k, g)
  }
  return [...groups.values()]
}

function summaryBody(c: DayCounts): string {
  const parts = [
    c.passage && `継代 ${c.passage}`,
    c.seeding && `播種 ${c.seeding}`,
    c.assay && `アッセイ ${c.assay}`,
    c.medium && `培地交換 ${c.medium}`,
    c.other && `その他 ${c.other}`,
  ].filter(Boolean)
  return `今日の予定は ${c.total} 件です（${parts.join('・')}）`
}

// ---- 判定 ----

/** いま送るべき通知の一覧 */
export function dueNotifications(data: NData, s: NotifySettings, now: Date, catchUpMinutes = CATCH_UP_MINUTES): DueNotification[] {
  const tz = isValidTimeZone(s.timezone) ? s.timezone : 'Asia/Tokyo'
  const windowMs = catchUpMinutes * 60_000
  const inWindow = (target: Date | null) => !!target && now.getTime() >= target.getTime() && now.getTime() - target.getTime() < windowMs
  const out: DueNotification[] = []

  if (s.dailyEnabled && TIME_RE.test(s.dailyTime)) {
    // 予定時刻から 10 分以内に日付をまたぐ場合に備え、今日と昨日の両方を確認する
    const today = zonedParts(now, tz).date
    const yesterday = zonedParts(new Date(now.getTime() - windowMs), tz).date
    for (const date of new Set([yesterday, today])) {
      if (!inWindow(zonedWallToUtc(date, s.dailyTime, tz))) continue
      const c = dayCounts(data, date)
      if (c.total === 0) continue
      out.push({ key: `daily:${date}`, title: '今日の予定', body: summaryBody(c), url: `#/day/${date}`, tag: `cellender-daily-${date}` })
    }
  }

  if (s.assayLead !== null && s.assayLead >= 0) {
    for (const g of timedAssays(data)) {
      const start = zonedWallToUtc(g.date, g.time, tz)
      if (!start) continue
      const target = new Date(start.getTime() - s.assayLead * 60_000)
      if (!inWindow(target)) continue
      out.push({
        key: `assay:${g.date}T${g.time}:${s.assayLead}`,
        title: s.assayLead === 0 ? 'アッセイの時間です' : `アッセイまであと ${s.assayLead} 分`,
        body: `${g.time} 開始のアッセイが ${g.count} 件あります`,
        url: `#/day/${g.date}`,
        tag: `cellender-assay-${g.date}-${g.time}`,
      })
    }
  }
  return out
}
