<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '../stores/settings'

const store = useSettingsStore()
const query = ref('')
const showEngineMenu = ref(false)

const activeEngine = computed(() =>
  store.data.searchEngines.find((e) => e.id === store.data.activeEngineId) ??
  store.data.searchEngines[0]
)

const containerStyle = computed(() => {
  const pos = store.data.searchBarPosition
  const offset = store.data.searchBarOffsetY
  let top: string
  if (pos === 'top') top = `calc(10% + ${offset}px)`
  else if (pos === 'bottom') top = `calc(75% + ${offset}px)`
  else top = `calc(38% + ${offset}px)`
  return {
    top,
    width: `${store.data.searchBarWidth}%`,
  }
})

function selectEngine(id: string) {
  store.setActiveEngine(id)
  showEngineMenu.value = false
}

function doSearch() {
  const q = query.value.trim()
  if (!q || !activeEngine.value) return
  const url = activeEngine.value.urlTemplate.replace(
    '{query}',
    encodeURIComponent(q)
  )
  window.location.href = url
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') doSearch()
  if (e.key === 'Escape') showEngineMenu.value = false
}
</script>

<template>
  <div class="search-container" :style="containerStyle">
    <div class="search-bar glass-panel">
      <!-- Engine selector button -->
      <button
        class="engine-btn"
        @click="showEngineMenu = !showEngineMenu"
        :title="activeEngine?.name ?? 'Search'"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span class="engine-name">{{ activeEngine?.name ?? 'Search' }}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          :class="{ rotated: showEngineMenu }"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <!-- Engine dropdown -->
      <Transition name="fade">
        <div v-if="showEngineMenu" class="engine-menu glass-panel">
          <button
            v-for="engine in store.data.searchEngines"
            :key="engine.id"
            class="engine-item"
            :class="{ active: engine.id === store.data.activeEngineId }"
            @click="selectEngine(engine.id)"
          >
            {{ engine.name }}
          </button>
        </div>
      </Transition>

      <!-- Input -->
      <input
        v-model="query"
        @keydown="onKeydown"
        class="search-input"
        :placeholder="`Search with ${activeEngine?.name ?? '...'}...`"
        spellcheck="false"
        autocomplete="off"
      />

      <!-- Search button -->
      <button class="search-btn" @click="doSearch" title="Search">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-container {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  justify-content: center;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  width: 100%;
  position: relative;
}

.engine-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-glass);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  flex-shrink: 0;
}

.engine-name {
  font-size: 13px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.engine-btn svg:last-child {
  transition: transform 0.2s;
}

.engine-btn svg.rotated {
  transform: rotate(180deg);
}

.engine-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 8px;
  min-width: 160px;
  padding: 4px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.engine-item {
  text-align: left;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.engine-item.active {
  background: var(--accent);
  color: #fff;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
  padding: 8px 4px;
}

.search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

.search-btn {
  padding: 8px 10px;
  background: var(--accent);
  color: #fff;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.search-btn:hover {
  background: var(--accent-hover);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
