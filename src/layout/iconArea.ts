import type { GridBounds, GridRect } from './gridLayout'

export const ICON_AREA_MAX_INSET_PERCENT = 40

export type IconAreaFrame = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type IconAreaLayoutInput = {
  viewport: {
    width: number
    height: number
    horizontalPadding: number
    topPadding: number
    bottomPadding: number
  }
  grid: {
    cellSize: number
    offsetX: number
    offsetY: number
  }
  insets: {
    leftPercent: number
    rightPercent: number
  }
  requiredCells: number
  blockers: GridRect[]
}

export type IconAreaLayout = {
  requestedFrame: IconAreaFrame
  frame: IconAreaFrame
  requestedGridBounds: GridBounds
  gridBounds: GridBounds
  expandedForCapacity: boolean
}

export function clampIconAreaInset(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.max(0, Math.min(ICON_AREA_MAX_INSET_PERCENT, percent))
}

/**
 * Convert user-facing screen insets into a pixel frame, then derive the grid
 * cells that fit inside it. The visible frame remains pixel-based; grid
 * snapping is an internal placement detail.
 */
export function calculateIconAreaLayout(input: IconAreaLayoutInput): IconAreaLayout {
  const baseFrame = createFrame(input, 0, 0)
  const requestedFrame = createFrame(
    input,
    clampIconAreaInset(input.insets.leftPercent),
    clampIconAreaInset(input.insets.rightPercent),
  )
  const viewportBounds = gridBoundsWithin(baseFrame, input.grid)
  const requestedGridBounds = gridBoundsWithin(requestedFrame, input.grid)

  if (countAvailableCells(requestedGridBounds, input.blockers) >= input.requiredCells) {
    return {
      requestedFrame,
      frame: requestedFrame,
      requestedGridBounds,
      gridBounds: requestedGridBounds,
      expandedForCapacity: false,
    }
  }

  const requestedLeftColumns = requestedGridBounds.minX - viewportBounds.minX
  const requestedRightColumns = viewportBounds.maxX - requestedGridBounds.maxX
  let best: {
    bounds: GridBounds
    expansion: number
    preferenceCost: number
    imbalance: number
  } | null = null

  for (let minX = requestedGridBounds.minX; minX >= viewportBounds.minX; minX--) {
    for (let maxX = requestedGridBounds.maxX; maxX <= viewportBounds.maxX; maxX++) {
      const candidate = { ...viewportBounds, minX, maxX }
      if (countAvailableCells(candidate, input.blockers) < input.requiredCells) continue
      const leftExpansion = requestedGridBounds.minX - minX
      const rightExpansion = maxX - requestedGridBounds.maxX
      const expansion = leftExpansion + rightExpansion
      const preferenceCost =
        leftExpansion / Math.max(1, requestedLeftColumns) +
        rightExpansion / Math.max(1, requestedRightColumns)
      const imbalance = Math.abs(leftExpansion - rightExpansion)
      if (
        !best ||
        expansion < best.expansion ||
        (expansion === best.expansion && preferenceCost < best.preferenceCost) ||
        (
          expansion === best.expansion &&
          preferenceCost === best.preferenceCost &&
          imbalance < best.imbalance
        )
      ) {
        best = { bounds: candidate, expansion, preferenceCost, imbalance }
      }
    }
  }

  const gridBounds = best?.bounds ?? viewportBounds
  return {
    requestedFrame,
    frame: frameContainingGrid(requestedFrame, gridBounds, input.grid, baseFrame),
    requestedGridBounds,
    gridBounds,
    expandedForCapacity: true,
  }
}

function createFrame(
  input: IconAreaLayoutInput,
  leftPercent: number,
  rightPercent: number,
): IconAreaFrame {
  const { width, height, horizontalPadding, topPadding, bottomPadding } = input.viewport
  const safeHorizontalPadding = Math.max(0, Math.min(horizontalPadding, width / 2))
  const usableWidth = Math.max(0, width - safeHorizontalPadding * 2)
  const left = safeHorizontalPadding + usableWidth * leftPercent / 100
  const right = width - safeHorizontalPadding - usableWidth * rightPercent / 100
  const top = Math.max(0, Math.min(topPadding, height))
  const bottom = Math.max(top, height - bottomPadding)
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

function gridBoundsWithin(
  frame: IconAreaFrame,
  grid: IconAreaLayoutInput['grid'],
): GridBounds {
  const { cellSize, offsetX, offsetY } = grid
  let minX = Math.ceil((frame.left - offsetX) / cellSize)
  let maxX = Math.floor((frame.right - offsetX - cellSize) / cellSize)
  let minY = Math.ceil((frame.top - offsetY) / cellSize)
  let maxY = Math.floor((frame.bottom - offsetY - cellSize) / cellSize)

  if (minX > maxX) {
    minX = Math.round(((frame.left + frame.right - cellSize) / 2 - offsetX) / cellSize)
    maxX = minX
  }
  if (minY > maxY) {
    minY = Math.round(((frame.top + frame.bottom - cellSize) / 2 - offsetY) / cellSize)
    maxY = minY
  }
  return { minX, minY, maxX, maxY }
}

function countAvailableCells(bounds: GridBounds, blockers: GridRect[]): number {
  let count = 0
  for (let gridY = bounds.minY; gridY <= bounds.maxY; gridY++) {
    for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX++) {
      const blocked = blockers.some((rect) =>
        gridX >= rect.gridX &&
        gridX < rect.gridX + rect.gridW &&
        gridY >= rect.gridY &&
        gridY < rect.gridY + rect.gridH,
      )
      if (!blocked) count++
    }
  }
  return count
}

function frameContainingGrid(
  requested: IconAreaFrame,
  bounds: GridBounds,
  grid: IconAreaLayoutInput['grid'],
  limit: IconAreaFrame,
): IconAreaFrame {
  const gridLeft = grid.offsetX + bounds.minX * grid.cellSize
  const gridRight = grid.offsetX + (bounds.maxX + 1) * grid.cellSize
  const left = Math.max(limit.left, Math.min(requested.left, gridLeft))
  const right = Math.min(limit.right, Math.max(requested.right, gridRight))
  return {
    ...requested,
    left,
    right,
    width: Math.max(0, right - left),
  }
}
