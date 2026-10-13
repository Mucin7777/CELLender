import type { CalendarEventType, SeedingStatus } from '../types'

export const LINE_COLORS = [
  '#0d9488', '#2563eb', '#7c3aed', '#db2777', '#ea580c',
  '#ca8a04', '#16a34a', '#0891b2', '#4f46e5', '#be123c',
  '#65a30d', '#9333ea',
]

export const EVENT_TYPE_META: Record<CalendarEventType, { label: string; color: string; short: string }> = {
  passage_plan: { label: '継代予定', color: '#0d9488', short: '継代' },
  passage_done: { label: '継代済み', color: '#64748b', short: '継代済' },
  seeding: { label: '播種', color: '#2563eb', short: '播種' },
  assay: { label: 'アッセイ', color: '#db2777', short: 'アッセイ' },
  medium: { label: '培地交換', color: '#ca8a04', short: '培地' },
  other: { label: 'その他', color: '#7c3aed', short: '予定' },
}

export const SEEDING_STATUS_META: Record<SeedingStatus, { label: string; short: string; className: string }> = {
  culturing: { label: '培養中', short: '培養中', className: 'bg-sky-50 text-sky-700' },
  assay_scheduled: { label: 'アッセイ予定', short: '予定あり', className: 'bg-amber-50 text-amber-700' },
  completed: { label: '完了', short: '完了', className: 'bg-emerald-50 text-emerald-700' },
  discarded: { label: '廃棄', short: '廃棄', className: 'bg-gray-100 text-gray-500' },
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
