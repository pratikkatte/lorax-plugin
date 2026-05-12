import { renderHook, waitFor } from '@testing-library/react'
import {
  normalizeIntervalCoords,
  numberArraysEqual,
  useStartupStableIntervalCoords,
} from './startupViewport'
import type { IntervalCoords } from './useStableIntervalCoords'

describe('startup viewport gating', () => {
  it('does not expose JBrowse coordinates before config is loaded', async () => {
    const fallbackIntervalCoords: IntervalCoords = [1, 2]
    const jbrowseIntervalCoords: IntervalCoords = [100, 200]
    const { result, rerender } = renderHook(
      ({ configLoaded }: { configLoaded: boolean }) =>
        useStartupStableIntervalCoords({
          canUseJBrowseCoords: true,
          configKey: 'file-a',
          configLoaded,
          fallbackIntervalCoords,
          jbrowseIntervalCoords,
        }),
      {
        initialProps: { configLoaded: false },
      },
    )

    expect(result.current).toBeNull()

    rerender({ configLoaded: true })

    await waitFor(() => {
      expect(result.current).toEqual(jbrowseIntervalCoords)
    })
  })

  it('waits for a repeated JBrowse interval after an unstable startup interval', async () => {
    const { result, rerender } = renderHook(
      ({ coords }: { coords: IntervalCoords }) =>
        useStartupStableIntervalCoords({
          canUseJBrowseCoords: true,
          configKey: 'file-a',
          configLoaded: true,
          fallbackIntervalCoords: [1, 2],
          jbrowseIntervalCoords: coords,
        }),
      {
        initialProps: { coords: null as IntervalCoords },
      },
    )

    expect(result.current).toBeNull()

    rerender({ coords: [100, 200] })
    rerender({ coords: [101, 201] })

    await waitFor(() => {
      expect(result.current).toEqual([101, 201])
    })
  })

  it('keeps JBrowse coordinates dominant over backend initial_position', async () => {
    const { result } = renderHook(() =>
      useStartupStableIntervalCoords({
        canUseJBrowseCoords: true,
        configKey: 'file-a',
        configLoaded: true,
        fallbackIntervalCoords: [10, 20],
        jbrowseIntervalCoords: [300, 400],
      }),
    )

    await waitFor(() => {
      expect(result.current).toEqual([300, 400])
    })
  })

  it('passes later JBrowse changes through after startup acceptance', async () => {
    const { result, rerender } = renderHook(
      ({ coords }: { coords: IntervalCoords }) =>
        useStartupStableIntervalCoords({
          canUseJBrowseCoords: true,
          configKey: 'file-a',
          configLoaded: true,
          fallbackIntervalCoords: [10, 20],
          jbrowseIntervalCoords: coords,
        }),
      {
        initialProps: { coords: [300, 400] as IntervalCoords },
      },
    )

    await waitFor(() => {
      expect(result.current).toEqual([300, 400])
    })

    rerender({ coords: [500, 600] })

    expect(result.current).toEqual([500, 600])
  })

  it('uses backend initial_position only when JBrowse cannot provide coords', async () => {
    const { result } = renderHook(() =>
      useStartupStableIntervalCoords({
        canUseJBrowseCoords: false,
        configKey: 'file-a',
        configLoaded: true,
        fallbackIntervalCoords: [10, 20],
        jbrowseIntervalCoords: null,
      }),
    )

    await waitFor(() => {
      expect(result.current).toEqual([10, 20])
    })
  })

  it('does not expose null JBrowse coords while JBrowse coordinate support exists', () => {
    const { result } = renderHook(() =>
      useStartupStableIntervalCoords({
        canUseJBrowseCoords: true,
        configKey: 'file-a',
        configLoaded: true,
        fallbackIntervalCoords: [10, 20],
        jbrowseIntervalCoords: null,
      }),
    )

    expect(result.current).toBeNull()
  })

  it('normalizes valid interval tuples and rejects invalid values', () => {
    expect(normalizeIntervalCoords(['10', '20'])).toEqual([10, 20])
    expect(normalizeIntervalCoords(['20', '10'])).toBeNull()
    expect(normalizeIntervalCoords(['x', '20'])).toBeNull()
  })

  it('compares number arrays by contents', () => {
    expect(numberArraysEqual([1, 2], [1, 2])).toBe(true)
    expect(numberArraysEqual([1, 2], [1, 3])).toBe(false)
    expect(numberArraysEqual([1, 2], [1, 2, 3])).toBe(false)
  })
})
