<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import WallpaperPicker from './WallpaperPicker.vue'
import SearchEngineCfg from './SearchEngineCfg.vue'
import ConfigIO from './ConfigIO.vue'
import type { WidgetType } from '../../types'
import { THEMES } from '../../themes'
import { ensureHttpUrl } from '../../utils/url'
import { ICON_AREA_MAX_INSET_PERCENT } from '../../layout/iconArea'

const store = useSettingsStore()
const tabs = [
  { id: 'theme' as const, label: 'Theme' },
  { id: 'wallpaper' as const, label: 'Wallpaper' },
  { id: 'search' as const, label: 'Search' },
  { id: 'widgets' as const, label: 'Widgets' },
  { id: 'bookmarks' as const, label: 'Bookmarks' },
  { id: 'config' as const, label: 'Config' },
]
type SettingsTab = (typeof tabs)[number]['id']

const activeTab = ref<SettingsTab>('theme')
const iconLabelPickerValue = computed(() =>
  store.data.iconLabelColor || (store.data.darkMode ? '#f1efe9' : '#292722')
)

// Bookmark form
const bmName = ref('')
const bmUrl = ref('')

function addBookmark() {
  const url = bmUrl.value.trim()
  if (!url) return
  store.addBookmark({ name: bmName.value.trim(), url: ensureHttpUrl(url) })
  bmName.value = ''
  bmUrl.value = ''
}

const widgetTypes: { type: WidgetType; label: string; desc: string }[] = [
  { type: 'clock', label: 'Clock', desc: 'Digital clock with seconds' },
  { type: 'date', label: 'Date', desc: 'Current date display' },
  { type: 'notes', label: 'Notes', desc: 'Quick memo pad' },
  { type: 'bookmarks', label: 'Bookmarks', desc: 'Website shortcuts grid' },
  { type: 'currency', label: 'Currency', desc: 'Live rates and converter' },
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
            v-for="t in THEMES"
            :key="t.id"
            class="theme-swatch"
            :class="{ active: store.data.theme === t.id }"
            @click="store.setTheme(t.id)"
            :title="t.label"
            :aria-pressed="store.data.theme === t.id"
          >
            <span class="swatch-bg" :class="[t.className, { light: !store.data.darkMode }]">
              <span class="swatch-surface"></span>
              <span class="swatch-accent"></span>
            </span>
            <span class="swatch-copy">
              <span class="swatch-label">{{ t.label }}</span>
              <span class="swatch-description">{{ t.description }}</span>
            </span>
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

        <h4 class="section-heading">Icon Movement Area</h4>
        <div class="icon-area-controls">
          <div class="icon-area-preview" aria-hidden="true">
            <span
              class="icon-area-inset"
              :style="{ width: `${store.data.iconArea.leftPercent}%` }"
            ></span>
            <span class="icon-area-active"></span>
            <span
              class="icon-area-inset"
              :style="{ width: `${store.data.iconArea.rightPercent}%` }"
            ></span>
          </div>

          <div class="field">
            <label>Left margin: {{ store.data.iconArea.leftPercent }}%</label>
            <input
              type="range" min="0" :max="ICON_AREA_MAX_INSET_PERCENT" step="1"
              :value="store.data.iconArea.leftPercent"
              @input="store.setIconAreaLeft(Number(($event.target as HTMLInputElement).value))"
              class="slider"
            />
          </div>

          <div class="field">
            <label>Right margin: {{ store.data.iconArea.rightPercent }}%</label>
            <input
              type="range" min="0" :max="ICON_AREA_MAX_INSET_PERCENT" step="1"
              :value="store.data.iconArea.rightPercent"
              @input="store.setIconAreaRight(Number(($event.target as HTMLInputElement).value))"
              class="slider"
            />
          </div>

          <span class="field-hint">
            The frame follows these margins; icons snap to complete grid cells inside it. When needed, it expands only enough to prevent overlaps.
          </span>
        </div>

        <div class="icon-surface-controls">
          <label class="color-field">
            <span>Background color</span>
            <span class="color-control">
              <input
                type="color"
                class="color-input"
                :value="store.data.iconTileColor"
                @input="store.setIconTileColor(($event.target as HTMLInputElement).value)"
              />
              <code>{{ store.data.iconTileColor }}</code>
            </span>
          </label>

          <label class="color-field">
            <span>
              Icon label color
              <small>Defaults to the active theme</small>
            </span>
            <span class="color-control">
              <button
                v-if="store.data.iconLabelColor"
                type="button"
                class="auto-color-btn"
                @click.prevent="store.setIconLabelColor('')"
              >
                Auto
              </button>
              <input
                type="color"
                class="color-input"
                :value="iconLabelPickerValue"
                @input="store.setIconLabelColor(($event.target as HTMLInputElement).value)"
              />
              <code>{{ store.data.iconLabelColor || 'Auto' }}</code>
            </span>
          </label>

          <div class="field">
            <label>Background opacity: {{ store.data.iconTileOpacity }}%</label>
            <input
              type="range" min="0" max="100" step="1"
              :value="store.data.iconTileOpacity"
              @input="store.setIconTileOpacity(Number(($event.target as HTMLInputElement).value))"
              class="slider"
            />
            <span class="field-hint">Set to 0% for fully transparent icons.</span>
          </div>
        </div>

        <h4 class="section-heading">Performance</h4>
        <label class="toggle-row">
          <span class="toggle-copy">
            <span class="toggle-title">Low effects mode</span>
            <span class="toggle-description">Reduce blur and motion for better performance.</span>
          </span>
          <input
            class="toggle-input"
            type="checkbox"
            :checked="store.data.performanceMode"
            @change="store.setPerformanceMode(($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle-control" aria-hidden="true"><span></span></span>
        </label>
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
        <label class="toggle-row">
          <span class="toggle-copy">
            <span class="toggle-title">Show mtab bookmarks bar</span>
            <span class="toggle-description">Mirror your browser bookmarks at the top of this page.</span>
          </span>
          <input class="toggle-input" type="checkbox" v-model="store.data.showBrowserBookmarkBar" />
          <span class="toggle-control" aria-hidden="true"><span></span></span>
        </label>
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
  right: 18px;
  top: 18px;
  bottom: 18px;
  width: min(388px, calc(100vw - 36px));
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.panel-header h3 {
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 6px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  flex-shrink: 0;
  overflow-x: auto;
}

.tab-btn {
  padding: 7px 10px;
  font-size: 11.5px;
  border-radius: 8px;
  white-space: nowrap;
  background: var(--bg-glass);
}

.tab-btn.active {
  background: var(--accent);
  color: var(--accent-contrast);
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 6px;
}

/* Widgets tab */
.widgets-tab,
.bookmarks-tab {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h4 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.025em;
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

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 58px;
  padding: 11px 12px 11px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-glass);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition), border-color var(--transition), transform var(--transition);
}

