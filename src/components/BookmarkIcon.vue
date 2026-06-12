<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { Bookmark } from '../types'

const props = defineProps<{
  bookmark: Bookmark
  imgStyle: CSSProperties
  failed: boolean
}>()

const emit = defineEmits<{
  load: []
  error: []
}>()

function faviconCandidates(bookmark: Bookmark): string[] {
  const candidates: string[] = []
  if (bookmark.iconUrl) candidates.push(bookmark.iconUrl)
  try {
    const url = new URL(bookmark.url)
    candidates.push(`${url.origin}/favicon.ico`)
    candidates.push(`https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`)
  } catch {
    return candidates
  }
  return Array.from(new Set(candidates.filter(Boolean)))
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function displayName(bm: Bookmark): string {
  return bm.name || extractDomain(bm.url)
}

const candidateIndex = ref(0)

const iconSrc = computed(() => {
  const candidates = faviconCandidates(props.bookmark)
  return candidates[candidateIndex.value] ?? ''
})

watch(
  () => [props.bookmark.url, props.bookmark.iconUrl],
  () => {
    candidateIndex.value = 0
  },
  { immediate: true }
)

function onImgError() {
  const candidates = faviconCandidates(props.bookmark)
  if (candidateIndex.value < candidates.length - 1) {
    candidateIndex.value += 1
    return
  }
  emit('error')
}
</script>

<template>
  <div class="icon-img-wrap" :style="imgStyle">
    <span v-if="failed || !iconSrc" class="icon-fallback">
      {{ displayName(bookmark).charAt(0).toUpperCase() }}
    </span>
    <img
      v-else
      :src="iconSrc"
      :alt="bookmark.name"
      class="icon-img"
      @load="emit('load')"
      @error="onImgError"
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
