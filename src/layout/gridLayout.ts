type CellKey = `${number},${number}`

type GridPosition = {
  gridX: number
  gridY: number
}

type GridSize = {
  gridW: number
  gridH: number
}

export type GridBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type MovableGridItem = GridPosition & {
  id: string
}

export type GridRect = GridPosition & GridSize

export type GridPositionPatch = GridPosition & {
  id: string
}

export type GridSnapshot = {
  movable: Map<CellKey, MovableGridItem>
  blocked: Set<CellKey>
}

export type DropPlan = {
  patches: GridPositionPatch[]
  occupied: boolean
}

export type BlockerDropPlan = DropPlan & {
  position: GridPosition
}

function cellKey(gridX: number, gridY: number): CellKey {
  return `${gridX},${gridY}`
}

export function createGridSnapshot(
  movableItems: MovableGridItem[],
  blockerRects: GridRect[],
  excludeId?: string,
): GridSnapshot {
  const snapshot: GridSnapshot = {
    movable: new Map(),
    blocked: new Set(),
  }

  for (const item of movableItems) {
    if (item.id !== excludeId) occupyMovable(snapshot, item)
  }
  for (const rect of blockerRects) occupyBlocker(snapshot, rect)

  return snapshot
}

function cloneGridSnapshot(snapshot: GridSnapshot): GridSnapshot {
  return {
    movable: new Map(snapshot.movable),
    blocked: new Set(snapshot.blocked),
  }
}

export function occupyMovable(snapshot: GridSnapshot, item: MovableGridItem): void {
  snapshot.movable.set(cellKey(item.gridX, item.gridY), item)
}

export function occupyBlocker(snapshot: GridSnapshot, rect: GridRect): void {
  for (let dx = 0; dx < rect.gridW; dx++) {
    for (let dy = 0; dy < rect.gridH; dy++) {
      snapshot.blocked.add(cellKey(rect.gridX + dx, rect.gridY + dy))
    }
  }
}

function isGridCellOccupied(snapshot: GridSnapshot, gridX: number, gridY: number): boolean {
  const key = cellKey(gridX, gridY)
  return snapshot.movable.has(key) || snapshot.blocked.has(key)
}

function isGridAreaOccupied(
  snapshot: GridSnapshot,
  gridX: number,
  gridY: number,
  gridW: number,
  gridH: number,
): boolean {
  for (let dx = 0; dx < gridW; dx++) {
    for (let dy = 0; dy < gridH; dy++) {
      if (isGridCellOccupied(snapshot, gridX + dx, gridY + dy)) return true
    }
  }
  return false
}

function isGridAreaBlocked(
  snapshot: GridSnapshot,
  gridX: number,
  gridY: number,
  gridW: number,
  gridH: number,
): boolean {
  for (let dx = 0; dx < gridW; dx++) {
    for (let dy = 0; dy < gridH; dy++) {
      if (snapshot.blocked.has(cellKey(gridX + dx, gridY + dy))) return true
    }
  }
  return false
}

function clampGridPosition(
  position: GridPosition,
  _size: GridSize,
  bounds: GridBounds,
): GridPosition {
  return {
    gridX: Math.min(bounds.maxX, Math.max(bounds.minX, position.gridX)),
    gridY: Math.min(bounds.maxY, Math.max(bounds.minY, position.gridY)),
  }
}

export function findNearestFreePosition(
  snapshot: GridSnapshot,
  preferred: GridPosition,
  size: GridSize,
  bounds: GridBounds,
): GridPosition {
  const start = clampGridPosition(preferred, size, bounds)
  if (!isGridAreaOccupied(snapshot, start.gridX, start.gridY, size.gridW, size.gridH)) {
    return start
  }

  const maxRadius = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + 1
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
        const gridX = start.gridX + dx
        const gridY = start.gridY + dy
        if (gridX < bounds.minX || gridX > bounds.maxX || gridY < bounds.minY || gridY > bounds.maxY) {
          continue
        }
        if (!isGridAreaOccupied(snapshot, gridX, gridY, size.gridW, size.gridH)) {
          return { gridX, gridY }
        }
      }
    }
  }

  return start
}

function findNearestUnblockedPosition(
  snapshot: GridSnapshot,
  preferred: GridPosition,
  size: GridSize,
  bounds: GridBounds,
): GridPosition {
  const start = clampGridPosition(preferred, size, bounds)
  if (!isGridAreaBlocked(snapshot, start.gridX, start.gridY, size.gridW, size.gridH)) {
    return start
  }

  const maxRadius = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) + 1
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
        const gridX = start.gridX + dx
        const gridY = start.gridY + dy
        if (gridX < bounds.minX || gridX > bounds.maxX || gridY < bounds.minY || gridY > bounds.maxY) {
          continue
        }
        if (!isGridAreaBlocked(snapshot, gridX, gridY, size.gridW, size.gridH)) {
          return { gridX, gridY }
        }
      }
    }
  }

  return start
}

