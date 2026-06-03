<script setup lang="ts">
import { ref, computed, reactive, nextTick, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import type { Bookmark } from '../types'
import ClockWidget from './widgets/ClockWidget.vue'
import DateWidget from './widgets/DateWidget.vue'
import NotesWidget from './widgets/NotesWidget.vue'
import BookmarkWidget from './widgets/BookmarkWidget.vue'

const store = useSettingsStore()

const DRAG_THRESHOLD = 6
const ADD_BTN_ID = '__add_btn__'

const loadedIcons = reactive(new Set<string>())
const failedIcons = reactive(new Set<string>())

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

type CellKey = `${number},${number}`
type OccupancySnapshot = {
  bookmarks: Map<CellKey, Bookmark>
  widgetCells: Set<CellKey>
}

type BookmarkPositionPatch = {
  id: string
  gridX: number
  gridY: number
}

type DropPlan = {
  patches: BookmarkPositionPatch[]
  occupied: boolean
}

// ── Grid snap state ──────────────────────────────────────────
const snapGridX = ref(0)
const snapGridY = ref(0)
const dragStartGridX = ref(0)
const dragStartGridY = ref(0)
const previewPositions = ref<Record<string, { gridX: number; gridY: number }>>({})
let dragSnapshot: OccupancySnapshot | null = null
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
  Math.max(96, store.data.iconSize + 28)
)

const canvasOffset = computed(() => {
  const cell = gridCellSize()
  const paddingX = viewportWidth.value < 720 ? 12 : 24
  const topReserved = store.data.showBrowserBookmarkBar ? 42 : 12
  const paddingY = Math.max(topReserved, viewportHeight.value < 640 ? 10 : 24)
  const defaultStartX = 4
  const defaultStartY = 6
  const defaultCols = viewportWidth.value < 900 ? 4 : 8
  const defaultRows = 2
  const layoutW = defaultCols * cell
  const layoutH = defaultRows * cell

  return {
    x: Math.max(paddingX, Math.floor((viewportWidth.value - layoutW) / 2)) - defaultStartX * cell,
    y: Math.max(paddingY, Math.floor((viewportHeight.value - layoutH) / 2)) - defaultStartY * cell,
  }
})

function gridCellSize() {
  return cellSize.value
}

function gridStyle(gridX: number, gridY: number, gridW = 1, gridH = 1) {
  const cell = gridCellSize()
  const offset = canvasOffset.value
  return {
    position: 'absolute' as const,
    left: '0',
    top: '0',
    width: `${gridW * cell}px`,
    height: `${gridH * cell}px`,
    transform: `translate3d(${offset.x + gridX * cell}px, ${offset.y + gridY * cell}px, 0)`,
  }
}

function iconGridStyle(id: string, gridX: number, gridY: number) {
  const preview = previewPositions.value[id]
  return gridStyle(preview?.gridX ?? gridX, preview?.gridY ?? gridY)
}

function itemClass(id: string) {
  return {
    'is-dragging': isDragging.value && draggingId.value === id,
    'instant-move': instantMoveIds.value.has(id),
  }
}

function markInstantMove(id: string) {
  instantMoveIds.value = new Set([...instantMoveIds.value, id])
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const next = new Set(instantMoveIds.value)
      next.delete(id)
      instantMoveIds.value = next
    })
  })
}

function cellKey(col: number, row: number): CellKey {
  return `${col},${row}`
}

function buildOccupancySnapshot(excludeId?: string): OccupancySnapshot {
  const bookmarks = new Map<CellKey, Bookmark>()
  const widgetCells = new Set<CellKey>()

  for (const b of store.data.bookmarks) {
    if (b.id === excludeId) continue
    if (b.gridX === undefined || b.gridY === undefined) continue
    bookmarks.set(cellKey(b.gridX, b.gridY), b)
  }

  if (store.data.showAddButton && excludeId !== ADD_BTN_ID) {
    bookmarks.set(cellKey(store.data.addButtonGridX, store.data.addButtonGridY), {
      id: ADD_BTN_ID,
      name: 'Add',
      url: '',
      gridX: store.data.addButtonGridX,
      gridY: store.data.addButtonGridY,
      gridW: 1,
      gridH: 1,
    })
  }

  for (const w of store.data.widgets) {
    if (w.id === excludeId) continue
    for (let dx = 0; dx < w.gridW; dx++) {
      for (let dy = 0; dy < w.gridH; dy++) {
        widgetCells.add(cellKey(w.gridX + dx, w.gridY + dy))
      }
    }
  }

  return { bookmarks, widgetCells }
}

