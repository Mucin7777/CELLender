import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Prefs {
  weekStartsOn: 0 | 1
  /** ホームのカレンダーを月表示にするか（false は週表示） */
  showMonth: boolean
  set: (p: Partial<Omit<Prefs, 'set'>>) => void
}

export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      weekStartsOn: 0,
      showMonth: false,
      set: (p) => set(p),
    }),
    { name: 'cellendar-prefs-v2' },
  ),
)
