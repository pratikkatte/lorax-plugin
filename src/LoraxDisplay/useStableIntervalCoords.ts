import { useRef } from 'react'

export type IntervalCoords = [number, number] | null

export function useStableIntervalCoords(
  intervalCoords: IntervalCoords,
): IntervalCoords {
  const stableIntervalCoordsRef = useRef<IntervalCoords>(null)

  if (!intervalCoords) {
    stableIntervalCoordsRef.current = null
    return null
  }

  const previousIntervalCoords = stableIntervalCoordsRef.current
  if (
    previousIntervalCoords &&
    previousIntervalCoords[0] === intervalCoords[0] &&
    previousIntervalCoords[1] === intervalCoords[1]
  ) {
    return previousIntervalCoords
  }

  stableIntervalCoordsRef.current = intervalCoords
  return intervalCoords
}
