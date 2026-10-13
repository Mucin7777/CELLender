import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ja } from 'date-fns/locale'
import type { DateStr } from '../types'

export const toDateStr = (d: Date): DateStr => format(d, 'yyyy-MM-dd')
export const fromDateStr = (s: DateStr): Date => parseISO(s)
export const todayStr = (): DateStr => toDateStr(new Date())

export const addDaysStr = (s: DateStr, days: number): DateStr => toDateStr(addDays(fromDateStr(s), days))

/** b - a in calendar days */
export const diffDays = (a: DateStr, b: DateStr): number => differenceInCalendarDays(fromDateStr(b), fromDateStr(a))

export const fmt = (s: DateStr, pattern = 'M/d (E)'): string => format(fromDateStr(s), pattern, { locale: ja })

/** 今日からの相対表現（今日 / 明日 / 3日後 / 2日超過） */
export const relativeLabel = (s: DateStr, today: DateStr = todayStr()): string => {
  const d = diffDays(today, s)
  if (d === 0) return '今日'
  if (d === 1) return '明日'
  if (d === -1) return '昨日'
  if (d > 1) return `${d}日後`
  return `${-d}日前`
}

/** 播種日からの培養日数 (Day 0 = 播種日) */
export const cultureDay = (seedDate: DateStr, on: DateStr = todayStr()): number => diffDays(seedDate, on)

/** 培養日数の表示（播種前なら「播種まで n 日」） */
export const cultureLabel = (seedDate: DateStr, on: DateStr = todayStr()): string => {
  const d = diffDays(seedDate, on)
  return d < 0 ? `播種まで${-d}日` : `${d}日目`
}
