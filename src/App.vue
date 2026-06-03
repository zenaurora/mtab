<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from './stores/settings'
import WallpaperBg from './components/WallpaperBg.vue'
import SearchBar from './components/SearchBar.vue'
import DesktopCanvas from './components/DesktopCanvas.vue'
import BrowserBookmarkBar from './components/BrowserBookmarkBar.vue'
import SettingsPanel from './components/settings/SettingsPanel.vue'

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
const themeClass = computed(() => {
  const t = store.data.theme
  if (t === 'gruvbox') return 'theme-gruvbox'
  if (t === 'catppuccin') return 'theme-catppuccin'
  if (t === 'everforest') return 'theme-everforest'
  if (t === 'shadcn') return 'theme-shadcn'
  return ''
})

// Apply theme + dark/light class to html element
watch(
  [() => store.data.darkMode, () => store.data.theme],
  ([dark]) => {
    document.documentElement.classList.toggle('light', !dark)
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="loaded"
    class="app-root"
    :class="[{ light: !store.data.darkMode, 'performance-mode': store.data.performanceMode }, themeClass]"
  >
    <!-- Background -->
    <WallpaperBg />

    <!-- Search bar -->
    <SearchBar />

    <!-- Browser bookmark bar mirror -->
    <BrowserBookmarkBar />

    <!-- Desktop canvas: widgets + icons on a free grid -->
    <DesktopCanvas />

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
  height: 100%;
  position: relative;
}

.settings-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: var(--bg-secondary);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  z-index: 40;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s, background 0.2s;
}

.settings-toggle:hover {
  background: var(--bg-glass-hover);
  transform: scale(1.05);
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
  background: #0a0a14;
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
