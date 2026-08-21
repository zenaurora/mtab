<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { extractDomain } from '../../utils/url'

const store = useSettingsStore()

const imageUrl = ref(store.data.wallpaperUrl)

// Muted, named presets replace the previous unlabelled collection of dark hex values.
const COLOR_GROUPS = [
  {
    label: 'Low light',
    description: 'Deep, low-saturation colors for dark mode',
    colors: [
      { name: 'Midnight', color: '#0f141c', foreground: '#eaf0f8' },
      { name: 'Forest', color: '#121815', foreground: '#e8f0eb' },
      { name: 'Graphite', color: '#151419', foreground: '#f1eef5' },
      { name: 'Slate', color: '#1b2633', foreground: '#edf2f7' },
      { name: 'Cocoa', color: '#2b231e', foreground: '#f2e9df' },
      { name: 'Dusk', color: '#25222b', foreground: '#f0ebf3' },
    ],
  },
  {
    label: 'Soft light',
    description: 'Warm and cool off-whites without harsh pure white',
    colors: [
      { name: 'Cloud', color: '#f7f9fc', foreground: '#172033' },
      { name: 'Sage paper', color: '#f3f6f1', foreground: '#1d2a22' },
      { name: 'Warm paper', color: '#f7f3eb', foreground: '#29261f' },
      { name: 'Mist', color: '#e7ecef', foreground: '#25313a' },
      { name: 'Oat', color: '#ebe3d5', foreground: '#302a22' },
      { name: 'Stone', color: '#e3e2de', foreground: '#292a28' },
    ],
  },
] as const

function applyColor(color: string) {
  store.setWallpaperColor(color)
}

// ── File upload ──────────────────────────────────────────────
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  void applyUploadedImage(file)
  input.value = ''
}

async function applyUploadedImage(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const blob = await resizeWallpaperImage(img, file)
    store.setWallpaperBlob(blob)
    store.addToHistory({ source: '', sourceType: 'base64', label: file.name })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

async function resizeWallpaperImage(img: HTMLImageElement, original: File): Promise<Blob> {
  // Resize to screen resolution to avoid storing unnecessarily large images.
  // Wallpapers never need to be larger than the physical display.
  const maxW = screen.width * (window.devicePixelRatio || 1)
  const maxH = screen.height * (window.devicePixelRatio || 1)
  const scale = Math.min(maxW / img.width, maxH / img.height, 1)

  if (scale >= 1) return original

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return (
    await canvasToBlob(canvas, 'image/webp', 0.9) ??
    await canvasToBlob(canvas, 'image/jpeg', 0.9) ??
    original
  )
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
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
    label: extractDomain(url),
  })
}

function clearWallpaper() {
  store.clearWallpaper()
  imageUrl.value = ''
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
          <span class="history-name" @click="store.applyFromHistory(h)" :title="h.label">
            {{ h.label }}
          </span>
          <span class="history-type">{{ h.sourceType }}</span>
          <button class="danger mini" @click="store.removeFromHistory(h.id)" title="Remove">×</button>
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

    <!-- Curated solid color presets -->
    <div class="field color-presets">
      <label>Solid color presets</label>
      <p class="field-hint">A smaller set of muted colors for focused or low-light use.</p>
      <div v-for="group in COLOR_GROUPS" :key="group.label" class="color-group">
        <div class="color-group-heading">
          <span>{{ group.label }}</span>
          <small>{{ group.description }}</small>
        </div>
        <div class="color-grid">
          <button
            v-for="preset in group.colors"
            :key="preset.color"
            class="color-swatch"
            :class="{ active: store.data.wallpaperColor === preset.color }"
            @click="applyColor(preset.color)"
            :title="`${preset.name} · ${preset.color}`"
            :aria-label="`Use ${preset.name} wallpaper`"
            :aria-pressed="store.data.wallpaperColor === preset.color"
          >
            <span
              class="color-preview"
              :style="{ background: preset.color, color: preset.foreground }"
            >
              <svg v-if="store.data.wallpaperColor === preset.color" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path d="m5 12 4 4L19 6" />
              </svg>
            </span>
            <span class="color-name">{{ preset.name }}</span>
          </button>
        </div>
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

.field-hint {
  color: var(--text-secondary);
  font-size: 10.5px;
  line-height: 1.45;
  opacity: 0.78;
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

/* Curated solid color swatches */
.color-presets {
  gap: 9px;
}

.color-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-glass);
}

.color-group-heading {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.color-group-heading > span {
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 550;
}

.color-group-heading small {
  color: var(--text-secondary);
  font-size: 9.5px;
  line-height: 1.35;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.color-swatch {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  width: 100%;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
}

.color-swatch:hover {
  background: var(--bg-glass-hover);
  transform: translateY(-1px);
}

.color-swatch.active {
  border-color: color-mix(in srgb, var(--accent) 70%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.color-preview {
  display: flex;
  width: 100%;
  height: 30px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.18);
}

.color-name {
  color: var(--text-secondary);
  font-size: 9.5px;
  line-height: 1.2;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
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
