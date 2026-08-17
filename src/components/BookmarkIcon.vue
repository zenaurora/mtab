<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { Bookmark } from '../types'
import { displayBookmarkName } from '../utils/bookmarkIcon'
import FaviconImage from './FaviconImage.vue'

const props = defineProps<{
  bookmark: Bookmark
  imgStyle: CSSProperties
}>()
</script>

<template>
  <div class="icon-img-wrap" :style="imgStyle">
    <FaviconImage :bookmark="bookmark" :alt="bookmark.name" image-class="icon-img">
      <template #fallback>
        <span class="icon-fallback">
          {{ displayBookmarkName(bookmark).charAt(0).toUpperCase() }}
        </span>
      </template>
    </FaviconImage>
  </div>
  <span class="icon-label">{{ displayBookmarkName(bookmark) }}</span>
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
