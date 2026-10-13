import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from './router'

describe('router', () => {
  it('日付の画面を解釈して往復できる', () => {
    expect(parseHash('#/day/2026-10-13')).toEqual({ view: 'day', date: '2026-10-13' })
    expect(routeToHash({ view: 'day', date: '2026-10-13' })).toBe('#/day/2026-10-13')
  })

  it('不正な日付や未知のパスはカレンダーに戻る', () => {
    expect(parseHash('#/day/13-10-2026')).toEqual({ view: 'home' })
    expect(parseHash('#/day')).toEqual({ view: 'home' })
    expect(parseHash('#/unknown')).toEqual({ view: 'home' })
  })

  it('既存の画面遷移を維持する', () => {
    expect(parseHash('#/lines/abc')).toEqual({ view: 'lines', id: 'abc' })
    expect(parseHash('#/seedings')).toEqual({ view: 'seedings', id: undefined })
    expect(parseHash('#/assays')).toEqual({ view: 'seedings', id: undefined })
    expect(parseHash('#/settings')).toEqual({ view: 'settings' })
  })
})
