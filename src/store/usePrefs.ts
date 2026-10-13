import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BandLabelMode = 'type' | 'line'

interface Prefs {
  weekStartsOn: 0 | 1
  /** カレンダーの帯に出す文字：種類（継代・播種…）かラインの略称か */
  bandLabel: BandLabelMode
  /** 起動時のシンボル演出 */
  splash: boolean
  set: (p: Partial<Omit<Prefs, 'set'>>) => void
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      weekStartsOn: 0,
      bandLabel: 'type',
      splash: true,
      set: (p) => set(p),
    }),
    { name: 'cellendar-prefs-v2', version: 3, migrate: (old) => ({ weekStartsOn: 0, bandLabel: 'type', splash: true, ...(old as object) }) as Prefs },
  ),
)
