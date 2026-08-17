<script setup lang="ts">
import { ref, computed, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import type { Bookmark } from '../types'
import ClockWidget from './widgets/ClockWidget.vue'
import DateWidget from './widgets/DateWidget.vue'
import NotesWidget from './widgets/NotesWidget.vue'
import SearchWidget from './widgets/SearchWidget.vue'
import BookmarkWidget from './widgets/BookmarkWidget.vue'
import BookmarkIcon from './BookmarkIcon.vue'
import BookmarkEditorModal from './BookmarkEditorModal.vue'
import {
  createGridSnapshot,
  findNearestFreePosition,
  occupyMovable,
  planMovableDrop,
  resolveGridPatches,
  type DropPlan,
  type GridPositionPatch,
  type GridRect,
  type GridSnapshot,
  type MovableGridItem,
} from '../layout/gridLayout'

const store = useSettingsStore()

const DRAG_THRESHOLD = 6
const ADD_BTN_ID = '__add_btn__'

// ── Shared drag state ────────────────────────────────────────
const isDragging = ref(false)
const pendingDrag = ref(false)
const dragKind = ref<'widget' | 'icon'>('icon')
const draggingId = ref<string | null>(null)
let ghostXRaw = 0
let ghostYRaw = 0
const dragOffsetX = ref(0)
const dragOffsetY = ref(0)
const startX = ref(0)
const startY = ref(0)
const dragW = ref(0)
const dragH = ref(0)
const ghostEl = ref<HTMLElement | null>(null)
const dropIndicatorEl = ref<HTMLElement | null>(null)
const viewportWidth = ref(typeof window === 'undefined' ? 1440 : window.innerWidth)
const viewportHeight = ref(typeof window === 'undefined' ? 900 : window.innerHeight)
let rafId = 0
let justDragged = false
let lastSnapGridX = -1
let lastSnapGridY = -1
const instantMoveIds = ref<Set<string>>(new Set())

type BookmarkPositionPatch = GridPositionPatch

// ── Grid snap state ──────────────────────────────────────────
const snapGridX = ref(0)
const snapGridY = ref(0)
const dragStartGridX = ref(0)
const dragStartGridY = ref(0)
// reactive allows Vue to track per-key accesses, so only affected icons re-render on drag
const previewPositions = reactive<Record<string, { gridX: number; gridY: number }>>({})
let dragSnapshot: GridSnapshot | null = null
let lastDropPlan: DropPlan | null = null

// ── Computed ─────────────────────────────────────────────────
const draggingWidget = computed(() =>
  dragKind.value === 'widget' && draggingId.value
    ? store.data.widgets.find((w) => w.id === draggingId.value) ?? null
    : null
)

const draggingBookmark = computed(() =>
  dragKind.value === 'icon' && draggingId.value
    ? store.data.bookmarks.find((b) => b.id === draggingId.value) ?? null
    : null
)

const cellSize = computed(() =>
  Math.max(64, store.data.iconSize + 24)
)

const searchWidget = computed(() => store.data.widgets.find((w) => w.type === 'search') ?? null)

const canvasOffset = computed(() => {
  const cell = cellSize.value
  const paddingX = viewportWidth.value < 720 ? 12 : 24
  const topReserved = store.data.showBrowserBookmarkBar ? 42 : 12
  const paddingY = Math.max(topReserved, viewportHeight.value < 640 ? 10 : 24)
  const defaultStartX = 4
  const defaultStartY = 6
  const defaultCols = viewportWidth.value < 900 ? 4 : 8
  const defaultRows = 3
  const layoutW = defaultCols * cell
  const layoutH = defaultRows * cell

  return {
    x: Math.max(paddingX, Math.floor((viewportWidth.value - layoutW) / 2)) - defaultStartX * cell,
    y: Math.max(paddingY, Math.floor((viewportHeight.value - layoutH) / 2)) - defaultStartY * cell,
  }
})

// The search widget lives on the same grid as icons and other widgets. Its
// footprint is derived from the user's width/position/offset settings, then
// snapped to whole cells so icons collide with it through the normal
// occupancy path — one coordinate system, no overlap possible.
const searchGridRect = computed<{ gridX: number; gridY: number; gridW: number; gridH: number } | null>(() => {
  if (!searchWidget.value) return null
  const base = gridBounds(1, 1)
  const totalCols = base.maxX - base.minX + 1
  const totalRows = base.maxY - base.minY + 1
  const gridW = clampNumber(Math.round((totalCols * store.data.searchBarWidth) / 100), 1, Math.max(1, totalCols))
  const gridH = 1
  const bounds = gridBounds(gridW, gridH)
  const gridX = clampNumber(base.minX + Math.floor((totalCols - gridW) / 2), bounds.minX, bounds.maxX)
  const ratio = store.data.searchBarPosition === 'top' ? 0.08
    : store.data.searchBarPosition === 'bottom' ? 0.75
      : 0.2
  const offsetRows = Math.round(store.data.searchBarOffsetY / cellSize.value)
  const gridY = clampNumber(base.minY + Math.round(ratio * totalRows) + offsetRows, bounds.minY, bounds.maxY)
  return { gridX, gridY, gridW, gridH }
})

const iconImgStyle = computed(() => ({
  width: `${store.data.iconSize}px`,
  height: `${store.data.iconSize}px`,
}))

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function gridBounds(gridW = 1, gridH = 1) {
  const cell = cellSize.value
  const offset = canvasOffset.value
  const minX = Math.max(0, Math.ceil(-offset.x / cell))
  const minY = Math.max(0, Math.ceil(-offset.y / cell))
  const maxX = Math.max(minX, Math.floor((viewportWidth.value - offset.x - gridW * cell) / cell))
  const maxY = Math.max(minY, Math.floor((viewportHeight.value - offset.y - gridH * cell) / cell))

  return { minX, minY, maxX, maxY }
}

function clampGridPosition(gridX: number, gridY: number, gridW = 1, gridH = 1) {
  const bounds = gridBounds(gridW, gridH)
  return {
    gridX: clampNumber(gridX, bounds.minX, bounds.maxX),
    gridY: clampNumber(gridY, bounds.minY, bounds.maxY),
  }
}

function gridStyle(gridX: number, gridY: number, gridW = 1, gridH = 1) {
  const cell = cellSize.value
  const offset = canvasOffset.value
  const pos = clampGridPosition(gridX, gridY, gridW, gridH)
  return {
    position: 'absolute' as const,
    left: '0',
    top: '0',
    width: `${gridW * cell}px`,
    height: `${gridH * cell}px`,
    transform: `translate3d(${offset.x + pos.gridX * cell}px, ${offset.y + pos.gridY * cell}px, 0)`,
  }
}

function iconGridStyle(id: string, gridX: number, gridY: number) {
  const preview = previewPositions[id]
  return gridStyle(preview?.gridX ?? gridX, preview?.gridY ?? gridY)
}

function widgetGridStyle(w: { type: string; gridX: number; gridY: number; gridW: number; gridH: number }) {
  const rect = w.type === 'search' && searchGridRect.value ? searchGridRect.value : w
  return gridStyle(rect.gridX, rect.gridY, rect.gridW, rect.gridH)
}

function itemClass(id: string) {
  return {
    'is-dragging': isDragging.value && draggingId.value === id,
    'instant-move': instantMoveIds.value.has(id),
  }
}

function markInstantMove(id: string) {
  const s = new Set(instantMoveIds.value)
  s.add(id)
  instantMoveIds.value = s
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const next = new Set(instantMoveIds.value)
      next.delete(id)
      instantMoveIds.value = next
    })
  })
}

