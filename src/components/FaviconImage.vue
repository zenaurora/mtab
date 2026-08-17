<script setup lang="ts">
import type { Bookmark } from '../types'
import { useFaviconSource } from '../composables/useFaviconSource'

const props = defineProps<{
  bookmark: Pick<Bookmark, 'url' | 'iconUrl'>
  alt: string
  imageClass?: string
}>()

const { iconSrc, advanceOrFail, acceptLoadedImage } = useFaviconSource(() => props.bookmark)

function onLoad(event: Event) {
  acceptLoadedImage(event.target as HTMLImageElement)
}
</script>

<template>
  <img
    v-if="iconSrc"
    :src="iconSrc"
    :alt="alt"
    :class="imageClass"
    @load="onLoad"
    @error="advanceOrFail"
  />
  <slot v-else name="fallback" />
</template>
