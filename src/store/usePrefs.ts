import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarEventType } from '../types'

export type CalendarMode = 'month' | 'week' | 'list'
export type ColorMode = 'type' | 'line'

interface Prefs {
  calendarMode: CalendarMode
  colorMode: ColorMode
  weekStartsOn: 0 | 1
  hiddenTypes: CalendarEventType[]
  hiddenLines: string[]
  showDone: boolean
  set: (p: Partial<Omit<Prefs, 'set' | 'toggleType' | 'toggleLine'>>) => void
  toggleType: (t: CalendarEventType) => void
  toggleLine: (id: string) => void
}

const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      calendarMode: 'month',
      colorMode: 'type',
      weekStartsOn: 0,
      hiddenTypes: [],
      hiddenLines: [],
      showDone: true,
      set: (p) => set(p),
      toggleType: (t) => set((s) => ({ hiddenTypes: toggle(s.hiddenTypes, t) })),
      toggleLine: (id) => set((s) => ({ hiddenLines: toggle(s.hiddenLines, id) })),
    }),
    { name: 'cellendar-prefs' },
  ),
)
