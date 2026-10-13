/** 色の計算ユーティリティ（ラインの淡色・濃色の導出、コントラスト比） */

type RGB = [number, number, number]

export const hexToRgb = (hex: string): RGB => {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return [125, 146, 141]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const rgbToHex = ([r, g, b]: RGB): string =>
  '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()

/** a と b を t の割合で混ぜる（t=0 で a、t=1 で b） */
export const mix = (a: string, b: string, t: number): string => {
  const x = hexToRgb(a)
  const y = hexToRgb(b)
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

const channel = (v: number) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export const contrast = (a: string, b: string): number => {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 濃色を暗くするときに寄せる色（本文色に近い深い緑灰） */
const SHADE = '#1E302B'

export interface LineTone {
  /** 帯や面に使う淡い色（ラインの識別） */
  pale: string
  /** 淡い色の上の文字・アッセイ帯の塗り（淡い色・白の両方に 4.5:1 以上） */
  deep: string
  /** 培地交換の帯など、枠線に使う中間色 */
  edge: string
}

const toneCache = new Map<string, LineTone>()

/** ラインの基準色から、淡い面の色と読みやすい濃い色を導く */
export function lineTone(color: string | undefined | null): LineTone {
  const base = color && /^#?[0-9a-fA-F]{3,6}$/.test(color) ? (color.startsWith('#') ? color : '#' + color) : '#7D928D'
  const hit = toneCache.get(base)
  if (hit) return hit
  const pale = mix(base, '#FFFFFF', 0.8)
  let deep = base
  for (let i = 0; i < 20 && (contrast(deep, pale) < 4.6 || contrast(deep, '#FFFFFF') < 4.6); i++) deep = mix(deep, SHADE, 0.12)
  const tone = { pale, deep, edge: mix(deep, '#FFFFFF', 0.55) }
  toneCache.set(base, tone)
  return tone
}

/** ラインに属さない予定（その他）の中立トーン */
export const NEUTRAL_TONE: LineTone = { pale: '#EDF2EF', deep: '#4C605A', edge: '#B9C8C2' }