function cloneOccupancySnapshot(snapshot: OccupancySnapshot): OccupancySnapshot {
  return {
    bookmarks: new Map(snapshot.bookmarks),
    widgetCells: new Set(snapshot.widgetCells),
  }
}

function isOccupiedInSnapshot(snapshot: OccupancySnapshot, col: number, row: number): boolean {
  const key = cellKey(col, row)
  return snapshot.bookmarks.has(key) || snapshot.widgetCells.has(key)
}

function isAreaOccupiedInSnapshot(
  snapshot: OccupancySnapshot,
  col: number,
  row: number,
  gridW: number,
  gridH: number,
): boolean {
  for (let dx = 0; dx < gridW; dx++) {
    for (let dy = 0; dy < gridH; dy++) {
      if (isOccupiedInSnapshot(snapshot, col + dx, row + dy)) return true
    }
  }
  return false
}

function updateDropIndicatorDom(col: number, row: number, occupied: boolean) {
  const el = dropIndicatorEl.value
  if (!el) return

  const cell = gridCellSize()
  const offset = canvasOffset.value

  el.style.width = `${dragW.value || cell}px`
  el.style.height = `${dragH.value || cell}px`
  el.style.transform = `translate3d(${offset.x + col * cell}px, ${offset.y + row * cell}px, 0)`
  el.style.borderColor = occupied ? 'rgba(239, 68, 68, 0.6)' : 'var(--accent)'
  el.style.background = occupied ? 'rgba(239, 68, 68, 0.06)' : 'rgba(99, 102, 241, 0.06)'
}

function pointerToGrid(x: number, y: number) {
  const cell = gridCellSize()
  const offset = canvasOffset.value
  return {
    gridX: Math.max(0, Math.round((x - offset.x + dragW.value / 2 - cell / 2) / cell)),
    gridY: Math.max(0, Math.round((y - offset.y + dragH.value / 2 - cell / 2) / cell)),
  }
}

function updateViewportSize() {
  viewportWidth.value = window.innerWidth
  viewportHeight.value = window.innerHeight
}

// ── Widget pointer down ──────────────────────────────────────
function onWidgetPointerDown(e: PointerEvent, widgetId: string, gx: number, gy: number, gw: number, gh: number) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('button') || target.closest('textarea') || target.closest('input') || target.closest('a')) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  draggingId.value = widgetId
  dragKind.value = 'widget'
  pendingDrag.value = true
  isDragging.value = false
  dragStartGridX.value = gx
  dragStartGridY.value = gy
  ghostXRaw = rect.left
  ghostYRaw = rect.top
  dragOffsetX.value = e.clientX - rect.left
  dragOffsetY.value = e.clientY - rect.top
  const cell = gridCellSize()
  dragW.value = gw * cell
  dragH.value = gh * cell
  startX.value = e.clientX
  startY.value = e.clientY
  dragSnapshot = buildOccupancySnapshot(widgetId)
  lastDropPlan = null
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

// ── Icon pointer down ────────────────────────────────────────
function onIconPointerDown(e: PointerEvent, bm: Bookmark) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.icon-del') || target.closest('.icon-edit')) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  draggingId.value = bm.id
  dragKind.value = 'icon'
  pendingDrag.value = true
  isDragging.value = false
  dragStartGridX.value = bm.gridX ?? 0
  dragStartGridY.value = bm.gridY ?? 0
  ghostXRaw = rect.left
  ghostYRaw = rect.top
  dragOffsetX.value = e.clientX - rect.left
  dragOffsetY.value = e.clientY - rect.top
  dragW.value = rect.width
  dragH.value = rect.height
  startX.value = e.clientX
  startY.value = e.clientY
  dragSnapshot = buildOccupancySnapshot(bm.id)
  lastDropPlan = null
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}

function onAddBtnPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.icon-del')) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  draggingId.value = ADD_BTN_ID
  dragKind.value = 'icon'
  pendingDrag.value = true
  isDragging.value = false
  dragStartGridX.value = store.data.addButtonGridX
  dragStartGridY.value = store.data.addButtonGridY
  ghostXRaw = rect.left
  ghostYRaw = rect.top
  dragOffsetX.value = e.clientX - rect.left
  dragOffsetY.value = e.clientY - rect.top
  dragW.value = rect.width
  dragH.value = rect.height
  startX.value = e.clientX
  startY.value = e.clientY
  dragSnapshot = buildOccupancySnapshot(ADD_BTN_ID)
  lastDropPlan = null
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
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

function findFreePositionInSnapshot(snapshot: OccupancySnapshot, gx: number, gy: number, gridW: number, gridH: number) {
  if (!isAreaOccupiedInSnapshot(snapshot, gx, gy, gridW, gridH)) return { gridX: gx, gridY: gy }
  for (let radius = 1; radius < 30; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
        const nx = gx + dx
        const ny = gy + dy
        if (nx < 0 || ny < 0) continue
        if (!isAreaOccupiedInSnapshot(snapshot, nx, ny, gridW, gridH)) return { gridX: nx, gridY: ny }
      }
    }
  }
  return { gridX: gx, gridY: gy }
}

// ── Cascade shift (Android-style push) ───────────────────────
function getPushDirection(col: number, row: number, dragFromCol: number, dragFromRow: number) {
  const dx = col - dragFromCol
  const dy = row - dragFromRow
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { dx: dx > 0 ? 1 : dx < 0 ? -1 : 1, dy: 0 }
  }
  return { dx: 0, dy: dy > 0 ? 1 : dy < 0 ? -1 : 1 }
}

function moveBookmarkInSnapshot(
  snapshot: OccupancySnapshot,
  patches: BookmarkPositionPatch[],
  bm: Bookmark,
  gridX: number,
  gridY: number,
) {
  if (bm.gridX !== undefined && bm.gridY !== undefined) {
    snapshot.bookmarks.delete(cellKey(bm.gridX, bm.gridY))
  }
  snapshot.bookmarks.set(cellKey(gridX, gridY), bm)
  patches.push({ id: bm.id, gridX, gridY })
}

// When dropping onto an occupied icon cell, push that icon (and
// anything blocking it) in the drag direction. This simulates in a
// plain Map first, then commits patches once.
function planCascadeShift(
  snapshot: OccupancySnapshot,
  col: number,
  row: number,
  dragFromCol: number,
  dragFromRow: number,
  patches: BookmarkPositionPatch[],
  depth = 0,
): void {
  if (depth > 10) return

  const push = getPushDirection(col, row, dragFromCol, dragFromRow)
  const targetCol = col + push.dx
  const targetRow = row + push.dy

  // If the push destination is also occupied by a bookmark, cascade first
  const blocker = snapshot.bookmarks.get(cellKey(targetCol, targetRow))
  if (blocker) {
    planCascadeShift(snapshot, targetCol, targetRow, col, row, patches, depth + 1)
  }

  // If still blocked (by widget or another bookmark), find nearest free cell
  const bm = snapshot.bookmarks.get(cellKey(col, row))
  if (!bm) return

  if (isOccupiedInSnapshot(snapshot, targetCol, targetRow)) {
    const free = findFreePositionInSnapshot(snapshot, col, row, 1, 1)
    moveBookmarkInSnapshot(snapshot, patches, bm, free.gridX, free.gridY)
    return
  }

  // Move the icon at (col, row) to (targetCol, targetRow)
  moveBookmarkInSnapshot(snapshot, patches, bm, targetCol, targetRow)
}

function planIconDrop(id: string, rawX: number, rawY: number, baseSnapshot = dragSnapshot): DropPlan {
  const snapshot = cloneOccupancySnapshot(baseSnapshot ?? buildOccupancySnapshot(id))
  const occupant = snapshot.bookmarks.get(cellKey(rawX, rawY))
  const widgetBlocker = snapshot.widgetCells.has(cellKey(rawX, rawY))
  const occupied = Boolean(occupant || widgetBlocker)

  if (occupant) {
    const patches: BookmarkPositionPatch[] = []
    planCascadeShift(snapshot, rawX, rawY, dragStartGridX.value, dragStartGridY.value, patches)
    patches.push({ id, gridX: rawX, gridY: rawY })
    return { patches, occupied }
  }

  if (widgetBlocker) {
    const pos = findFreePositionInSnapshot(snapshot, rawX, rawY, 1, 1)
    return { patches: [{ id, gridX: pos.gridX, gridY: pos.gridY }], occupied }
  }

  return { patches: [{ id, gridX: rawX, gridY: rawY }], occupied }
}

