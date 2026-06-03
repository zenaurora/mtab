<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Bookmark } from '../types'

defineProps<{
  bookmark: Bookmark
  imgStyle: CSSProperties
  failed: boolean
}>()

defineEmits<{
  load: []
  error: []
}>()

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
</script>

<template>
  <div class="icon-img-wrap" :style="imgStyle">
    <span v-if="failed" class="icon-fallback">
      {{ displayName(bookmark).charAt(0).toUpperCase() }}
    </span>
    <img
      v-else
      :src="faviconUrl(bookmark)"
      :alt="bookmark.name"
      class="icon-img"
      @load="$emit('load')"
      @error="$emit('error')"
    />
  </div>
  <span class="icon-label">{{ displayName(bookmark) }}</span>
</template>

<style>
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
</style>
