<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import WallpaperPicker from './WallpaperPicker.vue'
import SearchEngineCfg from './SearchEngineCfg.vue'
import ConfigIO from './ConfigIO.vue'
import type { WidgetType, ThemeId } from '../../types'

const store = useSettingsStore()
const activeTab = ref<'theme' | 'wallpaper' | 'search' | 'widgets' | 'bookmarks' | 'config'>('theme')

const tabs = [
  { id: 'theme' as const, label: 'Theme' },
  { id: 'wallpaper' as const, label: 'Wallpaper' },
  { id: 'search' as const, label: 'Search' },
  { id: 'widgets' as const, label: 'Widgets' },
  { id: 'bookmarks' as const, label: 'Bookmarks' },
  { id: 'config' as const, label: 'Config' },
]

interface ThemeOption { id: ThemeId; label: string; accent: string; bg: string }
const themeOptions: ThemeOption[] = [
  { id: 'default',    label: 'Default',    accent: '#6366f1', bg: '#1a1a2e' },
  { id: 'gruvbox',    label: 'Gruvbox',    accent: '#d79921', bg: '#282828' },
  { id: 'catppuccin', label: 'Catppuccin', accent: '#cba6f7', bg: '#1e1e2e' },
  { id: 'everforest', label: 'Everforest', accent: '#a7c080', bg: '#2b3339' },
  { id: 'shadcn',     label: 'Shadcn',     accent: '#e4e4e7', bg: '#09090b' },
]

// Bookmark form
const bmName = ref('')
const bmUrl = ref('')

