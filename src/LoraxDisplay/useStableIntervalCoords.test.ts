import { renderHook } from '@testing-library/react'
import {
  type IntervalCoords,
  useStableIntervalCoords,
} from './useStableIntervalCoords'

describe('useStableIntervalCoords', () => {
  it('keeps the same tuple reference when numeric values are unchanged', () => {
    const initialCoords: IntervalCoords = [10, 20]
    const { result, rerender } = renderHook(
      ({ coords }: { coords: IntervalCoords }) =>
        useStableIntervalCoords(coords),
      { initialProps: { coords: initialCoords } },
    )
    const stableCoords = result.current
    const sameValueCoords: IntervalCoords = [10, 20]

    rerender({ coords: sameValueCoords })

    expect(result.current).toBe(stableCoords)
    expect(result.current).not.toBe(sameValueCoords)
  })

  it('returns a new tuple reference when numeric values change', () => {
    const { result, rerender } = renderHook(
      ({ coords }: { coords: IntervalCoords }) =>
        useStableIntervalCoords(coords),
      { initialProps: { coords: [10, 20] as IntervalCoords } },
    )
    const stableCoords = result.current

    rerender({ coords: [10, 21] })

    expect(result.current).toEqual([10, 21])
    expect(result.current).not.toBe(stableCoords)
  })

  it('resets to null', () => {
    const { result, rerender } = renderHook(
      ({ coords }: { coords: IntervalCoords }) =>
        useStableIntervalCoords(coords),
      { initialProps: { coords: [10, 20] as IntervalCoords } },
    )
    const firstStableCoords = result.current

    rerender({ coords: null })
    expect(result.current).toBeNull()

    rerender({ coords: [10, 20] })
    expect(result.current).toEqual([10, 20])
    expect(result.current).not.toBe(firstStableCoords)
  })
})
