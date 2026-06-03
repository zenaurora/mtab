<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import BookmarkFolderMenu, { type BookmarkMenuItem } from './BookmarkFolderMenu.vue'

const store = useSettingsStore()

type BookmarkBarItem = BookmarkMenuItem

const bookmarkBar = ref<BookmarkBarItem[]>([])
const bookmarkSource = ref<'chrome' | 'local'>('local')
const barEl = ref<HTMLElement | null>(null)
const openFolderId = ref<string | null>(null)

const visibleItems = computed(() =>
  bookmarkBar.value.filter((item) => item.title || item.url || item.children?.length)
)

const barLabel = computed(() =>
  bookmarkSource.value === 'chrome' ? 'Chrome bookmarks bar' : 'Local bookmarks bar preview'
)

onMounted(() => {
  loadBrowserBookmarks()
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})

function onDocumentPointerDown(event: PointerEvent) {
  if (!barEl.value?.contains(event.target as Node)) {
    openFolderId.value = null
  }
}

function loadBrowserBookmarks() {
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.getChildren) {
    loadLocalBookmarkPreview()
    return
  }

  chrome.bookmarks.getChildren('1', (children) => {
    if (chrome.runtime?.lastError) {
      loadLocalBookmarkPreview()
      return
    }

    bookmarkSource.value = 'chrome'
    bookmarkBar.value = children.map(normalizeChromeBookmark)
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

function loadLocalBookmarkPreview() {
  bookmarkSource.value = 'local'
  bookmarkBar.value = store.data.bookmarks.map((item) => ({
    id: item.id,
    title: item.name,
    url: item.url,
    childrenLoaded: true,
  }))
}

function loadFolderChildren(item: BookmarkBarItem) {
  if (item.url || item.childrenLoaded) return
  if (bookmarkSource.value !== 'chrome' || typeof chrome === 'undefined' || !chrome.bookmarks?.getChildren) {
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
  window.location.href = item.url
}

function toggleFolder(item: BookmarkBarItem) {
  if (item.url) return
  loadFolderChildren(item)
  openFolderId.value = openFolderId.value === item.id ? null : item.id
}
</script>

<template>
  <nav
    v-if="store.data.showBrowserBookmarkBar && visibleItems.length"
    ref="barEl"
    class="browser-bookmark-bar"
    :aria-label="barLabel"
  >
    <template v-for="item in visibleItems" :key="item.id">
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

.browser-bookmark-bar::-webkit-scrollbar {
  display: none;
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

.folder-trigger svg {
  flex-shrink: 0;
  opacity: 0.65;
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
