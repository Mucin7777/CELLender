import { useUI, type ModalState } from '../store/useUI'
import { AssayForm } from './AssayForm'
import { EventDetail } from './EventDetail'
import { LineForm } from './LineForm'
import { PassageForm } from './PassageForm'
import { QuickAdd } from './QuickAdd'
import { SeedingForm } from './SeedingForm'
import { TaskForm } from './TaskForm'
import { Modal } from './ui'

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
    case 'quickAdd':
      return <QuickAdd date={m.date} />
    case 'event':
      return <EventDetail event={m.event} />
    case 'confirm':
      return <ConfirmModal {...m} />
  }
}

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm }: Extract<ModalState, { kind: 'confirm' }>) {
  const close = useUI((s) => s.close)
  return (
    <Modal
      title={title}
      size="sm"
      onClose={close}
      footer={
        <>
          <button className="btn-secondary" onClick={close}>
            キャンセル
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={() => {
              close()
              onConfirm()
            }}
          >
            {confirmLabel ?? 'OK'}
          </button>
        </>
      }
    >
      <p className="whitespace-pre-line text-sm text-slate-600">{message}</p>
    </Modal>
  )
}

export function ModalHost() {
  const modals = useUI((s) => s.modals)
  // 一番上のモーダルのみ表示（スタックの下は閉じると戻る）
  const top = modals.at(-1)
  if (!top) return null
  return <div key={modals.length}>{renderModal(top)}</div>
}

export function Toaster() {
  const { toasts, dismissToast } = useUI()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className="animate-pop-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-xl">
          <span>{t.message}</span>
          {t.action && (
            <button
              className="shrink-0 font-semibold text-brand-200 hover:text-white"
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
