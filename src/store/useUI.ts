import { create } from 'zustand'
import type { CalendarEvent, DateStr, TaskKind } from '../types'

export type ModalState =
  | { kind: 'line'; id?: string }
  | { kind: 'passage'; lineId: string }
  | { kind: 'seeding'; id?: string; lineId?: string; date?: DateStr }
  | { kind: 'assay'; id?: string; seedingId?: string; date?: DateStr }
  | { kind: 'task'; id?: string; date?: DateStr; taskKind?: TaskKind; lineId?: string; seedingId?: string }
  | { kind: 'quickAdd'; date: DateStr }
  | { kind: 'event'; event: CalendarEvent }
  | { kind: 'confirm'; title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void }

export interface Toast {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

interface UIState {
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
