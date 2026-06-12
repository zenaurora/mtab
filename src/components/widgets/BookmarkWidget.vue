<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { displayBookmarkName, faviconCandidates } from '../../utils/bookmarkIcon'
import { shouldRejectLoadedFavicon } from '../../utils/faviconValidation'

const store = useSettingsStore()
const bookmarks = computed(() => store.data.bookmarks)
const failedIconKeys = reactive(new Set<string>())

function faviconUrl(bookmark: { id: string; url: string; iconUrl?: string }): string {
  if (failedIconKeys.has(bookmark.id)) return ''
  return faviconCandidates(bookmark)[0] ?? ''
}

function advanceIcon(bookmark: { id: string; url: string; iconUrl?: string }, event: Event) {
  const img = event.target as HTMLImageElement
  const candidates = faviconCandidates(bookmark)
  const currentIndex = candidates.indexOf(img.currentSrc || img.src)
  const nextSrc = candidates[currentIndex + 1]
  if (nextSrc) {
    img.src = nextSrc
    return
  }
  failedIconKeys.add(bookmark.id)
}

function siteName(bm: { name: string; url: string }): string {
  return displayBookmarkName(bm)
}

function onIconError(bookmark: { id: string; url: string; iconUrl?: string }, event: Event) {
  advanceIcon(bookmark, event)
}

function onIconLoad(bookmark: { id: string; url: string; iconUrl?: string }, event: Event) {
  const img = event.target as HTMLImageElement
  if (shouldRejectLoadedFavicon(img)) {
    advanceIcon(bookmark, event)
    return
  }

  failedIconKeys.delete(bookmark.id)
}

function navigate(url: string) {
  window.location.href = url
}
</script>

<template>
  <div class="bookmark-widget">
    <div class="bookmark-header">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      <span>Bookmarks</span>
    </div>
    <div class="bookmark-grid">
      <button
        v-for="bm in bookmarks"
        :key="bm.id"
        class="bookmark-item"
        @click="navigate(bm.url)"
        :title="bm.url"
      >
        <img
          v-if="faviconUrl(bm)"
          :src="faviconUrl(bm)"
          :alt="bm.name"
          class="favicon"
          @load="onIconLoad(bm, $event)"
          @error="onIconError(bm, $event)"
        />
        <span v-else class="favicon-fallback">{{
          siteName(bm).charAt(0).toUpperCase()
        }}</span>
        <span class="bm-name">{{ siteName(bm) }}</span>
      </button>
      <div v-if="bookmarks.length === 0" class="empty-state">
        No bookmarks yet. Add some in settings.
      </div>
    </div>
  </div>
</template>

<style scoped>
.bookmark-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 10px;
}

.bookmark-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  flex-shrink: 0;
}

.bookmark-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  align-content: start;
}

.bookmark-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 0;
}

.bookmark-item:hover {
  background: var(--bg-glass);
}

.favicon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
}

.favicon-fallback {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.bm-name {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  opacity: 0.6;
  padding: 16px 0;
}
</style>
