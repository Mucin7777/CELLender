import symbolUrl from '../assets/brand/cellender-symbol.png'
// 起動画面ですぐ表示できるよう、ロゴは JS に埋め込む（約 16KB）
import logoUrl from '../assets/brand/cellender-logo.png?inline'
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

/** 横長ロゴ（シンボル＋ロゴタイプ）の縦横比。scripts/process-assets.py の出力（951×192）に合わせる */
export const LOGO_RATIO = 951 / 192
/** ロゴ画像の中で、シンボルとロゴタイプの間の位置（左端からの割合）。起動画面で別々に動かすのに使う */
export const LOGO_SPLIT = 0.2076
/** シンボルの中心（左端からの割合） */
export const LOGO_MARK_CENTER = 0.0965

/** 横長ロゴ。アプリ名を文字で出していた場所はすべてこれを使う */
export function BrandLogo({ height = 28, className, alt = APP_NAME }: { height?: number; className?: string; alt?: string }) {
  return (
    <img
      src={logoUrl}
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      alt={alt}
      aria-hidden={alt === '' || undefined}
      draggable={false}
      className={cx('shrink-0 select-none', className)}
      style={{ width: Math.round(height * LOGO_RATIO), height: 'auto' }}
    />
  )
}

export { logoUrl }
