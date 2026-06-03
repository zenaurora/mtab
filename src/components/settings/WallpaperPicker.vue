<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import type { WallpaperEntry } from '../../types'

const store = useSettingsStore()

const imageUrl = ref(store.data.wallpaperUrl)

// ── Solid color presets ──────────────────────────────────────
const SOLID_COLORS = [
  '#0f0c29', '#1a1a2e', '#16213e', '#0d1b2a',
  '#1b263b', '#2d3436', '#1a1a1a', '#2c3e50',
  '#1e3a3a', '#2d1b4e', '#3d1f1f', '#1f3d2d',
  '#3e2723', '#263238', '#000000', '#1a237e',
]

function applyColor(color: string) {
  store.setWallpaperColor(color)
}

// ── File upload ──────────────────────────────────────────────
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = reader.result as string
    store.setWallpaperBase64(base64)
    store.addToHistory({
      source: base64,
      sourceType: 'base64',
      label: file.name,
    })
  }
  reader.readAsDataURL(file)
}

function applyUrl() {
  const url = imageUrl.value.trim()
  if (!url) return

  // Detect Wallhaven URL
  const whMatch = url.match(/wallhaven\.cc\/w\/([a-z0-9]+)/i)
  if (whMatch) {
    resolveWallhaven(whMatch[1])
    return
  }

  // Regular URL
  store.setWallpaperUrl(url)
  store.addToHistory({
    source: url,
    sourceType: 'url',
    label: extractLabel(url),
  })
}

function clearWallpaper() {
  store.clearWallpaper()
  imageUrl.value = ''
}

function extractLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// ── Wallhaven.cc resolver ────────────────────────────────────
const wallhavenLoading = ref(false)
const wallhavenError = ref('')