.toggle-row:hover {
  background: var(--bg-glass-hover);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
}

.toggle-row:active {
  transform: scale(0.992);
}

.toggle-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.toggle-title {
  font-size: 12.5px;
  font-weight: 550;
  line-height: 1.35;
}

.toggle-description {
  color: var(--text-secondary);
  font-size: 10.5px;
  line-height: 1.4;
}

.toggle-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.toggle-control {
  position: relative;
  width: 38px;
  height: 22px;
  flex: 0 0 auto;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-secondary) 17%, transparent);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
  transition: background var(--transition), border-color var(--transition), box-shadow var(--transition);
}

.toggle-control > span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text-primary) 82%, var(--bg-secondary));
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.24);
  transition: transform var(--transition), background var(--transition);
}

.toggle-input:checked + .toggle-control {
  border-color: color-mix(in srgb, var(--accent) 76%, transparent);
  background: var(--accent);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.16);
}

.toggle-input:checked + .toggle-control > span {
  background: var(--accent-contrast);
  transform: translateX(16px);
}

.toggle-input:focus-visible + .toggle-control {
  outline: 2px solid var(--border-focus);
  outline-offset: 3px;
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.theme-swatch {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 8px;
  border-radius: 11px;
  background: var(--bg-glass);
  border: 1px solid transparent;
  text-align: left;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
  cursor: pointer;
}

.theme-swatch:hover {
  background: var(--bg-glass-hover);
  transform: translateY(-1px);
}

.theme-swatch.active {
  border-color: color-mix(in srgb, var(--accent) 72%, transparent);
  background: color-mix(in srgb, var(--accent) 9%, var(--bg-glass));
}

.swatch-bg {
  position: relative;
  width: 50px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 5px;
  overflow: hidden;
  background: var(--bg-secondary);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
}

.swatch-surface {
  position: absolute;
  left: 6px;
  top: 7px;
  width: 27px;
  height: 24px;
  border-radius: 5px;
  background: var(--bg-glass-hover);
}

.swatch-accent {
  position: relative;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
}

.swatch-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.swatch-label {
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.swatch-description {
  font-size: 9.5px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-heading {
  margin-top: 8px;
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

.icon-surface-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-glass);
}

.icon-area-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: var(--bg-glass);
}

.icon-area-preview {
  display: flex;
  width: 100%;
  height: 22px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: color-mix(in srgb, var(--text-secondary) 10%, transparent);
}

.icon-area-inset {
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--text-secondary) 15%, transparent);
}

.icon-area-active {
  flex: 1 1 auto;
  min-width: 0;
  border-inline: 1px solid color-mix(in srgb, var(--accent) 68%, transparent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.color-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 12px;
}

.color-field > span:first-child {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.color-field small {
  color: var(--text-secondary);
  font-size: 9.5px;
  opacity: 0.72;
}

.color-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-control code {
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  text-transform: uppercase;
}

.color-input {
  width: 34px;
  height: 28px;
  padding: 3px;
  border-radius: 8px;
  cursor: pointer;
}

.auto-color-btn {
  padding: 4px 7px;
  font-size: 9.5px;
}

.field-hint {
  color: var(--text-secondary);
  font-size: 10.5px;
  line-height: 1.45;
  opacity: 0.72;
}

.slider {
  width: 100%;
  accent-color: var(--accent);
}
</style>
