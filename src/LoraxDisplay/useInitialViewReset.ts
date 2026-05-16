import { RefObject, useEffect, useRef, useState } from 'react'

interface DeckRef {
  viewAdjustY?: () => boolean
}

export function useInitialViewReset({
  deckRef,
  loadKey,
  ready,
  retryMs = 50,
  maxAttempts = 30,
}: {
  deckRef: RefObject<DeckRef>
  loadKey: string | null
  ready: boolean
  retryMs?: number
  maxAttempts?: number
}) {
  const completedKeyRef = useRef<string | null>(null)
  const attemptRef = useRef({ key: null as string | null, count: 0 })
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    if (!loadKey || !ready) return
    if (completedKeyRef.current === loadKey) return

    if (attemptRef.current.key !== loadKey) {
      attemptRef.current = { key: loadKey, count: 0 }
    }

    const scheduleFrame =
      window.requestAnimationFrame ||
      ((callback: FrameRequestCallback) => window.setTimeout(callback, 0))
    const cancelFrame = window.cancelAnimationFrame || window.clearTimeout
    let retryTimerId: number | undefined

    const scheduleRetry = () => {
      const attempts = attemptRef.current.count + 1
      attemptRef.current = { key: loadKey, count: attempts }
      if (attempts >= maxAttempts) return

      retryTimerId = window.setTimeout(() => {
        setRetryTick(tick => tick + 1)
      }, retryMs)
    }

    const frameId = scheduleFrame(() => {
      const resetInitialView = deckRef.current?.viewAdjustY
      if (typeof resetInitialView !== 'function') {
        scheduleRetry()
        return
      }

      if (resetInitialView() === false) {
        scheduleRetry()
        return
      }
      completedKeyRef.current = loadKey
    })

    return () => {
      cancelFrame(frameId)
      if (retryTimerId !== undefined) {
        window.clearTimeout(retryTimerId)
      }
    }
  }, [deckRef, loadKey, maxAttempts, ready, retryMs, retryTick])
}
