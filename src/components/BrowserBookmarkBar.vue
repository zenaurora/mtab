<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import BookmarkFolderMenu, { type BookmarkMenuItem } from './BookmarkFolderMenu.vue'

const store = useSettingsStore()

type BookmarkBarItem = BookmarkMenuItem

const bookmarkBar = ref<BookmarkBarItem[]>([])
const barEl = ref<HTMLElement | null>(null)
const measureEl = ref<HTMLElement | null>(null)
const openFolderId = ref<string | null>(null)
const moreMenuOpen = ref(false)
const primaryItemIds = ref<string[]>([])
let layoutRaf = 0
let resizeObserver: ResizeObserver | null = null

const visibleItems = computed(() =>
  bookmarkBar.value.filter((item) => item.title || item.url || item.children?.length)
)

const barLabel = computed(() => 'Chrome bookmarks bar')
const layoutKey = computed(() =>
  visibleItems.value.map((item) => `${item.id}:${item.title}:${item.url ? 'u' : 'f'}`).join('|')
)
const primaryItems = computed(() => {
  const primaryIds = new Set(primaryItemIds.value)
  return visibleItems.value.filter((item) => primaryIds.has(item.id))
})
const overflowItems = computed(() => {
  const primaryIds = new Set(primaryItemIds.value)
  return visibleItems.value.filter((item) => !primaryIds.has(item.id))
})

onMounted(() => {
  loadBrowserBookmarks()
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  resizeObserver = new ResizeObserver(() => {
    scheduleLayout()
  })
  if (barEl.value) resizeObserver.observe(barEl.value)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  resizeObserver?.disconnect()
})

function onDocumentPointerDown(event: PointerEvent) {
  if (!barEl.value?.contains(event.target as Node)) {
    openFolderId.value = null
    moreMenuOpen.value = false
  }
}

watch(layoutKey, () => {
  primaryItemIds.value = visibleItems.value.map((item) => item.id)
  scheduleLayout()
}, { immediate: true })

function loadBrowserBookmarks() {
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.getChildren) {
    bookmarkBar.value = []
    return
  }

  chrome.bookmarks.getChildren('1', (children) => {
    if (chrome.runtime?.lastError || children.length === 0) {
      loadBrowserBookmarksFromTree()
      return
    }

    bookmarkBar.value = children.map(normalizeChromeBookmark)
  })
}

function loadBrowserBookmarksFromTree() {
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.getTree) {
    bookmarkBar.value = []
    return
  }

  chrome.bookmarks.getTree((tree) => {
    if (chrome.runtime?.lastError) {
      bookmarkBar.value = []
      return
    }

    const root = tree[0]
    const bar =
      root?.children?.find((node) => node.id === '1') ??
      root?.children?.find((node) => /bookmark|书签|收藏/i.test(node.title)) ??
      root?.children?.[0]

    bookmarkBar.value = (bar?.children ?? []).map(normalizeChromeBookmark)
  })
}

function normalizeChromeBookmark(item: chrome.bookmarks.BookmarkTreeNode): BookmarkBarItem {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    children: item.url ? undefined : item.children?.map(normalizeChromeBookmark),
    childrenLoaded: Boolean(item.url || item.children),
  }
}

function loadFolderChildren(item: BookmarkBarItem) {
  if (item.url || item.childrenLoaded) return
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.getChildren) {
    item.children = []
    item.childrenLoaded = true
    return
  }

  item.childrenLoaded = true
  chrome.bookmarks.getChildren(item.id, (children) => {
    if (chrome.runtime?.lastError) {
      item.children = []
      return
    }
    item.children = children.map(normalizeChromeBookmark)
  })
}

function itemLabel(item: BookmarkBarItem) {
  if (item.title) return item.title
  if (!item.url) return 'Untitled'
  try {
    return new URL(item.url).hostname.replace(/^www\./, '')
  } catch {
    return item.url
  }
}

function openBookmark(item: BookmarkBarItem) {
  if (!item.url) return
  openFolderId.value = null
  moreMenuOpen.value = false
  window.location.href = item.url
}

function toggleFolder(item: BookmarkBarItem) {
  if (item.url) return
  loadFolderChildren(item)
  moreMenuOpen.value = false
  openFolderId.value = openFolderId.value === item.id ? null : item.id
}

function toggleMoreMenu() {
  openFolderId.value = null
  moreMenuOpen.value = !moreMenuOpen.value
}

function scheduleLayout() {
  if (layoutRaf) return
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = 0
    void nextTick(recomputeVisibleItems)
  })
}