function buildOccupancySnapshot(excludeId?: string, usePreviewPositions = false): GridSnapshot {
  const movableItems: MovableGridItem[] = store.data.bookmarks.flatMap((bookmark) => {
    const preview = usePreviewPositions ? previewPositions[bookmark.id] : undefined
    const gridX = preview?.gridX ?? bookmark.gridX
    const gridY = preview?.gridY ?? bookmark.gridY
    return gridX === undefined || gridY === undefined ? [] : [{ id: bookmark.id, gridX, gridY }]
  })

  if (store.data.showAddButton) {
    const preview = usePreviewPositions ? previewPositions[ADD_BTN_ID] : undefined
    movableItems.push({
      id: ADD_BTN_ID,
      gridX: preview?.gridX ?? store.data.addButtonGridX,
      gridY: preview?.gridY ?? store.data.addButtonGridY,
    })
  }

  const blockerRects: GridRect[] = store.data.widgets.flatMap((widget) => {
    if (widget.id === excludeId) return []
    const rect = widget.type === 'search' ? searchGridRect.value : widget
    return rect ? [rect] : []
  })

  return createGridSnapshot(movableItems, blockerRects, excludeId)
}

function updateDropIndicatorDom(col: number, row: number, occupied: boolean) {
  const el = dropIndicatorEl.value
  if (!el) return

  const cell = cellSize.value
  const offset = canvasOffset.value
  const gridW = Math.max(1, Math.ceil((dragW.value || cell) / cell))
  const gridH = Math.max(1, Math.ceil((dragH.value || cell) / cell))
  const pos = clampGridPosition(col, row, gridW, gridH)

  el.style.width = `${dragW.value || cell}px`
  el.style.height = `${dragH.value || cell}px`
  el.style.transform = `translate3d(${offset.x + pos.gridX * cell}px, ${offset.y + pos.gridY * cell}px, 0)`
  el.style.borderColor = occupied ? 'rgba(239, 68, 68, 0.6)' : 'var(--accent)'
  el.style.background = occupied
    ? 'rgba(239, 68, 68, 0.06)'
    : 'color-mix(in srgb, var(--accent) 10%, transparent)'
}

