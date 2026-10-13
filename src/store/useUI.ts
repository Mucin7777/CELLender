import { create } from 'zustand'
import type { CalendarEvent, DateStr, TaskKind } from '../types'

export type ModalState =
  | { kind: 'line'; id?: string }
  | { kind: 'passage'; lineId: string }
  | { kind: 'seeding'; id?: string; lineId?: string; date?: DateStr }
  | { kind: 'assay'; id?: string; seedingId?: string; date?: DateStr }
  | { kind: 'task'; id?: string; date?: DateStr; taskKind?: TaskKind; lineId?: string; seedingId?: string }
  | { kind: 'add'; date?: DateStr }
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'login'; mode?: 'signIn' | 'signUp' }
  | { kind: 'confirm'; title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }

export interface Toast {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

interface UIState {
  /** カレンダーで表示中の 2 週間の基準日（その週から 2 週間を表示）。null は今日 */
  calAnchor: DateStr | null
  /** 最後に開いた日付（カレンダーで選択日として示す） */
  lastDay: DateStr | null
  setCalAnchor: (d: DateStr | null) => void
  setLastDay: (d: DateStr | null) => void
  /** モーダルはスタックで管理（イベント詳細 → 編集 などの入れ子に対応） */
  modals: ModalState[]
  open: (m: ModalState) => void
  close: () => void
  closeAll: () => void
  toasts: Toast[]
  toast: (message: string, action?: Toast['action']) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0

export const useUI = create<UIState>()((set, get) => ({
  calAnchor: null,
  lastDay: null,
  setCalAnchor: (d) => set({ calAnchor: d }),
  setLastDay: (d) => set({ lastDay: d }),
  modals: [],
  open: (m) => set((s) => ({ modals: [...s.modals, m] })),
  close: () => set((s) => ({ modals: s.modals.slice(0, -1) })),
  closeAll: () => set({ modals: [] }),
  toasts: [],
  toast: (message, action) => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, message, action }] }))
    setTimeout(() => get().dismissToast(id), 4000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const confirmDialog = (opts: Omit<Extract<ModalState, { kind: 'confirm' }>, 'kind'>) =>
  useUI.getState().open({ kind: 'confirm', ...opts })
