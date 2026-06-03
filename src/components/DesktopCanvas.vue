<script setup lang="ts">
import { ref, computed, reactive, nextTick } from 'vue'
import { useSettingsStore } from '../stores/settings'
import type { Bookmark } from '../types'
import ClockWidget from './widgets/ClockWidget.vue'
import DateWidget from './widgets/DateWidget.vue'
import NotesWidget from './widgets/NotesWidget.vue'
import BookmarkWidget from './widgets/BookmarkWidget.vue'

const store = useSettingsStore()

const CELL = 96
const DRAG_THRESHOLD = 6

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
let rafId = 0
let justDragged = false

// ── Grid snap state ──────────────────────────────────────────
const snapGridX = ref(0)
const snapGridY = ref(0)
const dragStartGridX = ref(0)
const dragStartGridY = ref(0)

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

function gridStyle(gridX: number, gridY: number, gridW = 1, gridH = 1) {
  return {
    position: 'absolute' as const,
    left: `${gridX * CELL}px`,
    top: `${gridY * CELL}px`,
    width: `${gridW * CELL}px`,
    height: `${gridH * CELL}px`,
  }
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
  dragW.value = gw * CELL
  dragH.value = gh * CELL
  startX.value = e.clientX
  startY.value = e.clientY
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
    snapGridX.value = Math.max(0, Math.round(ghostXRaw / CELL))
    snapGridY.value = Math.max(0, Math.round(ghostYRaw / CELL))
    nextTick(() => {
      if (ghostEl.value) {
        ghostEl.value.style.transform = `translate(${ghostXRaw}px, ${ghostYRaw}px) scale(1.05)`
      }
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
      ghostEl.value.style.transform = `translate(${gx}px, ${gy}px) scale(1.05)`
    }
    const newSx = Math.max(0, Math.round(gx / CELL))
    const newSy = Math.max(0, Math.round(gy / CELL))
    if (newSx !== snapGridX.value) snapGridX.value = newSx
    if (newSy !== snapGridY.value) snapGridY.value = newSy
  })
}

// ── Collision detection ──────────────────────────────────────
function findBookmarkAt(col: number, row: number, excludeId?: string): Bookmark | undefined {
  return store.data.bookmarks.find((b) => {
    if (b.id === excludeId) return false
    return b.gridX === col && b.gridY === row
  })
}

function findWidgetAt(col: number, row: number, excludeId?: string) {
  return store.data.widgets.find((w) => {
    if (w.id === excludeId) return false
    return col >= w.gridX && col < w.gridX + w.gridW &&
           row >= w.gridY && row < w.gridY + w.gridH
  })
}

function isCellOccupied(col: number, row: number, gridW: number, gridH: number, excludeId?: string): boolean {
  for (let dx = 0; dx < gridW; dx++) {
    for (let dy = 0; dy < gridH; dy++) {
      if (findBookmarkAt(col + dx, row + dy, excludeId)) return true
      if (findWidgetAt(col + dx, row + dy, excludeId)) return true
    }
  }
  return false
}

function findFreePosition(gx: number, gy: number, gridW: number, gridH: number, excludeId?: string) {
  if (!isCellOccupied(gx, gy, gridW, gridH, excludeId)) return { gridX: gx, gridY: gy }
  for (let radius = 1; radius < 30; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue
        const nx = gx + dx
        const ny = gy + dy
        if (nx < 0 || ny < 0) continue
        if (!isCellOccupied(nx, ny, gridW, gridH, excludeId)) return { gridX: nx, gridY: ny }
      }
    }
  }
  return { gridX: gx, gridY: gy }
}

// ── Cascade shift (Android-style push) ───────────────────────
// When dropping onto an occupied icon cell, push that icon (and
// anything blocking it) in the drag direction.
function cascadeShift(col: number, row: number, dragFromCol: number, dragFromRow: number, excludeId?: string, depth = 0): void {
  if (depth > 10) return

  // Determine push direction from drag vector
  const dx = col - dragFromCol
  const dy = row - dragFromRow
  let pushDx = 0
  let pushDy = 0
  if (Math.abs(dx) >= Math.abs(dy)) {
    pushDx = dx > 0 ? 1 : dx < 0 ? -1 : 1
  } else {
    pushDy = dy > 0 ? 1 : dy < 0 ? -1 : 1
  }

  const targetCol = col + pushDx
  const targetRow = row + pushDy

  // If the push destination is also occupied by a bookmark, cascade first
  const blocker = findBookmarkAt(targetCol, targetRow, excludeId)
  if (blocker) {
    cascadeShift(targetCol, targetRow, col, row, excludeId, depth + 1)
  }

  // If still blocked (by widget or another bookmark), find nearest free cell
  if (isCellOccupied(targetCol, targetRow, 1, 1, excludeId)) {
    const free = findFreePosition(col, row, 1, 1, excludeId)
    const bm = findBookmarkAt(col, row, excludeId)
    if (bm) {
      bm.gridX = free.gridX
      bm.gridY = free.gridY
    }
    return
  }

  // Move the icon at (col, row) to (targetCol, targetRow)
  const bm = findBookmarkAt(col, row, excludeId)
  if (bm) {
    bm.gridX = targetCol
    bm.gridY = targetRow
  }
}

