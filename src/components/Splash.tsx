import { useEffect, useState } from 'react'
import { BrandMark, APP_NAME } from './Brand'
import { usePrefs } from '../store/usePrefs'

/** ページを開いたときに 1 回だけ表示する（タブ移動や復帰では再生しない） */
let decision: boolean | null = null

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function shouldShowSplash(): boolean {
  // 何度呼ばれても同じ答え（開発時の StrictMode の二重呼び出しでも 1 回だけ表示）
  if (decision === null) decision = usePrefs.getState().splash && !reducedMotion()
  return decision
}

/**
 * 起動演出：シンボルと文字が静かに現れて、約 1.5 秒で消える。
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
      <div className="splash-mark">
        <BrandMark size={104} />
      </div>
      <div className="splash-word mt-5 font-num text-[26px] font-semibold tracking-[-0.01em] text-ink">{APP_NAME}</div>
      <span className="sr-only">読み込み中</span>
    </div>
  )
}
