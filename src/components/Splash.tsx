import { useEffect, useState } from 'react'
import { LOGO_MARK_CENTER, LOGO_RATIO, LOGO_SPLIT, logoUrl } from './Brand'
import { usePrefs } from '../store/usePrefs'

const LOGO_W = 300

/** ページを開いたときに 1 回だけ表示する（タブ移動や復帰では再生しない） */
let decision: boolean | null = null

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function shouldShowSplash(): boolean {
  // 何度呼ばれても同じ答え（開発時の StrictMode の二重呼び出しでも 1 回だけ表示）
  if (decision === null) decision = usePrefs.getState().splash && !reducedMotion()
  return decision
}

/**
 * 起動演出：横長ロゴのシンボルが回りながら現れ、続いてロゴタイプが現れて、約 1.5 秒で消える。
 * ロゴは 1 枚の画像を 2 回重ね、シンボル側とロゴタイプ側に切り分けて別々に動かす。
 * アプリはその裏で読み込みを進める。タップ・キー入力ですぐに閉じられる。
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 1100)
    const skip = () => setLeaving(true)
    window.addEventListener('keydown', skip)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(onDone, 380)
    return () => clearTimeout(t)
  }, [leaving, onDone])

  return (
    <div
      role="presentation"
      onPointerDown={() => setLeaving(true)}
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center bg-canvas transition-opacity duration-[380ms] ${leaving ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      <div className="relative" style={{ width: LOGO_W, maxWidth: '78vw', aspectRatio: String(LOGO_RATIO) }}>
        <img
          src={logoUrl}
          alt=""
          draggable={false}
          className="splash-mark absolute inset-0 size-full select-none"
          style={{ clipPath: `inset(0 ${(1 - LOGO_SPLIT) * 100}% 0 0)`, transformOrigin: `${LOGO_MARK_CENTER * 100}% 50%` }}
        />
        <img
          src={logoUrl}
          alt=""
          draggable={false}
          className="splash-word absolute inset-0 size-full select-none"
          style={{ clipPath: `inset(0 0 0 ${LOGO_SPLIT * 100}%)` }}
        />
      </div>
      <span className="sr-only">cellender 読み込み中</span>
    </div>
  )
}
