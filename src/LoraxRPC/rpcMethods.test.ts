const mockNormalizeIntervals = jest.fn((intervals: unknown[] | null) => {
  if (!Array.isArray(intervals)) return []
  if (Array.isArray(intervals[0])) {
    return intervals.map(interval => Number((interval as unknown[])[0]))
  }
  return intervals.map(Number)
})

const mockBuildIntervalsResponse = jest.fn(
  (
    normalizedIntervals: number[],
    start: number,
    end: number,
    maxIntervals = 2000,
  ) => {
    if (
      !Array.isArray(normalizedIntervals) ||
      normalizedIntervals.length === 0
    ) {
      return { visibleIntervals: [], lo: 0, hi: 0, count: 0 }
    }

    const lo = Math.max(
      0,
      normalizedIntervals.findIndex(intervalStart => intervalStart >= start),
    )
    const hiIndex = normalizedIntervals.findLastIndex(
      intervalStart => intervalStart <= end,
    )
    const hi = hiIndex === -1 ? lo : hiIndex + 1
    const slice = normalizedIntervals.slice(lo, hi)
    const count = slice.length
    const step =
      Number.isFinite(maxIntervals) && maxIntervals > 0 && count > maxIntervals
        ? Math.ceil(count / maxIntervals)
        : 1
    const visibleIntervals = slice.filter((_, index) => index % step === 0)

    return { visibleIntervals, lo, hi, count }
  },
)

jest.mock('@jbrowse/core/pluggableElementTypes/RpcMethodType', () => ({
  __esModule: true,
  default: class MockRpcMethodType {},
}))

jest.mock('@lorax/core', () => ({
  normalizeIntervals: mockNormalizeIntervals,
  new_complete_experiment_map: jest.fn(),
  serializeBinsForTransfer: jest.fn(),
  computeRenderArrays: jest.fn(),
}))

jest.mock('@lorax/core/src/workers/modules/intervalUtils.js', () => ({
  buildIntervalsResponse: mockBuildIntervalsResponse,
}))

import { LoraxConfigRpcMethod, LoraxIntervalsRpcMethod } from './rpcMethods'

describe('LoraxIntervalsRpcMethod', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    mockNormalizeIntervals.mockClear()
    mockBuildIntervalsResponse.mockClear()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('forwards maxIntervals, caps visible intervals, and preserves count', async () => {
    const sessionId = 'rpc-intervals-lod'
    const pluginManager = {} as ConstructorParameters<
      typeof LoraxConfigRpcMethod
    >[0]
    const configMethod = new LoraxConfigRpcMethod(pluginManager)
    const intervalsMethod = new LoraxIntervalsRpcMethod(pluginManager)
    const intervals = Array.from({ length: 10 }, (_, index) => [
      index * 10,
      (index + 1) * 10,
    ])

    await configMethod.execute({ sessionId, data: { intervals } })
    const result = await intervalsMethod.execute({
      sessionId,
      data: { start: 0, end: 100, maxIntervals: 3 },
    })

    expect(mockBuildIntervalsResponse).toHaveBeenCalledWith(
      [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
      0,
      100,
      3,
    )
    expect(result.count).toBe(10)
    expect(result.visibleIntervals.length).toBeLessThanOrEqual(3)
    expect(result).toMatchObject({ lo: 0, hi: 10 })
  })

  it('returns count 0 for an unconfigured session and defaults maxIntervals', async () => {
    const pluginManager = {} as ConstructorParameters<
      typeof LoraxIntervalsRpcMethod
    >[0]
    const intervalsMethod = new LoraxIntervalsRpcMethod(pluginManager)

    const result = await intervalsMethod.execute({
      sessionId: 'rpc-intervals-empty',
      data: { start: 0, end: 100 },
    })

    expect(mockBuildIntervalsResponse).toHaveBeenCalledWith([], 0, 100, 2000)
    expect(result).toEqual({
      visibleIntervals: [],
      lo: 0,
      hi: 0,
      count: 0,
    })
  })
})
