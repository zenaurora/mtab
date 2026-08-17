<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const store = useSettingsStore()

const hasImageWallpaper = computed(() => Boolean(store.wallpaperBlobUrl || store.data.wallpaperUrl))

const bgStyle = computed(() => {
  // Solid color takes precedence over images
  if (store.data.wallpaperColor) {
    return { background: store.data.wallpaperColor }
  }
  // Image wallpaper — prefer blob URL for local images (avoids base64 in JS heap)
  const src = store.wallpaperBlobUrl || store.data.wallpaperUrl
  if (!src) {
    return {
      background:
        'radial-gradient(ellipse at 16% 12%, rgba(126, 101, 65, 0.2) 0%, transparent 42%), radial-gradient(ellipse at 84% 78%, rgba(54, 78, 82, 0.16) 0%, transparent 46%), linear-gradient(145deg, #17181a 0%, #0b0c0e 72%)',
    }
  }
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: store.data.performanceMode ? 'none' : `blur(${store.data.blurAmount}px)`,
    transform: 'scale(1.05)', // prevent blur edge artifacts
  }
})
</script>

<template>
  <div class="wallpaper-bg" :style="bgStyle"></div>
  <!-- Dark overlay for readability -->
  <div
    class="wallpaper-overlay"
    :class="{ light: !store.data.darkMode, 'with-image': hasImageWallpaper }"
  ></div>
</template>

<style scoped>
.wallpaper-bg {
  position: fixed;
  inset: -20px; /* offset for blur scale */
  z-index: 0;
  transition: filter 0.3s ease;
}

.wallpaper-overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: rgba(4, 5, 7, 0.12);
  pointer-events: none;
}

.wallpaper-overlay.with-image {
  background: rgba(4, 5, 7, 0.28);
}

.wallpaper-overlay.light {
  background: rgba(248, 246, 240, 0.12);
}

.wallpaper-overlay.light.with-image {
  background: rgba(248, 246, 240, 0.2);
}

</style>
