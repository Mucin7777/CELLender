import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type BandLabelMode = 'type' | 'line'
/** カレンダーの表示：ラインごとの段（lanes）か、予定ごとの帯（chips）か */
export type CalStyle = 'lanes' | 'chips'

interface Prefs {
  weekStartsOn: 0 | 1
  calStyle: CalStyle
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
      calStyle: 'lanes',
      bandLabel: 'type',
      splash: true,
      set: (p) => set(p),
    }),
    {
      name: 'cellendar-prefs-v2',
      version: 4,
      // 足りない項目は既定値で補う（v4 でラインごとの段の表示を追加し、既定にした）
      migrate: (old) => ({ weekStartsOn: 0, bandLabel: 'type', splash: true, ...(old as object), calStyle: 'lanes' }) as Prefs,
    },
  ),
)
