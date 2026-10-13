import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AppData, Assay, CalendarEvent, CellLine, DateStr, PassageRecord, Seeding, SeedingStatus, Task } from '../types'
import { uid } from '../lib/id'
import { addDaysStr } from '../lib/date'
import { createSampleData } from '../lib/sample'

export type NewLine = Omit<CellLine, 'id' | 'createdAt' | 'archived'>
export type NewSeeding = Omit<Seeding, 'id' | 'createdAt' | 'status'> & { status?: SeedingStatus }
export type NewAssay = Omit<Assay, 'id' | 'done' | 'doneAt' | 'result'>
export type NewTask = Omit<Task, 'id' | 'done'>

export interface PassageInput {
  date: DateStr
  splitRatio: string
  notes: string
  /** 次回予定日。undefined の場合は間隔から自動計算、null は予定なし */
  nextPassageDate?: DateStr | null
}

interface Actions {
  addLine: (input: NewLine) => string
  updateLine: (id: string, patch: Partial<CellLine>) => void
  deleteLine: (id: string) => void
  recordPassage: (lineId: string, input: PassageInput) => void
  updatePassage: (id: string, patch: Partial<PassageRecord>) => void
  deletePassage: (id: string) => void

  addSeeding: (input: NewSeeding) => string
  updateSeeding: (id: string, patch: Partial<Seeding>) => void
  deleteSeeding: (id: string) => void

  addAssay: (input: NewAssay) => string
  updateAssay: (id: string, patch: Partial<Assay>) => void
  setAssayDone: (id: string, done: boolean, result?: string) => void
  deleteAssay: (id: string) => void

  addTask: (input: NewTask) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void

  moveEvent: (event: CalendarEvent, date: DateStr) => void

  replaceAll: (data: AppData) => void
  loadSample: () => void
  clearAll: () => void
}

export type Store = AppData & Actions

const emptyData = (): AppData => ({ version: 1, lines: [], passages: [], seedings: [], assays: [], tasks: [] })