// ── Pointer up (drop) ────────────────────────────────────────
function onPointerUp() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }

  if (pendingDrag.value && !isDragging.value) {
    if (dragKind.value === 'icon' && draggingId.value && !justDragged) {
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
    store.moveWidget(draggingId.value, pos.gridX, pos.gridY)
  } else if (dragKind.value === 'icon' && draggingId.value) {
    // Check what's at the target position
    const occupant = findBookmarkAt(rawX, rawY, draggingId.value)
    const widgetBlocker = findWidgetAt(rawX, rawY, draggingId.value)

    if (occupant) {
      // Occupied by another bookmark → cascade push (Android-style)
      cascadeShift(rawX, rawY, dragStartGridX.value, dragStartGridY.value, draggingId.value)
      // Now place the dragged icon at the freed position
      store.moveBookmark(draggingId.value, rawX, rawY)
    } else if (widgetBlocker) {
      // Occupied by a widget → find nearest free cell
      const pos = findFreePosition(rawX, rawY, 1, 1, draggingId.value)
      store.moveBookmark(draggingId.value, pos.gridX, pos.gridY)
    } else {
      // Cell is free → place directly
      store.moveBookmark(draggingId.value, rawX, rawY)
    }
  }
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
}

// ── Helpers ──────────────────────────────────────────────────
function faviconUrl(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128` } catch { return '' }
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

// ── Add button position (auto-placed at next free cell) ──────
const addBtnPos = computed(() => {
  const bms = store.data.bookmarks.filter((b) => b.gridY !== undefined)
  const startY = bms.length > 0 ? Math.max(...bms.map((b) => b.gridY ?? 6)) : 6
  return store.findFreePosition(1, 1, startY)
})

// ── Drop indicator style ─────────────────────────────────────
const dropIndicatorStyle = computed(() => {
  const occupied = isCellOccupied(snapGridX.value, snapGridY.value, 1, 1, draggingId.value ?? undefined)
  return {
    left: `${snapGridX.value * CELL}px`,
    top: `${snapGridY.value * CELL}px`,
    width: `${dragW.value || CELL}px`,
    height: `${dragH.value || CELL}px`,
    borderColor: occupied ? 'rgba(239, 68, 68, 0.6)' : 'var(--accent)',
    background: occupied ? 'rgba(239, 68, 68, 0.06)' : 'rgba(99, 102, 241, 0.06)',
  }
})

// ── Add / Edit modal ─────────────────────────────────────────
const showModal = ref(false)
const editingId = ref<string | null>(null)
const modalName = ref('')
const modalUrl = ref('')

function openAddModal() {
  if (justDragged) return
  editingId.value = null
  modalName.value = ''
  modalUrl.value = ''
  showModal.value = true
}

function openEditModal(bm: Bookmark) {
  editingId.value = bm.id
  modalName.value = bm.name
  modalUrl.value = bm.url
  showModal.value = true
}

function closeModal() { showModal.value = false }

function submitModal() {
  let url = modalUrl.value.trim()
  if (!url) return
  if (!/^https?:\/\//.test(url)) url = 'https://' + url
  const name = modalName.value.trim() || extractDomain(url)
  if (editingId.value) {
    store.updateBookmark(editingId.value, { name, url })
  } else {
    store.addBookmark({ name, url })
  }
  closeModal()
}

const componentMap: Record<string, typeof ClockWidget> = {
  clock: ClockWidget, date: DateWidget, notes: NotesWidget, bookmarks: BookmarkWidget,
}
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
      :class="{ 'is-dragging': isDragging && draggingId === w.id }"
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
      :class="{ 'is-dragging': isDragging && draggingId === bm.id }"
      :style="gridStyle(bm.gridX ?? 0, bm.gridY ?? 0)"
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
          :src="faviconUrl(bm.url)"
          :alt="bm.name"
          class="icon-img"
          @load="loadedIcons.add(bm.id); failedIcons.delete(bm.id)"
          @error="failedIcons.add(bm.id); loadedIcons.delete(bm.id)"
        />
      </div>
      <span class="icon-label">{{ displayName(bm) }}</span>
    </div>

    <!-- ── Add button (auto-positioned) ─────────────────────── -->
    <div
      class="canvas-item icon-item icon-add"
      :style="gridStyle(addBtnPos.gridX, addBtnPos.gridY)"
      @click="openAddModal"
      title="Add shortcut"
    >
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
      class="drop-indicator"
      :style="dropIndicatorStyle"
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
          <img v-else :src="faviconUrl(draggingBookmark.url)" :alt="draggingBookmark.name" class="icon-img" />
        </div>
        <span class="icon-label">{{ displayName(draggingBookmark) }}</span>
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
  will-change: left, top, opacity;
  transition: left 0.25s cubic-bezier(0.2, 0, 0, 1),
              top 0.25s cubic-bezier(0.2, 0, 0, 1),
              opacity 0.15s;
}

.canvas-item:active { cursor: grabbing; }

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
  border: 2px dashed var(--accent);
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.06);
  pointer-events: none;
  transition: left 0.12s ease, top 0.12s ease, border-color 0.15s, background 0.15s;
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
  filter: drop-shadow(0 16px 48px rgba(0, 0, 0, 0.45));
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
  backdrop-filter: blur(12px);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
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