function pointerToGrid(x: number, y: number) {
  const cell = cellSize.value
  const offset = canvasOffset.value
  const gridW = Math.max(1, Math.ceil((dragW.value || cell) / cell))
  const gridH = Math.max(1, Math.ceil((dragH.value || cell) / cell))
  return clampGridPosition(
    Math.round((x - offset.x + dragW.value / 2 - cell / 2) / cell),
    Math.round((y - offset.y + dragH.value / 2 - cell / 2) / cell),
    gridW,
    gridH,
  )
}

let layoutClampRaf = 0
function scheduleLayoutClamp() {
  if (layoutClampRaf) cancelAnimationFrame(layoutClampRaf)
  layoutClampRaf = requestAnimationFrame(() => {
    layoutClampRaf = 0
    clampCurrentLayoutToViewport()
  })
}

// Re-flow icons + Add button so nothing lands out of bounds or on top of a
// widget (incl. the search bar) after the viewport shrinks or a search setting
// changes. Icons keep their spot when it is still free, otherwise they slide to
// the nearest free cell — never stacking, never overlapping the search bar.
function clampCurrentLayoutToViewport() {
  if (isDragging.value || pendingDrag.value) return

  const blockerRects: GridRect[] = store.data.widgets.flatMap((widget) => {
    const rect = widget.type === 'search' ? searchGridRect.value : widget
    return rect ? [rect] : []
  })
  const snapshot = createGridSnapshot([], blockerRects)
  const iconBounds = gridBounds(1, 1)

  const patches: BookmarkPositionPatch[] = []
  for (const bm of store.data.bookmarks) {
    if (bm.gridX === undefined || bm.gridY === undefined) continue
    const pos = findNearestFreePosition(
      snapshot,
      { gridX: bm.gridX, gridY: bm.gridY },
      { gridW: 1, gridH: 1 },
      iconBounds,
    )
    occupyMovable(snapshot, { id: bm.id, ...pos })
    if (pos.gridX !== bm.gridX || pos.gridY !== bm.gridY) {
      patches.push({ id: bm.id, gridX: pos.gridX, gridY: pos.gridY })
    }
  }

  let addChanged = false
  if (store.data.showAddButton) {
    const pos = findNearestFreePosition(
      snapshot,
      { gridX: store.data.addButtonGridX, gridY: store.data.addButtonGridY },
      { gridW: 1, gridH: 1 },
      iconBounds,
    )
    occupyMovable(snapshot, { id: ADD_BTN_ID, ...pos })
    if (pos.gridX !== store.data.addButtonGridX || pos.gridY !== store.data.addButtonGridY) {
      store.moveAddButton(pos.gridX, pos.gridY)
      addChanged = true
    }
  }

  if (patches.length > 0) store.moveBookmarks(patches)
  if (patches.length > 0 || addChanged) void store.save()
}

function updateViewportSize() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
  scheduleLayoutClamp()
}