function commitIconPatches(patches: BookmarkPositionPatch[]) {
  const normalizedPatches = resolvePatchCollisions(patches)
  const bookmarkPatches = normalizedPatches.filter((patch) => patch.id !== ADD_BTN_ID)
  const addPatch = normalizedPatches.find((patch) => patch.id === ADD_BTN_ID)

  if (bookmarkPatches.length > 0) store.moveBookmarks(bookmarkPatches)
  if (addPatch) store.moveAddButton(addPatch.gridX, addPatch.gridY)
}

function resolvePatchCollisions(patches: BookmarkPositionPatch[]) {
  const result: BookmarkPositionPatch[] = []
  const occupied = buildOccupancySnapshot(draggingId.value ?? undefined)

  for (const patch of patches) {
    const fromBookmark = store.data.bookmarks.find((b) => b.id === patch.id)
    if (fromBookmark?.gridX !== undefined && fromBookmark.gridY !== undefined) {
      occupied.bookmarks.delete(cellKey(fromBookmark.gridX, fromBookmark.gridY))
    }
    if (patch.id === ADD_BTN_ID) {
      occupied.bookmarks.delete(cellKey(store.data.addButtonGridX, store.data.addButtonGridY))
    }
  }

  for (const patch of patches) {
    let gridX = patch.gridX
    let gridY = patch.gridY
    if (isOccupiedInSnapshot(occupied, gridX, gridY)) {
      const free = findFreePositionInSnapshot(occupied, gridX, gridY, 1, 1)
      gridX = free.gridX
      gridY = free.gridY
    }
    occupied.bookmarks.set(cellKey(gridX, gridY), {
      id: patch.id,
      name: '',
      url: '',
      gridX,
      gridY,
      gridW: 1,
      gridH: 1,
    })
    result.push({ id: patch.id, gridX, gridY })
  }

  return result
}

function updatePreviewPositions(rawX: number, rawY: number): DropPlan {
  if (dragKind.value !== 'icon' || !draggingId.value) {
    previewPositions.value = {}
    lastDropPlan = { patches: [], occupied: false }
    return lastDropPlan
  }

  const plan = planIconDrop(draggingId.value, rawX, rawY)
  const next: Record<string, { gridX: number; gridY: number }> = {}
  for (const patch of plan.patches) {
    next[patch.id] = { gridX: patch.gridX, gridY: patch.gridY }
  }
  previewPositions.value = next
  lastDropPlan = plan
  return plan
}

// ── Pointer up (drop) ────────────────────────────────────────
function onPointerUp() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }

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
	  previewPositions.value = {}
	  dragSnapshot = null
	  lastDropPlan = null
	}

