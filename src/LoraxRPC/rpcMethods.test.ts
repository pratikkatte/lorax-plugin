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

const mockRenderCaches: Array<{
  computeRenderArrays: jest.Mock
  applyTransform: jest.Mock
  clearBuffers: jest.Mock
}> = []

const mockCreateRenderDataCache = jest.fn(() => {
  const cache = {
    computeRenderArrays: jest.fn((data: unknown) => ({
      kind: 'compute-render-data',
      data,
    })),
    applyTransform: jest.fn((data: unknown) => ({
      kind: 'apply-transform',
      data,
    })),
    clearBuffers: jest.fn(),
  }
  mockRenderCaches.push(cache)
  return cache
})

jest.mock('@jbrowse/core/pluggableElementTypes/RpcMethodType', () => ({
  __esModule: true,
  default: class MockRpcMethodType {},
}))

jest.mock('@lorax/core', () => ({
  normalizeIntervals: mockNormalizeIntervals,
  new_complete_experiment_map: jest.fn(),
  serializeBinsForTransfer: jest.fn(),
  createRenderDataCache: mockCreateRenderDataCache,
}))

jest.mock('@lorax/core/src/workers/modules/intervalUtils.js', () => ({
  buildIntervalsResponse: mockBuildIntervalsResponse,
}))

import {
  LoraxApplyTransformRpcMethod,
  LoraxClearRenderBuffersRpcMethod,
  LoraxComputeRenderDataRpcMethod,
  LoraxConfigRpcMethod,
  LoraxIntervalsRpcMethod,
} from './rpcMethods'

describe('LoraxIntervalsRpcMethod', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    mockNormalizeIntervals.mockClear()
    mockBuildIntervalsResponse.mockClear()
    mockCreateRenderDataCache.mockClear()
    mockRenderCaches.length = 0
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

describe('Lorax render RPC cache', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    mockNormalizeIntervals.mockClear()
    mockBuildIntervalsResponse.mockClear()
    mockCreateRenderDataCache.mockClear()
    mockRenderCaches.length = 0
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it('uses one render cache for compute and apply calls in the same session', async () => {
    const pluginManager = {} as ConstructorParameters<
      typeof LoraxComputeRenderDataRpcMethod
    >[0]
    const computeMethod = new LoraxComputeRenderDataRpcMethod(pluginManager)
    const applyMethod = new LoraxApplyTransformRpcMethod(pluginManager)
    const sessionId = 'rpc-render-same-session'

    const computeResult = await computeMethod.execute({
      sessionId,
      data: { node_id: [1], displayArray: [7] },
    })
    const applyResult = await applyMethod.execute({
      sessionId,
      data: { modelMatrices: [{ key: 7 }] },
    })

    expect(mockCreateRenderDataCache).toHaveBeenCalledTimes(1)
    expect(mockRenderCaches[0].computeRenderArrays).toHaveBeenCalledWith({
      node_id: [1],
      displayArray: [7],
    })
    expect(mockRenderCaches[0].applyTransform).toHaveBeenCalledWith({
      modelMatrices: [{ key: 7 }],
    })
    expect(computeResult).toMatchObject({ kind: 'compute-render-data' })
    expect(applyResult).toMatchObject({ kind: 'apply-transform' })
  })

  it('does not share render caches across sessions', async () => {
    const pluginManager = {} as ConstructorParameters<
      typeof LoraxComputeRenderDataRpcMethod
    >[0]
    const computeMethod = new LoraxComputeRenderDataRpcMethod(pluginManager)
    const applyMethod = new LoraxApplyTransformRpcMethod(pluginManager)

    await computeMethod.execute({
      sessionId: 'rpc-render-session-a',
      data: { node_id: [1], displayArray: [1] },
    })
    await computeMethod.execute({
      sessionId: 'rpc-render-session-b',
      data: { node_id: [2], displayArray: [2] },
    })
    await applyMethod.execute({
      sessionId: 'rpc-render-session-a',
      data: { modelMatrices: [{ key: 1 }] },
    })
    await applyMethod.execute({
      sessionId: 'rpc-render-session-b',
      data: { modelMatrices: [{ key: 2 }] },
    })

    expect(mockCreateRenderDataCache).toHaveBeenCalledTimes(2)
    expect(mockRenderCaches[0].applyTransform).toHaveBeenCalledWith({
      modelMatrices: [{ key: 1 }],
    })
    expect(mockRenderCaches[1].applyTransform).toHaveBeenCalledWith({
      modelMatrices: [{ key: 2 }],
    })
  })

  it('clears only the current session render cache on clear-buffers and config', async () => {
    const pluginManager = {} as ConstructorParameters<
      typeof LoraxComputeRenderDataRpcMethod
    >[0]
    const computeMethod = new LoraxComputeRenderDataRpcMethod(pluginManager)
    const clearMethod = new LoraxClearRenderBuffersRpcMethod(pluginManager)
    const configMethod = new LoraxConfigRpcMethod(pluginManager)

    await computeMethod.execute({
      sessionId: 'rpc-render-clear-a',
      data: { node_id: [1], displayArray: [1] },
    })
    await computeMethod.execute({
      sessionId: 'rpc-render-clear-b',
      data: { node_id: [2], displayArray: [2] },
    })

    await clearMethod.execute({
      sessionId: 'rpc-render-clear-a',
      data: null,
    })
    expect(mockRenderCaches[0].clearBuffers).toHaveBeenCalledTimes(1)
    expect(mockRenderCaches[1].clearBuffers).not.toHaveBeenCalled()

    await configMethod.execute({
      sessionId: 'rpc-render-clear-b',
      data: { intervals: [[0, 10]] },
    })
    expect(mockRenderCaches[0].clearBuffers).toHaveBeenCalledTimes(1)
    expect(mockRenderCaches[1].clearBuffers).toHaveBeenCalledTimes(1)
  })
})
