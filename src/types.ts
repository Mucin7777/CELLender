/** ISO date string `yyyy-MM-dd` (local date, no time component). */
export type DateStr = string

export interface CellLine {
  id: string
  name: string
  /** カレンダーの帯に出す略称（任意。未設定なら名前から作る） */
  shortName?: string
  /** 由来・種（例: ヒト回腸、マウス、株化細胞） */
  origin: string
  lot: string
  color: string
  /** 現在の継代数 (P数) */
  passageNumber: number
  lastPassageDate: DateStr | null
  /** 継代間隔（日） */
  passageIntervalDays: number
  /** 次回継代予定日。null の場合は予定なし */
  nextPassageDate: DateStr | null
  medium: string
  vessel: string
  notes: string
  archived: boolean
  createdAt: string
}

export interface PassageRecord {
  id: string
  lineId: string
  date: DateStr
  /** 継代後の P 数 */
  passageNumber: number
  splitRatio: string
  notes: string
}

export type SeedingStatus = 'culturing' | 'assay_scheduled' | 'completed' | 'discarded'

export interface Seeding {
  id: string
  lineId: string
  date: DateStr
  plateType: string
  /** 播種時の P 数 */
  passageNumber: number | null
  density: string
  wells: string
  purpose: string
  notes: string
  status: SeedingStatus
  createdAt: string
}

export interface Assay {
  id: string
  seedingId: string
  date: DateStr
  time: string
  name: string
  notes: string
  done: boolean
  doneAt: string | null
  result: string
}

export type TaskKind = 'medium' | 'other'

/** 培地交換などの汎用タスク */
export interface Task {
  id: string
  date: DateStr
  kind: TaskKind
  title: string
  lineId: string | null
  seedingId: string | null
  notes: string
  done: boolean
}

export interface AppData {
  version: 1
  lines: CellLine[]
  passages: PassageRecord[]
  seedings: Seeding[]
  assays: Assay[]
  tasks: Task[]
}

/** カレンダー上に表示される統一イベント */
export type CalendarEventType = 'passage_plan' | 'passage_done' | 'seeding' | 'assay' | 'medium' | 'other'

export interface CalendarEvent {
  key: string
  type: CalendarEventType
  date: DateStr
  title: string
  subtitle?: string
  lineId: string | null
  seedingId?: string
  refId: string
  done: boolean
  /** 日付の変更が可能か */
  movable: boolean
  /** 時刻（アッセイのみ。'HH:mm'） */
  time?: string
}
