<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const store = useSettingsStore()

const newName = ref('')
const newUrl = ref('')

function addEngine() {
  const name = newName.value.trim()
  const url = newUrl.value.trim()
  if (!name || !url) return
  if (!url.includes('{query}')) {
    alert('URL must contain {query} placeholder')
    return
  }
  store.addSearchEngine({ name, urlTemplate: url })
  newName.value = ''
  newUrl.value = ''
}

function removeEngine(id: string) {
  store.removeSearchEngine(id)
}
</script>

<template>
  <div class="search-engine-cfg">
    <h4>Search Engines</h4>

    <!-- List -->
    <div class="engine-list">
      <div
        v-for="engine in store.data.searchEngines"
        :key="engine.id"
        class="engine-row"
      >
        <span class="engine-label">
          <span
            v-if="engine.id === store.data.activeEngineId"
            class="active-dot"
          ></span>
          {{ engine.name }}
        </span>
        <span class="engine-url">{{ engine.urlTemplate }}</span>
        <button
          class="danger small"
          @click="removeEngine(engine.id)"
          :disabled="store.data.searchEngines.length <= 1"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Add new -->
    <div class="add-engine">
      <input v-model="newName" placeholder="Name (e.g. GitHub)" />
      <input
        v-model="newUrl"
        placeholder="URL template with {query}"
      />
      <button class="primary" @click="addEngine">Add</button>
    </div>

    <!-- Search bar settings -->
    <h4 style="margin-top: 16px">Search Bar</h4>

    <div class="field">
      <label>Width: {{ store.data.searchBarWidth }}%</label>
      <input
        type="range"
        min="20"
        max="80"
        step="5"
        :value="store.data.searchBarWidth"
        @input="
          store.setSearchBarWidth(
            Number(($event.target as HTMLInputElement).value)
          )
        "
        class="slider"
      />
    </div>

    <div class="field">
      <label>Position</label>
      <div class="pos-buttons">
        <button
          v-for="pos in (['top', 'center', 'bottom'] as const)"
          :key="pos"
          :class="{ active: store.data.searchBarPosition === pos }"
          @click="store.setSearchBarPosition(pos)"
        >
          {{ pos }}
        </button>
      </div>
    </div>

    <div class="field">
      <label>Vertical offset: {{ store.data.searchBarOffsetY }}px</label>
      <input
        type="range"
        min="-200"
        max="200"
        step="10"
        :value="store.data.searchBarOffsetY"
        @input="
          store.setSearchBarOffsetY(
            Number(($event.target as HTMLInputElement).value)
          )
        "
        class="slider"
      />
    </div>
  </div>
</template>

<style scoped>
.search-engine-cfg {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.engine-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.engine-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg-glass);
  font-size: 12px;
}

.engine-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  min-width: 80px;
}

.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}

.engine-url {
  flex: 1;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
}

.small {
  padding: 4px 6px;
  font-size: 11px;
}

.add-engine {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.add-engine input {
  flex: 1;
  min-width: 100px;
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

.slider {
  width: 100%;
  accent-color: var(--accent);
}

.pos-buttons {
  display: flex;
  gap: 6px;
}

.pos-buttons button {
  flex: 1;
  padding: 6px;
  font-size: 12px;
  text-transform: capitalize;
}

.pos-buttons button.active {
  background: var(--accent);
  color: #fff;
}
</style>
