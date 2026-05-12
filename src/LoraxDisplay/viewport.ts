export type JBrowseBpPosition = {
  coord?: number
  end?: number
  index?: number
  refName?: string
  start?: number
}

export type JBrowseContentBlock = {
  end?: number
  offsetPx?: number
  refName?: string
  start?: number
  widthPx?: number
}

export type JBrowseLinearViewLike = {
  dynamicBlocks?: {
    contentBlocks?: JBrowseContentBlock[]
  }
  offsetPx?: number
  pxToBp?: (px: number) => JBrowseBpPosition
  width?: number
}

export type StrictVisibleRegion = {
  intervalCoords: [number, number] | null
  placement: {
    leftPx: number
    widthPx: number
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function finiteNumber(value: unknown): number | null {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function clampPositionCoord(position: JBrowseBpPosition | null | undefined) {
  const coord = finiteNumber(position?.coord)
  if (coord == null) return null

  const start = finiteNumber(position?.start)
  const end = finiteNumber(position?.end)
  if (start == null || end == null || start >= end) {
    return coord
  }

  return clamp(coord, start, end)
}

function toIntervalFromPositions(
  left: JBrowseBpPosition | null | undefined,
  right: JBrowseBpPosition | null | undefined,
): [number, number] | null {
  if (!left || !right) return null
  if (left.refName !== right.refName) return null
  if (left.index != null && right.index != null && left.index !== right.index) {
    return null
  }

  const leftCoord = clampPositionCoord(left)
  const rightCoord = clampPositionCoord(right)
  if (leftCoord == null || rightCoord == null) return null

  const start = Math.floor(Math.min(leftCoord, rightCoord))
  const end = Math.ceil(Math.max(leftCoord, rightCoord))
  return start < end ? [start, end] : null
}

function getBlockScreenBounds(
  block: JBrowseContentBlock,
  viewOffsetPx: number,
  viewWidth: number,
) {
  const blockOffsetPx = finiteNumber(block.offsetPx)
  const blockWidthPx = finiteNumber(block.widthPx)
  if (blockOffsetPx == null || blockWidthPx == null || blockWidthPx <= 0) {
    return null
  }

  const leftPx = blockOffsetPx - viewOffsetPx
  const rightPx = leftPx + blockWidthPx
  if (rightPx <= 0 || leftPx >= viewWidth) return null

  return {
    leftPx: clamp(leftPx, 0, viewWidth),
    rightPx: clamp(rightPx, 0, viewWidth),
  }
}

export function computeStrictVisibleRegion(
  view: JBrowseLinearViewLike | null | undefined,
): StrictVisibleRegion {
  const viewWidth = finiteNumber(view?.width) ?? 0
  const viewOffsetPx = finiteNumber(view?.offsetPx) ?? 0
  const fallback = {
    intervalCoords: null,
    placement: { leftPx: 0, widthPx: Math.max(0, viewWidth) },
  }
  if (!view || viewWidth <= 0 || typeof view.pxToBp !== 'function') {
    return fallback
  }

  const blocks = view.dynamicBlocks?.contentBlocks ?? []
  const visibleBlocks = blocks
    .map(block => ({
      block,
      bounds: getBlockScreenBounds(block, viewOffsetPx, viewWidth),
    }))
    .filter(
      (
        entry,
      ): entry is {
        block: JBrowseContentBlock
        bounds: { leftPx: number; rightPx: number }
      } => Boolean(entry.bounds && entry.bounds.rightPx > entry.bounds.leftPx),
    )

  if (visibleBlocks.length === 0) {
    const intervalCoords = toIntervalFromPositions(
      view.pxToBp(0),
      view.pxToBp(viewWidth),
    )
    return { ...fallback, intervalCoords }
  }

  const first = visibleBlocks[0]
  const last = visibleBlocks[visibleBlocks.length - 1]
  const leftPx = first.bounds.leftPx
  const rightPx = last.bounds.rightPx

  let intervalCoords = toIntervalFromPositions(
    view.pxToBp(leftPx),
    view.pxToBp(rightPx),
  )
  if (!intervalCoords) {
    intervalCoords = toIntervalFromPositions(
      view.pxToBp(first.bounds.leftPx),
      view.pxToBp(first.bounds.rightPx),
    )
  }

  return {
    intervalCoords,
    placement: {
      leftPx,
      widthPx: Math.max(0, rightPx - leftPx),
    },
  }
}