export function planBlockerDrop(
  target: GridPosition,
  size: GridSize,
  baseSnapshot: GridSnapshot,
  blockerBounds: GridBounds,
  movableBounds: GridBounds,
): BlockerDropPlan {
  // Widgets may displace one-cell movable items, but never overlap fixed
  // blockers such as the search bar or another widget.
  const position = findNearestUnblockedPosition(baseSnapshot, target, size, blockerBounds)
  const snapshot = cloneGridSnapshot(baseSnapshot)
  const displaced = new Map<string, MovableGridItem>()

  for (let dx = 0; dx < size.gridW; dx++) {
    for (let dy = 0; dy < size.gridH; dy++) {
      const occupant = snapshot.movable.get(cellKey(position.gridX + dx, position.gridY + dy))
      if (occupant) displaced.set(occupant.id, occupant)
    }
  }

  for (const item of displaced.values()) {
    snapshot.movable.delete(cellKey(item.gridX, item.gridY))
  }
  occupyBlocker(snapshot, { ...position, ...size })

  const patches: GridPositionPatch[] = []
  for (const item of displaced.values()) {
    const free = findNearestFreePosition(
      snapshot,
      item,
      { gridW: 1, gridH: 1 },
      movableBounds,
    )
    const patch = { id: item.id, ...free }
    occupyMovable(snapshot, patch)
    patches.push(patch)
  }

  const targetWasBlocked = position.gridX !== target.gridX || position.gridY !== target.gridY
  return { position, patches, occupied: targetWasBlocked || displaced.size > 0 }
}

export function findFirstFreePosition(
  snapshot: GridSnapshot,
  size: GridSize,
  bounds: GridBounds,
  startRow = bounds.minY,
): GridPosition {
  for (let gridY = Math.max(bounds.minY, startRow); gridY <= bounds.maxY; gridY++) {
    for (let gridX = bounds.minX; gridX <= bounds.maxX; gridX++) {
      if (!isGridAreaOccupied(snapshot, gridX, gridY, size.gridW, size.gridH)) {
        return { gridX, gridY }
      }
    }
  }
  return { gridX: bounds.minX, gridY: Math.max(bounds.minY, startRow) }
}

export function planMovableDrop(
  id: string,
  target: GridPosition,
  origin: GridPosition,
  baseSnapshot: GridSnapshot,
  bounds: GridBounds,
): DropPlan {
  const drop = clampGridPosition(target, { gridW: 1, gridH: 1 }, bounds)
  const snapshot = cloneGridSnapshot(baseSnapshot)
  const occupant = snapshot.movable.get(cellKey(drop.gridX, drop.gridY))
  const blocked = snapshot.blocked.has(cellKey(drop.gridX, drop.gridY))
  const occupied = Boolean(occupant || blocked)

  if (occupant) {
    const patches: GridPositionPatch[] = []
    planCascadeShift(snapshot, drop, origin, patches, bounds)
    patches.push({ id, ...drop })
    return { patches, occupied }
  }

  if (blocked) {
    const position = findNearestFreePosition(
      snapshot,
      drop,
      { gridW: 1, gridH: 1 },
      bounds,
    )
    return { patches: [{ id, ...position }], occupied }
  }

  return { patches: [{ id, ...drop }], occupied }
}

export function resolveGridPatches(
  patches: GridPositionPatch[],
  currentItems: MovableGridItem[],
  blockerRects: GridRect[],
  bounds: GridBounds,
): GridPositionPatch[] {
  const movingIds = new Set(patches.map((patch) => patch.id))
  const snapshot = createGridSnapshot(
    currentItems.filter((item) => !movingIds.has(item.id)),
    blockerRects,
  )
  const result: GridPositionPatch[] = []

  for (const patch of patches) {
    const clamped = clampGridPosition(patch, { gridW: 1, gridH: 1 }, bounds)
    const position = isGridCellOccupied(snapshot, clamped.gridX, clamped.gridY)
      ? findNearestFreePosition(snapshot, clamped, { gridW: 1, gridH: 1 }, bounds)
      : clamped
    const resolved = { id: patch.id, ...position }
    occupyMovable(snapshot, resolved)
    result.push(resolved)
  }

  return result
}

function planCascadeShift(
  snapshot: GridSnapshot,
  position: GridPosition,
  origin: GridPosition,
  patches: GridPositionPatch[],
  bounds: GridBounds,
  depth = 0,
): void {
  if (depth > 10) return

  const push = pushDirection(position, origin)
  const target = {
    gridX: position.gridX + push.gridX,
    gridY: position.gridY + push.gridY,
  }
  const targetInBounds = isWithinBounds(target, bounds)
  const blocker = targetInBounds ? snapshot.movable.get(cellKey(target.gridX, target.gridY)) : undefined

  if (blocker) {
    planCascadeShift(snapshot, target, position, patches, bounds, depth + 1)
  }

  const item = snapshot.movable.get(cellKey(position.gridX, position.gridY))
  if (!item) return

  if (!targetInBounds || isGridCellOccupied(snapshot, target.gridX, target.gridY)) {
    const free = findNearestFreePosition(
      snapshot,
      position,
      { gridW: 1, gridH: 1 },
      bounds,
    )
    moveInSnapshot(snapshot, item, free, patches)
    return
  }

  moveInSnapshot(snapshot, item, target, patches)
}

function moveInSnapshot(
  snapshot: GridSnapshot,
  item: MovableGridItem,
  position: GridPosition,
  patches: GridPositionPatch[],
): void {
  snapshot.movable.delete(cellKey(item.gridX, item.gridY))
  const moved = { id: item.id, ...position }
  occupyMovable(snapshot, moved)
  patches.push(moved)
}

function pushDirection(position: GridPosition, origin: GridPosition): GridPosition {
  const dx = position.gridX - origin.gridX
  const dy = position.gridY - origin.gridY
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { gridX: dx > 0 ? 1 : dx < 0 ? -1 : 1, gridY: 0 }
  }
  return { gridX: 0, gridY: dy > 0 ? 1 : dy < 0 ? -1 : 1 }
}

function isWithinBounds(position: GridPosition, bounds: GridBounds): boolean {
  return (
    position.gridX >= bounds.minX &&
    position.gridX <= bounds.maxX &&
    position.gridY >= bounds.minY &&
    position.gridY <= bounds.maxY
  )
}