type DragStartOptions = {
  id: string
  kind: 'widget' | 'icon'
  gridX: number
  gridY: number
  gridW?: number
  gridH?: number
}

function beginDrag(event: PointerEvent, options: DragStartOptions) {
  const element = event.currentTarget as HTMLElement
  const rect = element.getBoundingClientRect()
  draggingId.value = options.id
  dragKind.value = options.kind
  pendingDrag.value = true
  isDragging.value = false
  dragStartGridX.value = options.gridX
  dragStartGridY.value = options.gridY
  ghostXRaw = rect.left
  ghostYRaw = rect.top
  dragOffsetX.value = event.clientX - rect.left
  dragOffsetY.value = event.clientY - rect.top
  const cell = cellSize.value
  dragW.value = options.gridW === undefined ? rect.width : options.gridW * cell
  dragH.value = options.gridH === undefined ? rect.height : options.gridH * cell
  startX.value = event.clientX
  startY.value = event.clientY
  dragSnapshot = buildOccupancySnapshot(options.id)
  lastDropPlan = null
  element.setPointerCapture(event.pointerId)
  event.preventDefault()
}

// ── Widget pointer down ──────────────────────────────────────
function onWidgetPointerDown(e: PointerEvent, widgetId: string, gx: number, gy: number, gw: number, gh: number) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a')) return

  beginDrag(e, { id: widgetId, kind: 'widget', gridX: gx, gridY: gy, gridW: gw, gridH: gh })
}

// ── Icon pointer down ────────────────────────────────────────
function onIconPointerDown(e: PointerEvent, bm: Bookmark) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.icon-del') || target.closest('.icon-edit')) return

  beginDrag(e, {
    id: bm.id,
    kind: 'icon',
    gridX: bm.gridX ?? 0,
    gridY: bm.gridY ?? 0,
  })
}

function onAddBtnPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  if ((e.target as HTMLElement).closest('.icon-del')) return
  beginDrag(e, {
    id: ADD_BTN_ID,
    kind: 'icon',
    gridX: store.data.addButtonGridX,
    gridY: store.data.addButtonGridY,
  })
}

// ── Shared pointer move (RAF-throttled) ──────────────────────
function onPointerMove(e: PointerEvent) {
  if (!pendingDrag.value && !isDragging.value) return

  if (pendingDrag.value && !isDragging.value) {
    const dist = Math.hypot(e.clientX - startX.value, e.clientY - startY.value)
    if (dist < DRAG_THRESHOLD) return
    isDragging.value = true
    pendingDrag.value = false
    ghostXRaw = e.clientX - dragOffsetX.value
    ghostYRaw = e.clientY - dragOffsetY.value
    const snap = pointerToGrid(ghostXRaw, ghostYRaw)
    snapGridX.value = snap.gridX
    snapGridY.value = snap.gridY
    lastSnapGridX = snapGridX.value
    lastSnapGridY = snapGridY.value
    const plan = updatePreviewPositions(snapGridX.value, snapGridY.value)
    nextTick(() => {
      if (ghostEl.value) {
        ghostEl.value.style.transform = `translate3d(${ghostXRaw}px, ${ghostYRaw}px, 0) scale(1.05)`
      }
      updateDropIndicatorDom(snapGridX.value, snapGridY.value, plan.occupied)
    })
  }

  if (!isDragging.value) return

  const cx = e.clientX
  const cy = e.clientY
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    const gx = cx - dragOffsetX.value
    const gy = cy - dragOffsetY.value
    ghostXRaw = gx
    ghostYRaw = gy
    if (ghostEl.value) {
      ghostEl.value.style.transform = `translate3d(${gx}px, ${gy}px, 0) scale(1.05)`
    }
    const snap = pointerToGrid(gx, gy)
    const newSx = snap.gridX
    const newSy = snap.gridY
    if (newSx !== lastSnapGridX || newSy !== lastSnapGridY) {
      lastSnapGridX = newSx
      lastSnapGridY = newSy
      snapGridX.value = newSx
      snapGridY.value = newSy
      const plan = updatePreviewPositions(newSx, newSy)
      updateDropIndicatorDom(newSx, newSy, plan.occupied)
    }
  })
}

function onWindowPointerMove(e: PointerEvent) {
  if (!pendingDrag.value && !isDragging.value) return
  onPointerMove(e)
}

