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
  border-radius: 15px;
  overflow: hidden;
  position: relative;
  background: var(--icon-surface);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: transform var(--transition);
}

.icon-tile-transparent .icon-img-wrap {
  border-color: transparent;
  box-shadow: none;
}

.icon-img {
  width: 74%;
  height: 74%;
  object-fit: contain;
  border-radius: 22%;
}

.icon-fallback {
  font-size: 1.35em;
  font-weight: 650;
  color: var(--icon-tile-foreground);
  opacity: 0.72;
}

.icon-label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--icon-label-color);
  opacity: 0.88;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 8px);
  text-align: center;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.42);
  pointer-events: none;
}
</style>
