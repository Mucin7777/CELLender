import { describe, expect, it } from 'vitest'
import { contrast, lineTone, mix } from './color'
import { LINE_COLORS, THEME } from './constants'

// 以前のバージョンで保存されたラインの色（既存データの互換確認用）
const LEGACY = ['#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#4f46e5', '#be123c', '#65a30d', '#9333ea']

describe('lineTone', () => {
  it.each([...LINE_COLORS, ...LEGACY])('%s: 濃色は淡色・白の両方に 4.5:1 以上', (c) => {
    const t = lineTone(c)
    expect(contrast(t.deep, t.pale)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t.deep, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
  })

  it('不正な色でも中立色にフォールバックする', () => {
    expect(lineTone('nope').pale).toMatch(/^#[0-9A-F]{6}$/)
    expect(lineTone(undefined).deep).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('mix は両端で元の色になる', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000')
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF')
  })
})

describe('テーマカラーのコントラスト', () => {
  it('本文・補助文字・ボタン文字が AA を満たす', () => {
    expect(contrast(THEME.ink, THEME.canvas)).toBeGreaterThanOrEqual(7)
    expect(contrast(THEME.sub, THEME.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(THEME.faint, THEME.canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#FFFFFF', THEME.teal)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(THEME.tealDark, THEME.mint)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(THEME.ink, THEME.mint)).toBeGreaterThanOrEqual(4.5)
  })

  it('未選択アイコン・チェック枠などの UI 部品が 3:1 を満たす', () => {
    expect(contrast(THEME.graySage, '#FFFFFF')).toBeGreaterThanOrEqual(3)
    expect(contrast(THEME.graySage, THEME.canvas)).toBeGreaterThanOrEqual(3)
  })
})
