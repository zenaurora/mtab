import type { GridBounds } from './gridLayout'

export type CanvasGridInput = {
  viewportWidth: number
  viewportHeight: number
  cellSize: number
  padding: {
    left: number
    right: number
    top: number
    bottom: number
  }
}

type GridPosition = { gridX: number; gridY: number }
type GridSize = { gridW: number; gridH: number }
type PixelPosition = { x: number; y: number }

export type CanvasGrid = {
  cellSize: number
  origin: PixelPosition
  columns: number
  rows: number
  boundsFor: (size?: Partial<GridSize>) => GridBounds
  clamp: (position: GridPosition, size?: Partial<GridSize>) => GridPosition
  toPixels: (position: GridPosition) => PixelPosition
  snapPixels: (position: PixelPosition, size?: Partial<GridSize>) => GridPosition
}

/**
 * The single coordinate seam for the desktop. Persisted positions are always
 * non-negative grid indexes from the visible canvas's top-left cell. Any spare
 * pixels are split around the grid so left/right and top/bottom remain balanced.
 */
export function createCanvasGrid(input: CanvasGridInput): CanvasGrid {
  const cellSize = Math.max(1, input.cellSize)
  const left = clampPadding(input.padding.left, input.viewportWidth)
  const right = clampPadding(input.padding.right, input.viewportWidth - left)
  const top = clampPadding(input.padding.top, input.viewportHeight)
  const bottom = clampPadding(input.padding.bottom, input.viewportHeight - top)
  const usableWidth = Math.max(0, input.viewportWidth - left - right)
  const usableHeight = Math.max(0, input.viewportHeight - top - bottom)
  const columns = Math.max(1, Math.floor(usableWidth / cellSize))
  const rows = Math.max(1, Math.floor(usableHeight / cellSize))
  const origin = {
    x: left + Math.max(0, usableWidth - columns * cellSize) / 2,
    y: top + Math.max(0, usableHeight - rows * cellSize) / 2,
  }

  function boundsFor(size: Partial<GridSize> = {}): GridBounds {
    const gridW = positiveInteger(size.gridW)
    const gridH = positiveInteger(size.gridH)
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(0, columns - gridW),
      maxY: Math.max(0, rows - gridH),
    }
  }

  function clamp(position: GridPosition, size: Partial<GridSize> = {}): GridPosition {
    const bounds = boundsFor(size)
    return {
      gridX: clampNumber(Math.round(position.gridX), bounds.minX, bounds.maxX),
      gridY: clampNumber(Math.round(position.gridY), bounds.minY, bounds.maxY),
    }
  }

  function toPixels(position: GridPosition): PixelPosition {
    return {
      x: origin.x + position.gridX * cellSize,
      y: origin.y + position.gridY * cellSize,
    }
  }

  function snapPixels(position: PixelPosition, size: Partial<GridSize> = {}): GridPosition {
    return clamp({
      gridX: Math.round((position.x - origin.x) / cellSize),
      gridY: Math.round((position.y - origin.y) / cellSize),
    }, size)
  }

  return { cellSize, origin, columns, rows, boundsFor, clamp, toPixels, snapPixels }
}

function positiveInteger(value: number | undefined): number {
  return Number.isInteger(value) && (value as number) > 0 ? value as number : 1
}

function clampPadding(value: number, available: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, Math.max(0, available)))
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