async function resolveWallhaven(id: string) {
  wallhavenLoading.value = true
  wallhavenError.value = ''
  try {
    const res = await fetch(`https://wallhaven.cc/api/v1/w/${id}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const json = await res.json()
    const wp = json.data
    if (!wp || !wp.path) throw new Error('Wallpaper not found')
    store.setWallpaperUrl(wp.path)
    store.addToHistory({
      source: wp.path,
      sourceType: 'wallhaven',
      label: `wallhaven.cc/w/${id}`,
    })
    imageUrl.value = ''
  } catch (err) {
    wallhavenError.value = err instanceof Error ? err.message : 'Failed to resolve wallpaper'
  } finally {
    wallhavenLoading.value = false
  }
}

// ── Wallhaven search (keep existing) ─────────────────────────
const wallhavenQuery = ref('')
const wallhavenResults = ref<Array<{ id: string; path: string; thumbs: { small: string } }>>([])
const searchLoading = ref(false)

async function searchWallhaven(random = false) {
  searchLoading.value = true
  wallhavenError.value = ''
  wallhavenResults.value = []
  try {
    const params = new URLSearchParams({
      categories: '111', purity: '100',
      sorting: random ? 'random' : 'relevance', order: 'desc',
    })
    const q = wallhavenQuery.value.trim()
    if (q && !random) params.set('q', q)
    const res = await fetch(`https://wallhaven.cc/api/v1/search?${params}`)
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    const data = await res.json()
    wallhavenResults.value = data.data.slice(0, 12)
  } catch (err) {
    wallhavenError.value = err instanceof Error ? err.message : 'Failed to fetch'
  } finally {
    searchLoading.value = false
  }
}

function applyWallhavenResult(w: { id: string; path: string; thumbs: { small: string } }) {
  store.setWallpaperUrl(w.path)
  store.addToHistory({
    source: w.path,
    sourceType: 'wallhaven',
    label: `wallhaven.cc/w/${w.id}`,
  })
  imageUrl.value = ''
}

// ── History ──────────────────────────────────────────────────
const history = computed(() => store.data.wallpaperHistory)

function applyHistory(entry: WallpaperEntry) {
  store.applyFromHistory(entry)
}

function removeHistory(id: string) {
  store.removeFromHistory(id)
}
</script>

<template>
  <div class="wallpaper-picker">
    <h4>Wallpaper</h4>

    <!-- History (text list only, no images to avoid lag) -->
    <div v-if="history.length" class="field">
      <label>Saved Wallpapers</label>
      <div class="history-list">
        <div
          v-for="h in history"
          :key="h.id"
          class="history-row"
        >
          <span class="history-name" @click="applyHistory(h)" :title="h.label">
            {{ h.label }}
          </span>
          <span class="history-type">{{ h.sourceType }}</span>
          <button class="danger mini" @click="removeHistory(h.id)" title="Remove">×</button>
        </div>
      </div>
    </div>

    <!-- URL input (auto-detects Wallhaven links) -->
    <div class="field">
      <label>Image URL or Wallhaven link</label>
      <div class="row">
        <input
          v-model="imageUrl"
          @keydown.enter="applyUrl"
          placeholder="https://wallhaven.cc/w/3qqdg6"
        />
        <button class="primary" @click="applyUrl" :disabled="wallhavenLoading">
          {{ wallhavenLoading ? '...' : 'Apply' }}
        </button>
      </div>
      <p v-if="wallhavenError" class="err">{{ wallhavenError }}</p>
    </div>

    <!-- File upload -->
    <div class="field">
      <label>Or upload image</label>
      <input type="file" accept="image/*" @change="onFileChange" class="file-input" />
    </div>

    <!-- Solid color presets -->
    <div class="field">
      <label>Solid Color</label>
      <div class="color-grid">
        <button
          v-for="c in SOLID_COLORS"
          :key="c"
          class="color-swatch"
          :class="{ active: store.data.wallpaperColor === c }"
          :style="{ background: c }"
          @click="applyColor(c)"
          :title="c"
        ></button>
      </div>
    </div>

    <!-- Wallhaven search -->
    <div class="field">
      <label>Wallhaven Search</label>
      <div class="row">
        <input
          v-model="wallhavenQuery"
          placeholder="nature, city, space..."
          @keydown.enter="searchWallhaven(false)"
        />
        <button @click="searchWallhaven(false)" :disabled="searchLoading">
          {{ searchLoading ? '...' : 'Search' }}
        </button>
        <button @click="searchWallhaven(true)" :disabled="searchLoading" title="Random">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Search results -->
    <div v-if="wallhavenResults.length" class="wallhaven-grid">
      <button
        v-for="w in wallhavenResults"
        :key="w.id"
        class="wallhaven-thumb"
        @click="applyWallhavenResult(w)"
        :title="`Apply wallhaven.cc/w/${w.id}`"
      >
        <img :src="w.thumbs.small" :alt="w.id" loading="lazy" />
      </button>
    </div>

    <!-- Blur slider -->
    <div class="field">
      <label>Blur: {{ store.data.blurAmount }}px</label>
      <input
        type="range" min="0" max="30" step="1"
        :value="store.data.blurAmount"
        @input="store.setBlurAmount(Number(($event.target as HTMLInputElement).value))"
        class="slider"
      />
    </div>

    <!-- Clear -->
    <button class="danger" @click="clearWallpaper">Clear Wallpaper</button>
  </div>
</template>

<style scoped>
.wallpaper-picker {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  font-size: 12px;
  color: var(--text-secondary);
}

.row {
  display: flex;
  gap: 6px;
}

.row input {
  flex: 1;
}

.file-input {
  font-size: 12px;
  padding: 6px;
}

.slider {
  width: 100%;
  accent-color: var(--accent);
}

/* History text list */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-glass);
  font-size: 12px;
}

.history-name {
  flex: 1;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  transition: color 0.15s;
}

.history-name:hover {
  color: var(--accent);
}

.history-type {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-glass);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.mini {
  padding: 0 6px;
  font-size: 14px;
  line-height: 1;
  min-width: 22px;
  height: 22px;
  flex-shrink: 0;
}

/* Solid color swatches */
.color-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
}

.color-swatch {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.active {
  border-color: var(--accent);
  transform: scale(1.1);
}

/* Wallhaven search grid */
.wallhaven-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.wallhaven-thumb {
  padding: 0;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  aspect-ratio: 16/9;
  background: var(--bg-glass);
  border: 2px solid transparent;
  transition: border-color 0.15s;
}

.wallhaven-thumb:hover {
  border-color: var(--accent);
}

.wallhaven-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.err {
  font-size: 12px;
  color: #f87171;
  margin: 0;
}
</style>
