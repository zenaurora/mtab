<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const store = useSettingsStore()

const bgStyle = computed(() => {
  // Solid color takes precedence over images
  if (store.data.wallpaperColor) {
    return { background: store.data.wallpaperColor }
  }
  // Image wallpaper
  const src = store.data.wallpaperBase64 || store.data.wallpaperUrl
  if (!src) {
    return {
      background:
        'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    }
  }
  return {
    backgroundImage: `url(${src})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: `blur(${store.data.blurAmount}px)`,
    transform: 'scale(1.05)', // prevent blur edge artifacts
  }
})
</script>

<template>
  <div class="wallpaper-bg" :style="bgStyle"></div>
  <!-- Dark overlay for readability -->
  <div class="wallpaper-overlay" :class="{ light: !store.data.darkMode }"></div>
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
  background: rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.wallpaper-overlay.light {
  background: rgba(255, 255, 255, 0.1);
}
</style>
