<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type ChromeSearchItem = {
  id: string
  query: string
  engineName: string
  searchUrl: string
  lastVisitTime: number
}

const expanded = ref(false)
const keyword = ref('')
const rootEl = ref<HTMLElement | null>(null)
const items = ref<ChromeSearchItem[]>([])
const loading = ref(false)
const errorText = ref('')

const filteredItems = computed(() => {
  const term = keyword.value.trim().toLowerCase()
  if (!term) return items.value
  return items.value.filter((item) =>
    item.query.toLowerCase().includes(term) ||
    item.engineName.toLowerCase().includes(term)
  )
})

function parseSearchUrl(url: string): Omit<ChromeSearchItem, 'id' | 'lastVisitTime'> | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    const params = parsed.searchParams

    const rules: Array<{ match: RegExp; param: string; engineName: string }> = [
      { match: /(^|\.)google\./, param: 'q', engineName: 'Google' },
      { match: /(^|\.)bing\.com$/, param: 'q', engineName: 'Bing' },
      { match: /(^|\.)duckduckgo\.com$/, param: 'q', engineName: 'DuckDuckGo' },
      { match: /(^|\.)baidu\.com$/, param: 'wd', engineName: 'Baidu' },
      { match: /(^|\.)sogou\.com$/, param: 'query', engineName: 'Sogou' },
      { match: /(^|\.)so\.com$/, param: 'q', engineName: '360 Search' },
      { match: /(^|\.)yahoo\.com$/, param: 'p', engineName: 'Yahoo' },
    ]

    const rule = rules.find((item) => item.match.test(host))
    if (!rule) return null

    const query = params.get(rule.param)?.trim()
    if (!query) return null

    return {
      query,
      engineName: rule.engineName,
      searchUrl: url,
    }
  } catch {
    return null
  }
}

function loadChromeSearchHistory() {
  if (typeof chrome === 'undefined' || !chrome.history?.search) {
    items.value = []
    errorText.value = 'Chrome history is unavailable.'
    return
  }

  loading.value = true
  errorText.value = ''
  chrome.history.search(
    {
      text: '',
      startTime: Date.now() - 1000 * 60 * 60 * 24 * 30,
      maxResults: 500,
    },
    (results) => {
      loading.value = false
      if (chrome.runtime?.lastError) {
        items.value = []
        errorText.value = chrome.runtime.lastError.message || 'Failed to load Chrome history.'
        return
      }

      const seen = new Set<string>()
      const next: ChromeSearchItem[] = []
      for (const result of results) {
        if (!result.url) continue
        const parsed = parseSearchUrl(result.url)
        if (!parsed) continue

        const key = `${parsed.engineName}:${parsed.query.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)

        next.push({
          id: result.id,
          ...parsed,
          lastVisitTime: result.lastVisitTime ?? 0,
        })

        if (next.length >= 100) break
      }
      items.value = next
    }
  )
}

function runSearch(item: ChromeSearchItem) {
  window.location.href = item.searchUrl
}

function formatTime(value: number) {
  if (!value) return ''

  const diff = Date.now() - value
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'now'
  if (diff < hour) return `${Math.floor(diff / minute)}m`
  if (diff < day) return `${Math.floor(diff / hour)}h`
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    expanded.value = false
  }
}

function onDocumentPointerDown(e: PointerEvent) {
  if (expanded.value && !rootEl.value?.contains(e.target as Node)) {
    expanded.value = false
  }
}

onMounted(() => {
  loadChromeSearchHistory()
  window.addEventListener('keydown', onWindowKeydown)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})
</script>

<template>
  <aside
    ref="rootEl"
    class="history-shell"
    :class="{ expanded }"
    aria-label="Chrome search history"
  >
    <button
      class="history-tab glass-panel"
      :class="{ active: expanded }"
      title="Chrome search history"
      @click="expanded = !expanded"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 8v5l3 2" />
        <path d="M3.05 11A9 9 0 1 1 5.64 17.36" />
        <path d="M3 17v-6h6" />
      </svg>
    </button>

    <section class="history-panel glass-panel">
      <div class="history-head">
        <div>
          <h3>History</h3>
          <span>{{ items.length }} from Chrome</span>
        </div>
        <button class="icon-btn" title="Refresh" @click="loadChromeSearchHistory">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
            <path d="M21 12a9 9 0 0 1-15.5 6.2" />
            <path d="M3 12A9 9 0 0 1 18.5 5.8" />
            <path d="M18 2v4h4" />
            <path d="M6 22v-4H2" />
          </svg>
        </button>
        <button class="icon-btn" title="Close" @click="expanded = false">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="history-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input v-model="keyword" placeholder="Find searches" spellcheck="false" />
      </div>

      <div class="history-list">
        <button
          v-for="item in filteredItems"
          :key="item.id"
          class="history-item"
          :title="`${item.engineName}: ${item.query}`"
          @click="runSearch(item)"
        >
          <span class="query">{{ item.query }}</span>
          <span class="meta">
            <span>{{ item.engineName }}</span>
            <span>{{ formatTime(item.lastVisitTime) }}</span>
          </span>
        </button>

        <div v-if="loading" class="empty-state">Loading...</div>
        <div v-else-if="errorText" class="empty-state">{{ errorText }}</div>
        <div v-else-if="filteredItems.length === 0" class="empty-state">
          No searches found.
        </div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.history-shell {
  position: fixed;
  top: 50%;
  right: 0;
  z-index: 35;
  transform: translateY(-50%);
  pointer-events: none;
}

.history-tab {
  position: absolute;
  top: 50%;
  right: 10px;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transform: translateY(-50%);
  pointer-events: auto;
}

.history-tab.active {
  color: var(--accent);
}

.history-panel {
  width: 320px;
  height: min(560px, calc(100vh - 84px));
  margin-right: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transform: translateX(calc(100% + 28px));
  opacity: 0;
  pointer-events: none;
  transition: transform 0.24s cubic-bezier(0.2, 0, 0, 1), opacity 0.18s ease;
}

.history-shell.expanded .history-panel {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.history-head {
  display: grid;
  grid-template-columns: 1fr 28px 28px;
  align-items: center;
  gap: 8px;
}

.history-head h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.history-head span {
  font-size: 11px;
  color: var(--text-secondary);
}

.icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.history-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
  color: var(--text-secondary);
}

.history-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
}

.history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 2px;
}

.history-item {
  width: 100%;
  min-height: 50px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  text-align: left;
  background: transparent;
}

.history-item:hover {
  background: var(--bg-glass-hover);
}

.query {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.meta {
  display: flex;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  color: var(--text-secondary);
}

.meta span {
  flex-shrink: 0;
}

.empty-state {
  margin: auto;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