function recomputeVisibleItems() {
  const bar = barEl.value
  const measure = measureEl.value
  const items = visibleItems.value
  if (!bar || !measure || items.length === 0) {
    primaryItemIds.value = items.map((item) => item.id)
    moreMenuOpen.value = false
    return
  }

  const style = window.getComputedStyle(bar)
  const paddingLeft = Number.parseFloat(style.paddingLeft || '0')
  const paddingRight = Number.parseFloat(style.paddingRight || '0')
  const gap = Number.parseFloat(style.columnGap || style.gap || '0')
  const availableWidth = Math.max(0, bar.clientWidth - paddingLeft - paddingRight)

  const widthById = new Map<string, number>()
  measure.querySelectorAll<HTMLElement>('[data-measure-id]').forEach((el) => {
    const id = el.dataset.measureId
    if (!id) return
    widthById.set(id, Math.ceil(el.getBoundingClientRect().width))
  })

  const moreWidth = Math.ceil(
    measure.querySelector<HTMLElement>('[data-role="measure-more"]')?.getBoundingClientRect().width ?? 0
  )

  const nextPrimary: string[] = []
  let usedWidth = 0

  for (let index = 0; index < items.length; index++) {
    const item = items[index]
    const itemWidth = widthById.get(item.id) ?? 0
    const gapBeforeItem = nextPrimary.length > 0 ? gap : 0
    const hasOverflowAfterItem = index < items.length - 1
    const reserveMoreWidth = hasOverflowAfterItem
      ? (nextPrimary.length > 0 || itemWidth > 0 ? gap : 0) + moreWidth
      : 0

    if (usedWidth + gapBeforeItem + itemWidth + reserveMoreWidth <= availableWidth) {
      nextPrimary.push(item.id)
      usedWidth += gapBeforeItem + itemWidth
      continue
    }
    break
  }

  primaryItemIds.value = nextPrimary

  const nextPrimarySet = new Set(nextPrimary)
  if (openFolderId.value && !nextPrimarySet.has(openFolderId.value)) {
    openFolderId.value = null
  }
  if (nextPrimary.length === items.length) {
    moreMenuOpen.value = false
  }
}
</script>

<template>
  <nav
    v-if="store.data.showBrowserBookmarkBar && visibleItems.length"
    ref="barEl"
    class="browser-bookmark-bar"
    :aria-label="barLabel"
  >
    <div class="browser-bookmark-content">
      <template v-for="item in primaryItems" :key="item.id">
        <button
          v-if="item.url"
          class="bookmark-item"
          :title="item.url"
          @click="openBookmark(item)"
        >
          <span class="bookmark-dot"></span>
          <span>{{ itemLabel(item) }}</span>
        </button>

        <div v-else class="bookmark-folder">
          <button
            class="bookmark-item folder-trigger"
            :class="{ active: openFolderId === item.id }"
            :title="itemLabel(item)"
            @click.stop="toggleFolder(item)"
          >
            <span class="folder-icon"></span>
            <span>{{ itemLabel(item) }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <BookmarkFolderMenu
            v-if="item.childrenLoaded"
            class="folder-menu"
            :class="{ 'is-open': openFolderId === item.id }"
            :items="item.children ?? []"
            @open="openBookmark"
            @expand="loadFolderChildren"
          />
        </div>
      </template>
    </div>

    <div v-if="overflowItems.length" class="bookmark-folder more-folder">
      <button
        class="bookmark-item more-trigger"
        :class="{ active: moreMenuOpen }"
        title="More bookmarks"
        aria-label="More bookmarks"
        @click.stop="toggleMoreMenu"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      <BookmarkFolderMenu
        class="folder-menu more-menu"
        :class="{ 'is-open': moreMenuOpen }"
        :items="overflowItems"
        @open="openBookmark"
        @expand="loadFolderChildren"
      />
    </div>

    <div ref="measureEl" class="bookmark-measure" aria-hidden="true">
      <template v-for="item in visibleItems" :key="`measure-${item.id}`">
        <button
          v-if="item.url"
          class="bookmark-item"
          :data-measure-id="item.id"
          tabindex="-1"
        >
          <span class="bookmark-dot"></span>
          <span>{{ itemLabel(item) }}</span>
        </button>
        <button
          v-else
          class="bookmark-item folder-trigger"
          :data-measure-id="item.id"
          tabindex="-1"
        >
          <span class="folder-icon"></span>
          <span>{{ itemLabel(item) }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </template>
      <button class="bookmark-item more-trigger" data-role="measure-more" tabindex="-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.browser-bookmark-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  overflow: visible;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.browser-bookmark-content {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: visible;
}

.bookmark-item,
.folder-menu-item {
  height: 26px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 180px;
  padding: 0 8px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
}

.bookmark-item span:last-child,
.folder-menu-item span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-item:hover,
.bookmark-item.active,
:deep(.folder-menu-item:hover),
:deep(.folder-menu-folder:focus-within > .folder-menu-item) {
  background: var(--bg-glass-hover);
}

:deep(.bookmark-dot),
.bookmark-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--accent);
}

:deep(.folder-icon),
.folder-icon {
  width: 12px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
  background: #fbbf24;
  box-shadow: inset 0 3px 0 rgba(255, 255, 255, 0.28);
}

.bookmark-folder {
  position: relative;
  flex-shrink: 0;
}

.more-folder {
  flex-shrink: 0;
}

.folder-trigger svg {
  flex-shrink: 0;
  opacity: 0.65;
}

.more-trigger {
  width: 28px;
  justify-content: center;
  padding: 0;
}

.bookmark-measure {
  position: absolute;
  left: 0;
  top: 0;
  height: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
}

.folder-menu,
:deep(.folder-submenu) {
  position: absolute;
  min-width: 190px;
  max-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
  display: none;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.folder-menu {
  top: calc(100% + 4px);
  left: 0;
}

.more-menu {
  right: 0;
  left: auto;
}

.folder-menu.is-open {
  display: flex;
}

:deep(.folder-menu-folder) {
  position: relative;
}

:deep(.folder-submenu) {
  top: -5px;
  left: calc(100% + 4px);
}

:deep(.folder-menu-folder:hover > .folder-submenu),
:deep(.folder-menu-folder:focus-within > .folder-submenu) {
  display: flex;
}

:deep(.folder-menu-item) {
  height: 26px;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  justify-content: flex-start;
  min-width: 0;
  max-width: none;
  padding: 0 8px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  white-space: nowrap;
}

:deep(.folder-menu-item span:nth-child(2)) {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

:deep(.folder-menu-item svg) {
  flex-shrink: 0;
  opacity: 0.65;
}
</style>
