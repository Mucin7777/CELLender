import type { CalendarEventType, SeedingStatus } from '../types'

/** テーマカラー（src/index.css の @theme と同じ値。JS から色が必要な箇所とテスト用） */
export const THEME = {
  sage: '#A8CDBD', // テーマカラー（ソフトセージ）
  mint: '#CEE7DD', // 選択部分・淡い塗り
  mintSoft: '#EEF6F2', // hover・入力欄などのごく淡い面
  teal: '#397D70', // メインボタン・選択中の輪郭
  tealDark: '#2C6458', // ミントの上の文字・hover
  graySage: '#7D928D', // 未選択アイコン・UI 部品の枠
  canvas: '#F7FAF8', // 画面背景
  ink: '#283E38', // 本文
  sub: '#4C605A', // 補助テキスト
  faint: '#627670', // 控えめなテキスト
  hair: '#E1EBE6', // 区切り線
  danger: '#B3412E', // エラー・遅れ
} as const

/**
 * 細胞ラインの基準色。帯にはここから導いた淡い色（lineTone().pale）を使う。
 * 淡くしても見分けられるよう、色相を散らし明るさをそろえている。
 */
export const LINE_COLORS = [
  '#3F7A63', // セージグリーン
  '#3E6A99', // ブルー
  '#6A5A9C', // ラベンダー
  '#B0643A', // テラコッタ
  '#A4506A', // ローズ
  '#8C7A2E', // オーカー
  '#2F7F86', // シアン
  '#6E8A3A', // オリーブ
  '#8A5A86', // プラム
  '#5C6E8C', // スレート
]

export const EVENT_TYPE_META: Record<CalendarEventType, { label: string; short: string; mono: string }> = {
  passage_plan: { label: '継代予定', short: '継代', mono: '継' },
  passage_done: { label: '継代済み', short: '継代', mono: '継' },
  seeding: { label: '播種', short: '播種', mono: '播' },
  assay: { label: 'アッセイ', short: 'アッセイ', mono: '測' },
  medium: { label: '培地交換', short: '培地', mono: '培' },
  other: { label: 'その他', short: '予定', mono: '他' },
}

export const SEEDING_STATUS_META: Record<SeedingStatus, { label: string; short: string; className: string }> = {
  culturing: { label: '培養中', short: '培養中', className: 'bg-[#E4EEF6] text-[#2F5876]' },
  assay_scheduled: { label: 'アッセイ予定', short: '予定あり', className: 'bg-amber-50 text-amber-800' },
  completed: { label: '完了', short: '完了', className: 'bg-mint text-teal-dark' },
  discarded: { label: '廃棄', short: '廃棄', className: 'bg-[#EDF1EF] text-sub' },
}

export const PLATE_TYPES = [
  '96ウェルプレート',
  '48ウェルプレート',
  '24ウェルプレート',
  '12ウェルプレート',
  '6ウェルプレート',
  '384ウェルプレート',
  'Transwell (24)',
  'Transwell (12)',
  'チャンバースライド',
  '35mm ディッシュ',
  '60mm ディッシュ',
  '100mm ディッシュ',
  'T25 フラスコ',
  'T75 フラスコ',
]

export const ASSAY_PRESETS = [
  'TEER 測定',
  '透過性アッセイ',
  'MTT / WST アッセイ',
  'ELISA',
  'qPCR 用回収',
  '免疫染色',
  'ウエスタン用回収',
  'イメージング',
  '薬剤処理',
]
