import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BandLabelMode = 'type' | 'line'

interface Prefs {
  weekStartsOn: 0 | 1
  /** カレンダーの帯に出す文字：種類（継代・播種…）かラインの略称か */
  bandLabel: BandLabelMode
  set: (p: Partial<Omit<Prefs, 'set'>>) => void
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      weekStartsOn: 0,
      bandLabel: 'type',
      set: (p) => set(p),
    }),
    { name: 'cellendar-prefs-v2', version: 2, migrate: (old) => ({ weekStartsOn: 0, bandLabel: 'type', ...(old as object) }) as Prefs },
  ),
)
