import symbolUrl from '../assets/brand/cellender-symbol.png'
// 起動画面・ヘッダーですぐ表示できるよう、ロゴは JS に埋め込む（3 枚で約 35KB）
import logoUrl from '../assets/brand/cellender-logo.png?inline'
import markUrl from '../assets/brand/cellender-mark.png?inline'
import wordmarkUrl from '../assets/brand/cellender-wordmark.png?inline'
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

/** 横長ロゴ（シンボル＋ロゴタイプ）の縦横比。scripts/process-assets.py の出力（804×192）に合わせる */
export const LOGO_RATIO = 804 / 192
/** 起動画面用：シンボル（367×384）とロゴタイプ（612×128）の縦横比 */
export const MARK_RATIO = 367 / 384
export const WORDMARK_RATIO = 612 / 128

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

export { markUrl, wordmarkUrl }
