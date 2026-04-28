declare module '*.json'

/** JavaScript package `packages/core`; ambient exports used by this plugin. */
declare module '@lorax/core' {
  export const LoraxProvider: any
  export function useLorax(): any
  export const LoraxDeckGL: any

  export function normalizeIntervals(intervals: unknown[] | null): number[]
  export function queryIntervalsSync(
    normalizedIntervals: number[],
    start: number,
    end: number,
  ): { visibleIntervals: number[]; lo: number; hi: number }
  export function new_complete_experiment_map(
    localBins: Map<number, unknown>,
    globalBpPerUnit: number,
    new_globalBp: number,
    options?: {
      selectionStrategy?: string
      viewportStart?: number
      viewportEnd?: number
      prevLocalBins?: Map<number, unknown> | null
    },
  ): {
    return_local_bins: Map<number, unknown>
    displayArray: number[]
    showingAllTrees: boolean
  }
  export function serializeBinsForTransfer(bins: Map<number, unknown>): unknown[]
  export function computeRenderArrays(data: Record<string, unknown>): unknown
}