function onWindowPointerUp() {
  if (!pendingDrag.value && !isDragging.value) return
  onPointerUp()
}

// ── Collision detection ──────────────────────────────────────
function findFreePosition(gx: number, gy: number, gridW: number, gridH: number, excludeId?: string) {
  const snapshot = dragSnapshot && excludeId === draggingId.value
    ? dragSnapshot
    : buildOccupancySnapshot(excludeId)
  return findFreePositionInSnapshot(snapshot, gx, gy, gridW, gridH)
}

function findFreePositionInSnapshot(snapshot: GridSnapshot, gx: number, gy: number, gridW: number, gridH: number) {
  return findNearestFreePosition(
    snapshot,
    { gridX: gx, gridY: gy },
    { gridW, gridH },
    gridBounds(gridW, gridH),
  )
}

function planIconDrop(id: string, rawX: number, rawY: number, baseSnapshot = dragSnapshot): DropPlan {
  return planMovableDrop(
    id,
    { gridX: rawX, gridY: rawY },
    { gridX: dragStartGridX.value, gridY: dragStartGridY.value },
    baseSnapshot ?? buildOccupancySnapshot(id, true),
    gridBounds(1, 1),
  )
}

function commitIconPatches(patches: BookmarkPositionPatch[]) {
  const normalizedPatches = resolvePatchCollisions(patches)
  const bookmarkPatches = normalizedPatches.filter((patch) => patch.id !== ADD_BTN_ID)
  const addPatch = normalizedPatches.find((patch) => patch.id === ADD_BTN_ID)

  if (bookmarkPatches.length > 0) store.moveBookmarks(bookmarkPatches)
  if (addPatch) store.moveAddButton(addPatch.gridX, addPatch.gridY)
}

function resolvePatchCollisions(patches: BookmarkPositionPatch[]) {
  const movableItems: MovableGridItem[] = store.data.bookmarks.flatMap((bookmark) =>
    bookmark.gridX === undefined || bookmark.gridY === undefined
      ? []
      : [{ id: bookmark.id, gridX: bookmark.gridX, gridY: bookmark.gridY }],
  )
  if (store.data.showAddButton) {
    movableItems.push({
      id: ADD_BTN_ID,
      gridX: store.data.addButtonGridX,
      gridY: store.data.addButtonGridY,
    })
  }
  const blockerRects: GridRect[] = store.data.widgets.flatMap((widget) => {
    const rect = widget.type === 'search' ? searchGridRect.value : widget
    return rect ? [rect] : []
  })
  return resolveGridPatches(patches, movableItems, blockerRects, gridBounds(1, 1))
}

function updatePreviewPositions(rawX: number, rawY: number): DropPlan {
  if (dragKind.value !== 'icon' || !draggingId.value) {
    for (const key in previewPositions) delete previewPositions[key]
    lastDropPlan = { patches: [], occupied: false }
    return lastDropPlan
  }

  const plan = planIconDrop(draggingId.value, rawX, rawY)
  const newKeys = new Set(plan.patches.map((p) => p.id))
  for (const key in previewPositions) {
    if (!newKeys.has(key)) delete previewPositions[key]
  }
  for (const patch of plan.patches) {
    previewPositions[patch.id] = { gridX: patch.gridX, gridY: patch.gridY }
  }
  lastDropPlan = plan
  return plan
}

// ── Pointer up (drop) ────────────────────────────────────────
function onPointerUp() {
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  if (pendingDrag.value && !isDragging.value) {
    if (dragKind.value === 'icon' && draggingId.value && draggingId.value !== ADD_BTN_ID && !justDragged) {
      const bm = store.data.bookmarks.find((b) => b.id === draggingId.value)
      if (bm) window.location.href = bm.url
    }
    resetDrag()
    return
  }

  if (!isDragging.value) return

  const rawX = snapGridX.value
  const rawY = snapGridY.value

  if (dragKind.value === 'widget' && draggingId.value) {
    const w = store.data.widgets.find((x) => x.id === draggingId.value)
    const gw = w?.gridW ?? 1
    const gh = w?.gridH ?? 1
    const pos = findFreePosition(rawX, rawY, gw, gh, draggingId.value)
    markInstantMove(draggingId.value)
    store.moveWidget(draggingId.value, pos.gridX, pos.gridY)
  } else if (dragKind.value === 'icon' && draggingId.value) {
    const plan = lastDropPlan ?? planIconDrop(draggingId.value, rawX, rawY)
    commitIconPatches(plan.patches)
  }

  void store.save()
  resetDrag()
}

