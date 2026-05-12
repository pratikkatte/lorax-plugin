import { useEffect, useMemo, useState } from 'react'
import type { IntervalCoords } from './useStableIntervalCoords'

export function intervalsEqual(
  a: IntervalCoords | undefined,
  b: IntervalCoords | undefined,
) {
  if (!a || !b) return a === b
  return a[0] === b[0] && a[1] === b[1]
}

export function normalizeIntervalCoords(value: unknown): IntervalCoords {
  if (!Array.isArray(value) || value.length !== 2) {
    return null
  }
  const start = Number(value[0])
  const end = Number(value[1])
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return null
  }
  return [start, end]
}

export function numberArraysEqual(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
) {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function useStartupStableIntervalCoords({
  canUseJBrowseCoords,
  configKey,
  configLoaded,
  fallbackIntervalCoords,
  jbrowseIntervalCoords,
}: {
  canUseJBrowseCoords: boolean
  configKey: string
  configLoaded: boolean
  fallbackIntervalCoords?: unknown
  jbrowseIntervalCoords: IntervalCoords
}) {
  const [acceptedConfigKey, setAcceptedConfigKey] = useState<string | null>(
    null,
  )
  const [candidateState, setCandidateState] = useState<{
    configKey: string
    interval: IntervalCoords
  } | null>(null)
  const accepted = acceptedConfigKey === configKey
  const candidate =
    candidateState?.configKey === configKey ? candidateState.interval : null

  const fallback = useMemo(
    () => normalizeIntervalCoords(fallbackIntervalCoords),
    [fallbackIntervalCoords],
  )

  useEffect(() => {
    if (!configLoaded) {
      setAcceptedConfigKey(null)
      setCandidateState(null)
      return
    }

    if (accepted) {
      return
    }

    if (jbrowseIntervalCoords) {
      if (intervalsEqual(candidate, jbrowseIntervalCoords)) {
        setAcceptedConfigKey(configKey)
        setCandidateState(null)
      } else {
        setCandidateState({ configKey, interval: jbrowseIntervalCoords })
      }
      return
    }

    if (!canUseJBrowseCoords && fallback) {
      setAcceptedConfigKey(configKey)
      setCandidateState(null)
    }
  }, [
    accepted,
    candidate,
    canUseJBrowseCoords,
    configLoaded,
    fallback,
    configKey,
    jbrowseIntervalCoords,
  ])

  if (!configLoaded) {
    return null
  }

  if (accepted) {
    return jbrowseIntervalCoords ?? (!canUseJBrowseCoords ? fallback : null)
  }

  return null
}
