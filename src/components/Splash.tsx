import { useEffect, useState } from 'react'
import { MARK_RATIO, WORDMARK_RATIO, markUrl, wordmarkUrl } from './Brand'
import { usePrefs } from '../store/usePrefs'

const MARK_H = 112
const WORDMARK_H = 39
/** 表示しておく時間（このあと 380ms かけて消える） */
const HOLD_MS = 1600

/** ページを開いたときに 1 回だけ表示する（タブ移動や復帰では再生しない） */
let decision: boolean | null = null

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function shouldShowSplash(): boolean {
  // 何度呼ばれても同じ答え（開発時の StrictMode の二重呼び出しでも 1 回だけ表示）
  if (decision === null) decision = usePrefs.getState().splash && !reducedMotion()
  return decision
}

/**
 * 起動演出：シンボルが浮かび上がり、その下に「cellender」が左から書き込まれるように現れて、約 2 秒で消える。
 * アプリはその裏で読み込みを進める。タップ・キー入力ですぐに閉じられる。
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), HOLD_MS)
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
      <img
        src={markUrl}
        alt=""
        draggable={false}
        className="splash-mark select-none"
        style={{ width: Math.round(MARK_H * MARK_RATIO), height: MARK_H }}
      />
      <img
        src={wordmarkUrl}
        alt=""
        draggable={false}
        className="splash-write mt-6 select-none"
        style={{ width: Math.round(WORDMARK_H * WORDMARK_RATIO), height: WORDMARK_H }}
      />
      <span className="sr-only">cellender 読み込み中</span>
    </div>
  )
}