function resetDrag() {
  if (isDragging.value) {
    justDragged = true
    setTimeout(() => { justDragged = false }, 100)
  }
  isDragging.value = false
  pendingDrag.value = false
  draggingId.value = null
  for (const key in previewPositions) delete previewPositions[key]
  dragSnapshot = null
  lastDropPlan = null
  lastSnapGridX = -1
  lastSnapGridY = -1
}

// ── Add / Edit modal ─────────────────────────────────────────
const showModal = ref(false)
const editingBookmark = ref<Bookmark | null>(null)

function openAddModal() {
  if (justDragged) return
  editingBookmark.value = null
  showModal.value = true
}

function openEditModal(bm: Bookmark) {
  editingBookmark.value = bm
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingBookmark.value = null
}

const componentMap: Record<string, typeof ClockWidget> = {
  clock: ClockWidget,
  date: DateWidget,
  notes: NotesWidget,
  search: SearchWidget,
  bookmarks: BookmarkWidget,
}

watch(
  () => [
    store.data.searchBarWidth,
    store.data.searchBarPosition,
    store.data.searchBarOffsetY,
    store.data.iconSize,
  ],
  () => scheduleLayoutClamp(),
)

watch(
  () => [
    ...store.data.widgets.map((widget) =>
      `${widget.id}:${widget.type}:${widget.gridX}:${widget.gridY}:${widget.gridW}:${widget.gridH}`,
    ),
    ...store.data.bookmarks.map((bookmark) =>
      `${bookmark.id}:${bookmark.gridX ?? ''}:${bookmark.gridY ?? ''}`,
    ),
    `${store.data.showAddButton}:${store.data.addButtonGridX}:${store.data.addButtonGridY}`,
  ].join('|'),
  () => scheduleLayoutClamp(),
)

onMounted(() => {
  updateViewportSize()
  window.addEventListener('resize', updateViewportSize)
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
})

onUnmounted(() => {
  if (layoutClampRaf) cancelAnimationFrame(layoutClampRaf)
  window.removeEventListener('resize', updateViewportSize)
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
})
</script>

<template>
  <div class="desktop-canvas">
    <!-- ── Widgets (free-form grid) ─────────────────────────── -->
    <div v-for="w in store.data.widgets" :key="w.id" class="canvas-item widget-item"
      :class="[itemClass(w.id), { 'search-widget-shell': w.type === 'search' }]"
      :style="widgetGridStyle(w)"
      @pointerdown="w.type === 'search' ? undefined : onWidgetPointerDown($event, w.id, w.gridX, w.gridY, w.gridW, w.gridH)">
      <button v-if="w.type !== 'search'" class="item-del" @click.stop="store.removeWidget(w.id)" title="Remove">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <component :is="componentMap[w.type]" />
    </div>

    <!-- ── Bookmark icons (free-form grid, cascade on collision) ── -->
    <div v-for="bm in store.data.bookmarks" :key="bm.id" v-show="bm.gridX !== undefined && bm.gridY !== undefined"
      class="canvas-item icon-item" :class="itemClass(bm.id)"
      :style="iconGridStyle(bm.id, bm.gridX ?? 0, bm.gridY ?? 0)" @pointerdown="onIconPointerDown($event, bm)">
      <span class="icon-del" @click.stop="store.removeBookmark(bm.id)" title="Remove">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </span>
      <span class="icon-edit" @click.stop="openEditModal(bm)" title="Edit">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </span>
      <BookmarkIcon :bookmark="bm" :img-style="iconImgStyle" />
    </div>

    <!-- ── Add button ───────────────────────────────────────── -->
    <div v-if="store.data.showAddButton" class="canvas-item icon-item icon-add" :class="itemClass(ADD_BTN_ID)"
      :style="iconGridStyle(ADD_BTN_ID, store.data.addButtonGridX, store.data.addButtonGridY)"
      @pointerdown="onAddBtnPointerDown" @click="openAddModal" title="Add shortcut">
      <span class="icon-del" @click.stop="store.hideAddButton()" title="Remove">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </span>
      <div class="icon-img-wrap icon-add-img" :style="iconImgStyle">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <span class="icon-label">Add</span>
    </div>

    <!-- ── Drop zone indicator ──────────────────────────────── -->
    <div v-if="isDragging" ref="dropIndicatorEl" class="drop-indicator" />
  </div>

  <!-- ── Drag ghost (teleported to body) ────────────────────── -->
  <Teleport to="body">
    <div v-if="isDragging" ref="ghostEl" class="canvas-ghost" :style="{ width: `${dragW}px`, height: `${dragH}px` }">
      <div v-if="draggingWidget" class="ghost-widget">
        <div class="ghost-widget-inner glass-panel" :style="{ width: '100%', height: '100%', opacity: 0.75 }">
          <component :is="componentMap[draggingWidget.type]" />
        </div>
      </div>
      <div v-else-if="draggingBookmark" class="ghost-icon">
        <BookmarkIcon :bookmark="draggingBookmark" :img-style="iconImgStyle" />
      </div>
      <div v-else-if="draggingId === ADD_BTN_ID" class="ghost-icon">
        <div class="icon-img-wrap icon-add-img" :style="iconImgStyle">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <span class="icon-label">Add</span>
      </div>
    </div>
  </Teleport>

  <BookmarkEditorModal
    v-if="showModal"
    :bookmark="editingBookmark"
    @close="closeModal"
  />