// ── Helpers ──────────────────────────────────────────────────
function faviconUrl(bookmark: Bookmark): string {
  if (bookmark.iconUrl) return bookmark.iconUrl
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=128`
  } catch {
    return ''
  }
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function displayName(bm: Bookmark): string {
  return bm.name || extractDomain(bm.url)
}

function iconImgStyle() {
  return { width: `${store.data.iconSize}px`, height: `${store.data.iconSize}px` }
}

// ── Add / Edit modal ─────────────────────────────────────────
const showModal = ref(false)
const editingId = ref<string | null>(null)
const modalName = ref('')
const modalUrl = ref('')
const modalIconUrl = ref('')

function openAddModal() {
  if (justDragged) return
  editingId.value = null
  modalName.value = ''
  modalUrl.value = ''
  modalIconUrl.value = ''
  showModal.value = true
}

function openEditModal(bm: Bookmark) {
  editingId.value = bm.id
  modalName.value = bm.name
  modalUrl.value = bm.url
  modalIconUrl.value = bm.iconUrl ?? ''
  showModal.value = true
}

function closeModal() { showModal.value = false }

function onModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && showModal.value) {
    closeModal()
  }
}

function submitModal() {
  let url = modalUrl.value.trim()
  let iconUrl = modalIconUrl.value.trim()
  if (!url) return
  if (!/^https?:\/\//.test(url)) url = 'https://' + url
  if (iconUrl && !/^https?:\/\//.test(iconUrl) && !/^data:image\//.test(iconUrl)) {
    iconUrl = 'https://' + iconUrl
  }
  const name = modalName.value.trim() || extractDomain(url)
  const patch = { name, url, iconUrl: iconUrl || undefined }
  if (editingId.value) {
    store.updateBookmark(editingId.value, patch)
  } else {
    store.addBookmark(patch)
  }
  closeModal()
}

const componentMap: Record<string, typeof ClockWidget> = {
  clock: ClockWidget, date: DateWidget, notes: NotesWidget, bookmarks: BookmarkWidget,
}

onMounted(() => {
  updateViewportSize()
  window.addEventListener('resize', updateViewportSize)
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('keydown', onModalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportSize)
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('keydown', onModalKeydown)
})
</script>

<template>
  <div
    class="desktop-canvas"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <!-- ── Widgets (free-form grid) ─────────────────────────── -->
    <div
      v-for="w in store.data.widgets"
	      :key="w.id"
	      class="canvas-item widget-item glass-panel"
	      :class="itemClass(w.id)"
      :style="gridStyle(w.gridX, w.gridY, w.gridW, w.gridH)"
      @pointerdown="onWidgetPointerDown($event, w.id, w.gridX, w.gridY, w.gridW, w.gridH)"
    >
      <button class="item-del" @click.stop="store.removeWidget(w.id)" title="Remove">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      <component :is="componentMap[w.type]" />
    </div>

    <!-- ── Bookmark icons (free-form grid, cascade on collision) ── -->
    <div
	      v-for="bm in store.data.bookmarks"
	      :key="bm.id"
	      v-show="bm.gridX !== undefined && bm.gridY !== undefined"
	      class="canvas-item icon-item"
	      :class="itemClass(bm.id)"
	      :style="iconGridStyle(bm.id, bm.gridX ?? 0, bm.gridY ?? 0)"
	      @pointerdown="onIconPointerDown($event, bm)"
    >
      <span class="icon-del" @click.stop="store.removeBookmark(bm.id)" title="Remove">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </span>
      <span class="icon-edit" @click.stop="openEditModal(bm)" title="Edit">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </span>
      <div class="icon-img-wrap" :style="iconImgStyle()">
        <span v-if="failedIcons.has(bm.id)" class="icon-fallback">
          {{ displayName(bm).charAt(0).toUpperCase() }}
        </span>
        <img
          v-else
          :src="faviconUrl(bm)"
          :alt="bm.name"
          class="icon-img"
          @load="loadedIcons.add(bm.id); failedIcons.delete(bm.id)"
          @error="failedIcons.add(bm.id); loadedIcons.delete(bm.id)"
        />
      </div>
      <span class="icon-label">{{ displayName(bm) }}</span>
    </div>

	    <!-- ── Add button ───────────────────────────────────────── -->
	    <div
	      v-if="store.data.showAddButton"
	      class="canvas-item icon-item icon-add"
	      :class="itemClass(ADD_BTN_ID)"
	      :style="iconGridStyle(ADD_BTN_ID, store.data.addButtonGridX, store.data.addButtonGridY)"
	      @pointerdown="onAddBtnPointerDown"
	      @click="openAddModal"
	      title="Add shortcut"
	    >
	      <span class="icon-del" @click.stop="store.hideAddButton()" title="Remove">
	        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
	          <path d="M18 6L6 18M6 6l12 12"/>
	        </svg>
	      </span>
	      <div class="icon-img-wrap icon-add-img" :style="iconImgStyle()">
	        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
	          <path d="M12 5v14M5 12h14"/>
        </svg>
      </div>
      <span class="icon-label">Add</span>
    </div>

    <!-- ── Drop zone indicator ──────────────────────────────── -->
    <div
      v-if="isDragging"
      ref="dropIndicatorEl"
      class="drop-indicator"
    />
  </div>

  <!-- ── Drag ghost (teleported to body) ────────────────────── -->
  <Teleport to="body">
    <div
      v-if="isDragging"
      ref="ghostEl"
      class="canvas-ghost"
      :style="{ width: `${dragW}px`, height: `${dragH}px` }"
    >
      <div v-if="draggingWidget" class="ghost-widget">
        <div class="ghost-widget-inner glass-panel" :style="{ width: '100%', height: '100%', opacity: 0.75 }">
          <component :is="componentMap[draggingWidget.type]" />
        </div>
      </div>
	      <div v-else-if="draggingBookmark" class="ghost-icon">
	        <div class="icon-img-wrap" :style="iconImgStyle()">
	          <span v-if="failedIcons.has(draggingBookmark.id)" class="icon-fallback">
	            {{ displayName(draggingBookmark).charAt(0).toUpperCase() }}
	          </span>
	          <img v-else :src="faviconUrl(draggingBookmark)" :alt="draggingBookmark.name" class="icon-img" />
	        </div>
	        <span class="icon-label">{{ displayName(draggingBookmark) }}</span>
	      </div>
	      <div v-else-if="draggingId === ADD_BTN_ID" class="ghost-icon">
	        <div class="icon-img-wrap icon-add-img" :style="iconImgStyle()">
	          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
	            <path d="M12 5v14M5 12h14"/>
	          </svg>
	        </div>
	        <span class="icon-label">Add</span>
	      </div>
    </div>
  </Teleport>

  <!-- ── Edit / Add modal (teleported to body) ──────────────── -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal glass-panel">
          <h3>{{ editingId ? 'Edit Shortcut' : 'Add Shortcut' }}</h3>
          <div class="modal-field">
            <label>Name (optional)</label>
            <input v-model="modalName" placeholder="Auto-detected from URL" @keydown.enter="submitModal" />
          </div>
          <div class="modal-field">
            <label>URL</label>
            <input v-model="modalUrl" placeholder="github.com" @keydown.enter="submitModal" autofocus />
          </div>
          <div class="modal-field">
            <label>Icon URL (optional)</label>
            <input v-model="modalIconUrl" placeholder="https://example.com/favicon.ico" @keydown.enter="submitModal" />
          </div>
          <div class="modal-actions">
            <button @click="closeModal">Cancel</button>
            <button class="primary" @click="submitModal">{{ editingId ? 'Save' : 'Add' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
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
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s;
}

.canvas-item:active { cursor: grabbing; }

.canvas-item.instant-move {
  transition: opacity 0.15s;
}

.canvas-item.is-dragging {
  opacity: 0.15;
  pointer-events: none;
  transition: opacity 0.15s;
}

/* ── Widget items ──────────────────────────────────────────── */
.widget-item { overflow: hidden; }

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

.widget-item:hover .item-del { opacity: 1; }
.item-del:hover { background: #ef4444; }

/* ── Icon items ────────────────────────────────────────────── */
.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  border-radius: 12px;
  position: absolute;
}

.icon-item:hover { background: var(--bg-glass); }

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

.icon-del { top: 4px; right: 4px; background: rgba(239, 68, 68, 0.85); }
.icon-edit { top: 4px; left: 4px; background: rgba(60, 60, 80, 0.85); }

.icon-item:hover .icon-del,
.icon-item:hover .icon-edit { opacity: 1; }
.icon-del:hover { background: #ef4444; }
.icon-edit:hover { background: var(--accent); }

.icon-img-wrap {
  border-radius: 14px;
  overflow: hidden;
  position: relative;
  background: var(--bg-glass);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
}

.icon-fallback {
  font-size: 1.5em;
  font-weight: 700;
  color: var(--text-primary);
  opacity: 0.6;
}

.icon-label {
  font-size: 12px;
  color: var(--text-primary);
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 90px;
  text-align: center;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.icon-add-img {
  border: 2px dashed var(--border);
  background: transparent;
  color: var(--text-secondary);
  transition: border-color 0.15s, color 0.15s;
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
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.06);
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

.ghost-widget { width: 100%; height: 100%; }

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

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  width: 360px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal h3 { font-size: 16px; font-weight: 600; margin: 0; }

.modal-field { display: flex; flex-direction: column; gap: 6px; }
.modal-field label { font-size: 12px; color: var(--text-secondary); }
.modal-field input { width: 100%; }

.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }

.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }

.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; transform: scale(0.95); }
</style>