function addBookmark() {
  const url = bmUrl.value.trim()
  if (!url) return
  let finalUrl = url
  if (!/^https?:\/\//.test(finalUrl)) finalUrl = 'https://' + finalUrl
  store.addBookmark({ name: bmName.value.trim(), url: finalUrl })
  bmName.value = ''
  bmUrl.value = ''
}

const widgetTypes: { type: WidgetType; label: string; desc: string }[] = [
  { type: 'clock', label: 'Clock', desc: 'Digital clock with seconds' },
  { type: 'date', label: 'Date', desc: 'Current date display' },
  { type: 'notes', label: 'Notes', desc: 'Quick memo pad' },
  { type: 'bookmarks', label: 'Bookmarks', desc: 'Website shortcuts grid' },
]
</script>

<template>
  <div class="settings-panel glass-panel">
    <!-- Header -->
    <div class="panel-header">
      <h3>Settings</h3>
      <div class="header-actions">
        <button @click="store.toggleDarkMode()" :title="store.data.darkMode ? 'Light mode' : 'Dark mode'">
          <svg v-if="store.data.darkMode" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="tab-content">
      <!-- Theme tab -->
      <div v-if="activeTab === 'theme'" class="theme-tab">
        <h4>Color Theme</h4>
        <div class="theme-grid">
          <button
            v-for="t in themeOptions"
            :key="t.id"
            class="theme-swatch"
            :class="{ active: store.data.theme === t.id }"
            @click="store.setTheme(t.id)"
            :title="t.label"
          >
            <span class="swatch-bg" :style="{ background: t.bg }">
              <span class="swatch-accent" :style="{ background: t.accent }"></span>
            </span>
            <span class="swatch-label">{{ t.label }}</span>
          </button>
        </div>

        <h4 style="margin-top: 20px">Desktop Icons</h4>
        <div class="field">
          <label>Icon Size: {{ store.data.iconSize }}px</label>
          <input
            type="range" min="40" max="96" step="4"
            :value="store.data.iconSize"
            @input="store.setIconSize(Number(($event.target as HTMLInputElement).value))"
            class="slider"
          />
        </div>
        <div class="field">
          <label>Icon Spacing: {{ store.data.iconSpacing }}px</label>
          <input
            type="range" min="8" max="48" step="4"
            :value="store.data.iconSpacing"
            @input="store.setIconSpacing(Number(($event.target as HTMLInputElement).value))"
            class="slider"
          />
        </div>
      </div>

      <WallpaperPicker v-else-if="activeTab === 'wallpaper'" />

      <SearchEngineCfg v-else-if="activeTab === 'search'" />

      <!-- Widgets tab -->
      <div v-else-if="activeTab === 'widgets'" class="widgets-tab">
        <h4>Add Widget</h4>
        <div class="widget-options">
          <button
            v-for="wt in widgetTypes"
            :key="wt.type"
            class="widget-option"
            @click="store.addWidget(wt.type)"
          >
            <span class="opt-label">{{ wt.label }}</span>
            <span class="opt-desc">{{ wt.desc }}</span>
          </button>
        </div>
        <div v-if="store.data.widgets.length > 0" class="widget-list">
          <h4>Active Widgets</h4>
          <div
            v-for="w in store.data.widgets"
            :key="w.id"
            class="widget-row"
          >
            <span>{{ w.type }}</span>
            <button class="danger small" @click="store.removeWidget(w.id)">Remove</button>
          </div>
        </div>
      </div>

      <!-- Bookmarks tab -->
      <div v-else-if="activeTab === 'bookmarks'" class="bookmarks-tab">
        <h4>Add Bookmark</h4>
	        <div class="bm-form">
	          <input v-model="bmName" placeholder="Name (optional)" />
	          <input v-model="bmUrl" placeholder="URL (e.g. github.com)" @keydown.enter="addBookmark" />
	          <button class="primary" @click="addBookmark">Add</button>
	        </div>
	        <button v-if="!store.data.showAddButton" @click="store.showAddButton()">
	          Restore Add Icon
	        </button>
	        <div v-if="store.data.bookmarks.length > 0" class="bm-list">
          <h4>Saved Bookmarks</h4>
          <div
            v-for="bm in store.data.bookmarks"
            :key="bm.id"
            class="bm-row"
          >
            <span class="bm-label">{{ bm.name || bm.url }}</span>
            <span class="bm-url">{{ bm.url }}</span>
            <button class="danger small" @click="store.removeBookmark(bm.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <ConfigIO v-else-if="activeTab === 'config'" />
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  position: fixed;
  right: 16px;
  top: 16px;
  bottom: 16px;
  width: 360px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 6px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  flex-shrink: 0;
  overflow-x: auto;
}

.tab-btn {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 6px;
  white-space: nowrap;
  background: var(--bg-glass);
}

.tab-btn.active {
  background: var(--accent);
  color: #fff;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

/* Widgets tab */
.widgets-tab,
.bookmarks-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h4 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}

.widget-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.widget-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  text-align: left;
  border-radius: 8px;
  background: var(--bg-glass);
}

.widget-option:hover {
  background: var(--bg-glass-hover);
}

.opt-label {
  font-size: 13px;
  font-weight: 500;
}

.opt-desc {
  font-size: 11px;
  color: var(--text-secondary);
}

.widget-list,
.bm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.widget-row,
.bm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 6px;
  background: var(--bg-glass);
  font-size: 12px;
}

.bm-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bm-form .primary {
  align-self: flex-start;
}

.bm-label {
  font-weight: 500;
  margin-right: 8px;
}

.bm-url {
  flex: 1;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.small {
  padding: 4px 8px;
  font-size: 11px;
}

/* Theme tab */
.theme-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.theme-swatch {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  background: var(--bg-glass);
  border: 2px solid transparent;
  transition: border-color 0.2s;
  cursor: pointer;
}

.theme-swatch.active {
  border-color: var(--accent);
}

.swatch-bg {
  width: 48px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 4px;
  overflow: hidden;
}

.swatch-accent {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.swatch-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 12px;
  color: var(--text-secondary);
}

.slider {
  width: 100%;
  accent-color: var(--accent);
}
</style>