</template>

<style scoped>
.desktop-canvas {
  position: fixed;
  inset: 0;
  z-index: 8;
  pointer-events: none;
  user-select: none;
}

.canvas-item {
  pointer-events: auto;
  cursor: grab;
  transition: transform 0.28s cubic-bezier(0.2, 0.75, 0.25, 1), opacity 0.18s;
}

.canvas-item:active {
  cursor: grabbing;
}

.canvas-item.instant-move {
  transition: opacity 0.15s;
}

.canvas-item.is-dragging {
  opacity: 0.15;
  pointer-events: none;
  transition: opacity 0.15s;
}

/* ── Widget items ──────────────────────────────────────────── */
.widget-item {
  overflow: hidden;
}

.search-widget-shell {
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.item-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
  color: #fff;
  cursor: pointer;
  border: none;
}

.widget-item:hover .item-del {
  opacity: 1;
}

.item-del:hover {
  background: #ef4444;
}

/* ── Icon items ────────────────────────────────────────────── */
.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: transparent;
  border-radius: 18px;
  position: absolute;
  padding: 3px 2px;
  transition: transform 0.28s cubic-bezier(0.2, 0.75, 0.25, 1), opacity 0.18s,
    background 0.2s ease;
}

.icon-item:hover {
  background: var(--bg-glass);
}

.icon-item:hover :deep(.icon-img-wrap) {
  transform: translateY(-2px) scale(1.025);
}

.icon-del,
.icon-edit {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 2;
  color: #fff;
}

.icon-del {
  top: 4px;
  right: 4px;
  background: rgba(239, 68, 68, 0.85);
}

.icon-edit {
  top: 4px;
  left: 4px;
  background: rgba(60, 60, 80, 0.85);
}

.icon-item:hover .icon-del,
.icon-item:hover .icon-edit {
  opacity: 1;
}

.icon-del:hover {
  background: #ef4444;
}

.icon-edit:hover {
  background: var(--accent);
  color: var(--accent-contrast);
}

.icon-add-img {
  border: 1px dashed var(--border);
  background: var(--icon-surface);
  color: var(--text-secondary);
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}

.icon-add:hover .icon-add-img {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-glass);
}

/* ── Drop zone indicator ───────────────────────────────────── */
.drop-indicator {
  position: absolute;
  left: 0;
  top: 0;
  border: 2px dashed var(--accent);
  border-radius: 18px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  pointer-events: none;
  will-change: transform;
  transition: transform 0.12s ease, border-color 0.15s, background 0.15s;
}
</style>

<!-- Non-scoped style for teleported elements -->
<style>
.canvas-ghost {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 9999;
  pointer-events: none;
  will-change: transform;
}

.ghost-widget {
  width: 100%;
  height: 100%;
}

.ghost-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.12);
}

</style>