/** アッセイの状態に応じて播種記録のステータスを自動更新する */
function syncSeedingStatus(seedings: Seeding[], assays: Assay[], seedingId: string): Seeding[] {
  return seedings.map((s) => {
    if (s.id !== seedingId || s.status === 'discarded') return s
    const related = assays.filter((a) => a.seedingId === seedingId)
    let status: SeedingStatus
    if (related.length === 0) status = s.status === 'assay_scheduled' ? 'culturing' : s.status
    else if (related.every((a) => a.done)) status = 'completed'
    else status = 'assay_scheduled'
    return status === s.status ? s : { ...s, status }
  })
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyData(),

      addLine: (input) => {
        const id = uid()
        set((st) => ({ lines: [...st.lines, { ...input, id, archived: false, createdAt: new Date().toISOString() }] }))
        return id
      },
      updateLine: (id, patch) => set((st) => ({ lines: st.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      deleteLine: (id) =>
        set((st) => {
          const seedingIds = new Set(st.seedings.filter((s) => s.lineId === id).map((s) => s.id))
          return {
            lines: st.lines.filter((l) => l.id !== id),
            passages: st.passages.filter((p) => p.lineId !== id),
            seedings: st.seedings.filter((s) => !seedingIds.has(s.id)),
            assays: st.assays.filter((a) => !seedingIds.has(a.seedingId)),
            tasks: st.tasks.filter((t) => t.lineId !== id && !(t.seedingId && seedingIds.has(t.seedingId))),
          }
        }),

      recordPassage: (lineId, input) =>
        set((st) => {
          const line = st.lines.find((l) => l.id === lineId)
          if (!line) return {}
          const passageNumber = line.passageNumber + 1
          const record: PassageRecord = { id: uid(), lineId, date: input.date, passageNumber, splitRatio: input.splitRatio, notes: input.notes }
          const next =
            input.nextPassageDate !== undefined
              ? input.nextPassageDate
              : line.passageIntervalDays > 0
                ? addDaysStr(input.date, line.passageIntervalDays)
                : null
          return {
            passages: [...st.passages, record],
            lines: st.lines.map((l) =>
              l.id === lineId ? { ...l, passageNumber, lastPassageDate: input.date, nextPassageDate: next } : l,
            ),
          }
        }),
      updatePassage: (id, patch) => set((st) => ({ passages: st.passages.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deletePassage: (id) =>
        set((st) => {
          const rec = st.passages.find((p) => p.id === id)
          if (!rec) return {}
          const passages = st.passages.filter((p) => p.id !== id)
          const line = st.lines.find((l) => l.id === rec.lineId)
          // 最新の継代記録を取り消した場合はラインの状態を巻き戻す
          const isLatest = line && line.passageNumber === rec.passageNumber && line.lastPassageDate === rec.date
          if (!line || !isLatest) return { passages }
          const prev = passages
            .filter((p) => p.lineId === line.id)
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.passageNumber - a.passageNumber))[0]
          return {
            passages,
            lines: st.lines.map((l) =>
              l.id === line.id
                ? { ...l, passageNumber: Math.max(0, rec.passageNumber - 1), lastPassageDate: prev?.date ?? null, nextPassageDate: rec.date }
                : l,
            ),
          }
        }),

      addSeeding: (input) => {
        const id = uid()
        set((st) => ({
          seedings: [...st.seedings, { ...input, id, status: input.status ?? 'culturing', createdAt: new Date().toISOString() }],
        }))
        return id
      },
      updateSeeding: (id, patch) => set((st) => ({ seedings: st.seedings.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
      deleteSeeding: (id) =>
        set((st) => ({
          seedings: st.seedings.filter((s) => s.id !== id),
          assays: st.assays.filter((a) => a.seedingId !== id),
          tasks: st.tasks.filter((t) => t.seedingId !== id),
        })),

      addAssay: (input) => {
        const id = uid()
        set((st) => {
          const assays = [...st.assays, { ...input, id, done: false, doneAt: null, result: '' }]
          return { assays, seedings: syncSeedingStatus(st.seedings, assays, input.seedingId) }
        })
        return id
      },
      updateAssay: (id, patch) =>
        set((st) => {
          const assays = st.assays.map((a) => (a.id === id ? { ...a, ...patch } : a))
          const a = assays.find((x) => x.id === id)
          return { assays, seedings: a ? syncSeedingStatus(st.seedings, assays, a.seedingId) : st.seedings }
        }),
      setAssayDone: (id, done, result) =>
        get().updateAssay(id, {
          done,
          doneAt: done ? new Date().toISOString() : null,
          ...(result !== undefined ? { result } : {}),
        }),
      deleteAssay: (id) =>
        set((st) => {
          const target = st.assays.find((a) => a.id === id)
          const assays = st.assays.filter((a) => a.id !== id)
          return { assays, seedings: target ? syncSeedingStatus(st.seedings, assays, target.seedingId) : st.seedings }
        }),

      addTask: (input) => {
        const id = uid()
        set((st) => ({ tasks: [...st.tasks, { ...input, id, done: false }] }))
        return id
      },
      updateTask: (id, patch) => set((st) => ({ tasks: st.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTask: (id) => set((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) })),

      moveEvent: (event, date) => {
        const s = get()
        switch (event.type) {
          case 'passage_plan':
            return s.updateLine(event.refId, { nextPassageDate: date })
          case 'seeding':
            return s.updateSeeding(event.refId, { date })
          case 'assay':
            return s.updateAssay(event.refId, { date })
          case 'medium':
          case 'other':
            return s.updateTask(event.refId, { date })
          case 'passage_done':
            return s.updatePassage(event.refId, { date })
        }
      },

      replaceAll: (data) => set({ ...emptyData(), ...data, version: 1 }),
      loadSample: () => set(createSampleData()),
      clearAll: () => set(emptyData()),
    }),
    {
      name: 'cellendar-data',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (st): AppData => ({
        version: 1,
        lines: st.lines,
        passages: st.passages,
        seedings: st.seedings,
        assays: st.assays,
        tasks: st.tasks,
      }),
    },
  ),
)

export const selectData = (st: Store): AppData => ({
  version: 1,
  lines: st.lines,
  passages: st.passages,
  seedings: st.seedings,
  assays: st.assays,
  tasks: st.tasks,
})
