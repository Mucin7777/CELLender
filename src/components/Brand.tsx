import symbolUrl from '../assets/brand/cellender-symbol.png'
import { cx } from './ui'

export const APP_NAME = 'cellender'

/** 細胞の曲線で「C」を表したブランドマーク。縦横比を保つため正方形の枠に収める */
export function BrandMark({ size = 28, className, decorative = true }: { size?: number; className?: string; decorative?: boolean }) {
  return (
    <img
      src={symbolUrl}
      width={size}
      height={size}
      alt={decorative ? '' : APP_NAME}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cx('shrink-0 select-none object-contain', className)}
      style={{ width: size, height: size }}
    />
  )
}

/** ヘッダー用のロックアップ（シンボル＋アプリ名） */
export function BrandLockup({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <BrandMark size={size} />
      <span className="font-num text-[17px] font-semibold tracking-[-0.01em] text-ink" style={{ lineHeight: 1 }}>
        {APP_NAME}
      </span>
    </span>
  )
}
