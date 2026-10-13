import { useUI, type ModalState } from '../store/useUI'
import { useShallow } from 'zustand/react/shallow'
import { AddSheet } from './AddSheet'
import { AssayForm } from './AssayForm'
import { EventDetail } from './EventDetail'
import { LineForm } from './LineForm'
import { PassageForm } from './PassageForm'
import { SeedingForm } from './SeedingForm'
import { TaskForm } from './TaskForm'
import { LoginSheet } from './CloudSync'

function renderModal(m: ModalState) {
  switch (m.kind) {
    case 'line':
      return <LineForm id={m.id} />
    case 'passage':
      return <PassageForm lineId={m.lineId} />
    case 'seeding':
      return <SeedingForm id={m.id} lineId={m.lineId} date={m.date} />
    case 'assay':
      return <AssayForm id={m.id} seedingId={m.seedingId} date={m.date} />
    case 'task':
      return <TaskForm id={m.id} date={m.date} taskKind={m.taskKind} lineId={m.lineId} seedingId={m.seedingId} />
    case 'add':
      return <AddSheet date={m.date} />
    case 'event':
      return <EventDetail event={m.event} />
    case 'login':
      return <LoginSheet mode={m.mode} />
    case 'confirm':
      return <ConfirmDialog {...m} />
  }
}

/** iOS 風の確認ダイアログ */
function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm }: Extract<ModalState, { kind: 'confirm' }>) {
  const close = useUI((s) => s.close)
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-8">
      <div className="animate-fade-in absolute inset-0 bg-black/35" onClick={close} />
      <div role="alertdialog" className="animate-sheet relative w-full max-w-xs overflow-hidden rounded-3xl bg-white text-center shadow-2xl">
        <div className="px-5 pb-4 pt-5">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <p className="mt-1.5 whitespace-pre-line text-[13px] text-sub">{message}</p>
        </div>
        <div className="grid grid-cols-2 border-t border-hair">
          <button className="min-h-12 border-r border-hair text-[16px] text-sub" onClick={close}>
            キャンセル
          </button>
          <button
            className={danger ? 'min-h-12 text-[16px] font-bold text-danger' : 'min-h-12 text-[16px] font-bold text-teal-dark'}
            onClick={() => {
              close()
              onConfirm()
            }}
          >
            {confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ModalHost() {
  const modals = useUI((s) => s.modals)
  const top = modals.at(-1)
  if (!top) return null
  return <div key={modals.length}>{renderModal(top)}</div>
}

export function Toaster() {
  const { toasts, dismissToast } = useUI(useShallow((s) => ({ toasts: s.toasts, dismissToast: s.dismissToast })))
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className="animate-sheet pointer-events-auto flex min-h-12 max-w-md items-center gap-4 rounded-2xl bg-ink/95 py-2 pl-4 pr-2 text-[14px] text-white shadow-xl">
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              className="min-h-9 shrink-0 rounded-xl px-3 font-semibold text-mint active:bg-white/10"
              onClick={() => {
                t.action!.onClick()
                dismissToast(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
