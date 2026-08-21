<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from './stores/settings'
import WallpaperBg from './components/WallpaperBg.vue'
import DesktopCanvas from './components/DesktopCanvas.vue'
import BrowserBookmarkBar from './components/BrowserBookmarkBar.vue'
import SearchHistorySidebar from './components/SearchHistorySidebar.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'
import { THEMES, themeClassFor } from './themes'

const store = useSettingsStore()
const showSettings = ref(false)
const loaded = ref(false)

onMounted(async () => {
  await store.load()
  loaded.value = true
  window.addEventListener('keydown', onWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showSettings.value = false
  }
}

// Compute the active theme class
const themeClass = computed(() => themeClassFor(store.data.theme))
const themeClasses = THEMES.map((theme) => theme.className).filter(Boolean)

function iconTileForeground(color: string, opacity: number): string {
  if (opacity < 45) return 'var(--text-primary)'
  const value = color.slice(1)
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  const luminance = (red * 299 + green * 587 + blue * 114) / 255000
  return luminance > 0.58 ? '#302d27' : '#f4f2ec'
}

// Apply theme + dark/light class to html element
watch(
  [() => store.data.darkMode, () => store.data.theme],
  ([dark]) => {
    document.documentElement.classList.toggle('light', !dark)
    document.documentElement.classList.remove(...themeClasses)
    if (themeClass.value) document.documentElement.classList.add(themeClass.value)
  },
  { immediate: true }
)

// Desktop icon surfaces also live on the root so teleported drag previews use
// exactly the same appearance as icons on the canvas.
watch(
  [
    () => store.data.iconTileColor,
    () => store.data.iconTileOpacity,
    () => store.data.iconLabelColor,
  ],
  ([color, opacity, labelColor]) => {
    const root = document.documentElement
    root.style.setProperty('--icon-tile-color', color)
    root.style.setProperty('--icon-tile-opacity', `${opacity}%`)
    root.style.setProperty('--icon-tile-foreground', iconTileForeground(color, opacity))
    root.style.setProperty('--icon-label-color', labelColor || 'var(--text-primary)')
    root.classList.toggle('icon-tile-transparent', opacity === 0)
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="loaded"
    class="app-root"
    :class="{ 'performance-mode': store.data.performanceMode }"
  >
    <!-- Background -->
    <WallpaperBg />

    <!-- Browser bookmark bar mirror -->
    <BrowserBookmarkBar />

    <!-- Desktop canvas: widgets + icons on a free grid -->
    <DesktopCanvas />

    <!-- Chrome search history -->
    <SearchHistorySidebar />

    <!-- Settings toggle button -->
    <button
      class="settings-toggle"
      @click="showSettings = !showSettings"
      :title="showSettings ? 'Close settings' : 'Open settings'"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        :class="{ spinning: showSettings }"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        />
      </svg>
    </button>

    <!-- Settings panel -->
    <Transition name="slide">
      <SettingsPanel v-if="showSettings" />
    </Transition>

    <!-- Click outside to close settings -->
    <div
      v-if="showSettings"
      class="backdrop"
      @click="showSettings = false"
    ></div>
  </div>

  <!-- Loading state -->
  <div v-else class="loading">
    <div class="loading-spinner"></div>
  </div>
</template>

<style scoped>
.app-root {
  width: 100%;
  min-height: 100dvh;
  position: relative;
}

.settings-toggle {
  position: fixed;
  bottom: 22px;
  right: 22px;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: color-mix(in srgb, var(--bg-secondary) 96%, transparent);
  border: 1px solid var(--border);
  z-index: 40;
  color: var(--text-secondary);
  opacity: 0.76;
  box-shadow: 0 12px 34px rgba(2, 4, 7, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: transform var(--transition), background var(--transition), opacity var(--transition),
    color var(--transition);
}

.settings-toggle:hover {
  background: var(--bg-glass-hover);
  color: var(--text-primary);
  opacity: 1;
  transform: translateY(-2px);
}

.settings-toggle svg.spinning {
  animation: spin 0.5s ease;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(180deg); }
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 45;
  background: rgba(3, 5, 8, 0.18);
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Loading */
.loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b0c0e;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
</style>
