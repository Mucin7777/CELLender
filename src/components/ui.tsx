import { useEffect, type ReactNode } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { SeedingStatus } from '../types'
import { SEEDING_STATUS_META } from '../lib/constants'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

/** スマホでは下から出るボトムシート、PC では中央ダイアログ */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  headerRight,
}: {
  title?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  headerRight?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-2xl sm:max-w-md sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-hair sm:hidden" />
        <div className="flex min-h-14 shrink-0 items-center gap-2 pl-5 pr-2">
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</h2>
          {headerRight}
          <button className="icon-btn" onClick={onClose} aria-label="閉じる">
            <X className="size-5" />
          </button>
        </div>
        <div className="no-scrollbar overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="flex shrink-0 gap-2 border-t border-hair px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  )
}

/** 大きなタイトルのページヘッダー（iOS 風） */
export function PageTitle({ title, sub, right, back }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-4 pt-2">
      {back && <div className="-ml-2 mb-1">{back}</div>}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          {sub && <div className="text-[13px] font-medium text-sub">{sub}</div>}
          <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        </div>
        {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
      </div>
    </header>
  )
}

export function SectionLabel({ children, right, tone }: { children: ReactNode; right?: ReactNode; tone?: 'danger' }) {
  return (
    <div className="mb-2 mt-6 flex items-center gap-2 px-1 first:mt-0">
      <h2 className={cx('flex-1 text-[13px] font-semibold', tone === 'danger' ? 'text-rose-600' : 'text-sub')}>{children}</h2>
      {right}
    </div>
  )
}

/** 白い角丸のリストグループ。行の区切りは細い線のみ */
export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('group-card divide-y divide-hair', className)}>{children}</div>
}

export function Row({
  onClick,
  left,
  title,
  sub,
  right,
  chevron,
  dim,
}: {
  onClick?: () => void
  left?: ReactNode
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  chevron?: boolean
  dim?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left',
        onClick && 'transition active:bg-black/[.03] hover:bg-black/[.015]',
        dim && 'opacity-50',
      )}
    >
      {left}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{title}</div>
        {sub && <div className="mt-0.5 truncate text-[13px] text-sub">{sub}</div>}
      </div>
      {right}
      {chevron && <ChevronRight className="size-4 shrink-0 text-faint" />}
    </Tag>
  )
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  )
}

export function StatusBadge({ status }: { status: SeedingStatus }) {
  const meta = SEEDING_STATUS_META[status]
  return <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[12px] font-medium', meta.className)}>{meta.label}</span>
}

export function LineDot({ color, className }: { color: string; className?: string }) {
  return <span className={cx('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ backgroundColor: color }} />
}

/** 行の左端に置く細胞ラインの色帯 */
export function ColorBar({ color }: { color?: string }) {
  return <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: color ?? '#d1d5db' }} />
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[13px] text-sub">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  full,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  full?: boolean
}) {
  return (
    <div className={cx('flex rounded-xl bg-black/[.05] p-0.5', full ? 'w-full' : 'inline-flex')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 flex-1 whitespace-nowrap rounded-[10px] px-2 text-[13px] font-semibold transition',
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-sub',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 丸いチェック。タップ領域は 44px 確保 */
export function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label ?? '完了'}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className="-m-2.5 flex size-11 shrink-0 items-center justify-center"
    >
      <span
        className={cx(
          'flex size-6 items-center justify-center rounded-full border-2 transition',
          checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white',
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.6}>
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  )
}

/** 折りたたみ式の補足入力（プログレッシブ・ディスクロージャー） */
export function Disclosure({ open, onToggle, label, children }: { open: boolean; onToggle: () => void; label: string; children: ReactNode }) {
  return (
    <div>
      <button type="button" onClick={onToggle} className="flex min-h-11 w-full items-center gap-1 text-[14px] font-semibold text-brand-700">
        <ChevronRight className={cx('size-4 transition', open && 'rotate-90')} />
        {label}
      </button>
      {open && <div className="space-y-4 pt-1">{children}</div>}
    </div>
  )
}

/** 候補をタップで選べるチップ列（横スクロール） */
export function Chips({ options, value, onPick }: { options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(o)}
          className={cx(
            'min-h-9 shrink-0 rounded-full px-3 text-[13px] font-medium transition',
            value === o ? 'bg-ink text-white' : 'bg-canvas text-ink active:bg-hair',
          )}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3">
      <span className="flex-1 text-[15px]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand-600' : 'bg-gray-300')}
      >
        <span className={cx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  )
}
