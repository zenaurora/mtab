<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useReadLaterStore } from '../stores/readLater'
import type { OpenTabCandidate } from '../types'
import { extractDomain } from '../utils/url'
import FaviconImage from './FaviconImage.vue'

const props = withDefaults(defineProps<{
  surface?: 'popup' | 'modal'
}>(), {
  surface: 'modal',
})
const emit = defineEmits<{
  close: []
  saved: [count: number]
}>()

const store = useReadLaterStore()
const tabs = ref<OpenTabCandidate[]>([])
const selected = ref<Set<number>>(new Set())
const expanded = ref(false)
const loading = ref(true)
const status = ref<'idle' | 'saving' | 'success' | 'error'>('idle')
const errorMessage = ref('')

const currentTab = computed(() => tabs.value.find((tab) => tab.active))
const otherTabs = computed(() => tabs.value.filter((tab) => tab.id !== currentTab.value?.id))
const selectedCount = computed(() => selected.value.size)
const savedUrls = computed(() => new Set(store.items.map((item) => item.url)))
const allOthersSelected = computed(() =>
  otherTabs.value.length > 0 && otherTabs.value.every((tab) => selected.value.has(tab.id)),
)

function toggle(tabId: number) {
  const next = new Set(selected.value)
  if (next.has(tabId)) next.delete(tabId)
  else next.add(tabId)
  selected.value = next
  status.value = 'idle'
}

function toggleAllOthers() {
  const next = new Set(selected.value)
  if (allOthersSelected.value) {
    for (const tab of otherTabs.value) next.delete(tab.id)
  } else {
    for (const tab of otherTabs.value) next.add(tab.id)
  }
  selected.value = next
}

function actionLabel(): string {
  if (status.value === 'saving') return '正在收下…'
  if (status.value === 'success') return '已放到首页 ✓'
  if (selectedCount.value === 0) return '选择要续看的页面'
  if (selectedCount.value === 1 && currentTab.value && selected.value.has(currentTab.value.id)) {
    return savedUrls.value.has(currentTab.value.url) ? '更新这一页' : '收下这一页'
  }
  return `收下 ${selectedCount.value} 个页面`
}

async function confirmSelection() {
  if (!selectedCount.value || status.value === 'saving') return
  status.value = 'saving'
  errorMessage.value = ''
  const result = await store.captureTabs([...selected.value])
  if (!result.ok || !result.items?.length) {
    status.value = 'error'
    errorMessage.value = result.reason === 'no-page'
      ? '这些页面已经关闭，请刷新列表后重试。'
      : '暂时无法保存，请重新加载扩展后再试。'
    return
  }
  status.value = 'success'
  emit('saved', result.items.length)
}

async function loadTabs() {
  loading.value = true
  status.value = 'idle'
  errorMessage.value = ''
  await store.load()
  const result = await store.listOpenTabs()
  tabs.value = result.tabs ?? []
  const active = tabs.value.find((tab) => tab.active)
  selected.value = active ? new Set([active.id]) : new Set()
  expanded.value = !active
  if (!result.ok) {
    status.value = 'error'
    errorMessage.value = '无法读取打开的标签页，请重新加载扩展。'
  }
  loading.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.surface === 'modal') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void loadTabs()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section
    class="tabs-picker"
    :class="`is-${props.surface}`"
    :role="props.surface === 'modal' ? 'dialog' : undefined"
    :aria-modal="props.surface === 'modal' ? 'true' : undefined"
    aria-label="选择要续看的页面"
  >
    <header class="picker-header">
      <div>
        <p class="eyebrow">READING INBOX</p>
        <h1>哪些还没看完？</h1>
        <p class="intro">只放眼下要继续的内容，看完就划掉。</p>
      </div>
      <button v-if="props.surface === 'modal'" class="close-button" type="button" aria-label="关闭" @click="emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div v-if="loading" class="loading-state">
      <i></i><i></i><i></i>
    </div>

    <template v-else-if="tabs.length">
      <div v-if="currentTab" class="current-section">
        <p class="section-label">当前页面</p>
        <label class="tab-row current" :class="{ selected: selected.has(currentTab.id) }">
          <input type="checkbox" :checked="selected.has(currentTab.id)" @change="toggle(currentTab.id)" />
          <span class="check-mark" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="m5 12 4 4L19 6" />
            </svg>
          </span>
          <span class="favicon-wrap">
            <FaviconImage :bookmark="currentTab" alt="" image-class="favicon">
              <template #fallback><span class="favicon-fallback">{{ extractDomain(currentTab.url).charAt(0).toUpperCase() }}</span></template>
            </FaviconImage>
          </span>
          <span class="tab-copy">
            <strong>{{ currentTab.title }}</strong>
            <span>{{ extractDomain(currentTab.url) }}</span>
          </span>
          <span v-if="savedUrls.has(currentTab.url)" class="saved-badge">已在续看</span>
        </label>
      </div>

      <button
        v-if="currentTab && otherTabs.length"
        class="expand-button"
        type="button"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span>再选其他标签页</span>
        <span>{{ otherTabs.length }}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ rotated: expanded }">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div v-if="expanded" class="other-section">
        <div class="section-bar">
          <p class="section-label">{{ currentTab ? '这个窗口' : `打开的标签页 · ${otherTabs.length}` }}</p>
          <button v-if="otherTabs.length > 1" type="button" @click="toggleAllOthers">
            {{ allOthersSelected ? '取消全选' : '全选' }}
          </button>
        </div>
        <div class="tab-list">
          <label v-for="tab in otherTabs" :key="tab.id" class="tab-row" :class="{ selected: selected.has(tab.id) }">
            <input type="checkbox" :checked="selected.has(tab.id)" @change="toggle(tab.id)" />
            <span class="check-mark" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <path d="m5 12 4 4L19 6" />
              </svg>
            </span>
            <span class="favicon-wrap">
              <FaviconImage :bookmark="tab" alt="" image-class="favicon">
                <template #fallback><span class="favicon-fallback">{{ extractDomain(tab.url).charAt(0).toUpperCase() }}</span></template>
              </FaviconImage>
            </span>
            <span class="tab-copy">
              <strong>{{ tab.title }}</strong>
              <span>{{ extractDomain(tab.url) }}</span>
            </span>
            <span v-if="savedUrls.has(tab.url)" class="saved-dot" title="已在续看"></span>
          </label>
        </div>
      </div>
    </template>

    <div v-else-if="status !== 'error'" class="empty-state">
      <span class="empty-mark">✓</span>
      <strong>这个窗口很干净</strong>
      <p>没有可加入续看的网页。</p>
    </div>

    <footer class="picker-footer">
      <div v-if="errorMessage" class="error-message" role="alert">
        <span>{{ errorMessage }}</span>
        <button type="button" @click="loadTabs">重试</button>
      </div>
      <button
        v-else-if="tabs.length"
        class="save-button"
        :class="{ success: status === 'success' }"
        type="button"
        :disabled="selectedCount === 0 || status === 'saving' || status === 'success'"
        @click="confirmSelection"
      >
        <span>{{ actionLabel() }}</span>
        <svg v-if="status !== 'success'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </button>
    </footer>
  </section>
</template>

<style scoped>
.tabs-picker {
  --picker-accent: color-mix(in srgb, var(--accent) 78%, #f28b48);
  width: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.tabs-picker.is-modal {
  width: min(420px, calc(100vw - 28px));
  max-height: min(620px, calc(100dvh - 28px));
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.42), inset 0 1px rgba(255, 255, 255, 0.06);
}

.tabs-picker.is-popup { min-height: 240px; max-height: 560px; padding: 18px; }

.picker-header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.eyebrow { margin: 0 0 5px; color: var(--picker-accent); font: 650 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 0.14em; }
.picker-header h1 { margin: 0; font-size: 19px; font-weight: 680; letter-spacing: -0.04em; }
.intro { margin: 5px 0 0; color: var(--text-secondary); font-size: 11px; }
.close-button { width: 30px; height: 30px; display: grid; place-items: center; padding: 0; flex: 0 0 auto; }

.section-label { margin: 0; color: var(--text-secondary); font-size: 9px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; }
.current-section .section-label { margin: 0 0 6px 3px; }

.tab-row {
  position: relative;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 9px 6px 7px;
  border: 1px solid transparent;
  border-radius: 11px;
  cursor: pointer;
  transition: border-color var(--transition), background var(--transition), transform var(--transition);
}

.tab-row:hover { background: var(--bg-glass); }
.tab-row.selected { border-color: color-mix(in srgb, var(--picker-accent) 32%, var(--border)); background: color-mix(in srgb, var(--picker-accent) 7%, transparent); }
.tab-row.current.selected::before { content: ''; position: absolute; left: -1px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--picker-accent); }
.tab-row input { position: absolute; opacity: 0; pointer-events: none; }

.check-mark { width: 18px; height: 18px; display: grid; place-items: center; flex: 0 0 auto; border: 1px solid var(--border); border-radius: 6px; color: transparent; background: var(--bg-glass); }
.selected .check-mark { color: var(--accent-contrast); border-color: var(--picker-accent); background: var(--picker-accent); }

.favicon-wrap, .favicon, .favicon-fallback { width: 26px; height: 26px; flex: 0 0 auto; border-radius: 7px; }
.favicon { object-fit: cover; }
.favicon-fallback { display: grid; place-items: center; color: var(--text-secondary); background: var(--bg-glass-hover); font-size: 10px; font-weight: 700; }
.tab-copy { min-width: 0; flex: 1; display: grid; gap: 3px; }
.tab-copy strong, .tab-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab-copy strong { font-size: 11px; font-weight: 570; }
.tab-copy span { color: var(--text-secondary); font-size: 9px; }
.saved-badge { flex: 0 0 auto; padding: 3px 6px; border-radius: 999px; color: var(--picker-accent); background: color-mix(in srgb, var(--picker-accent) 10%, transparent); font-size: 8px; }
.saved-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: var(--picker-accent); }

.expand-button { width: 100%; display: flex; align-items: center; gap: 6px; margin-top: 9px; padding: 7px 4px; color: var(--text-secondary); background: transparent; font-size: 10px; }
.expand-button:hover { color: var(--text-primary); background: transparent; }
.expand-button span:first-child { flex: 1; text-align: left; }
.expand-button span:nth-child(2) { font: 600 9px/1 ui-monospace, SFMono-Regular, Consolas, monospace; }
.expand-button svg { transition: transform var(--transition); }
.expand-button svg.rotated { transform: rotate(180deg); }

.other-section { min-height: 0; display: flex; flex-direction: column; margin-top: 3px; overflow: hidden; }
.section-bar { display: flex; align-items: center; justify-content: space-between; padding: 4px 3px; }
.section-bar button { padding: 3px 5px; color: var(--picker-accent); background: transparent; font-size: 9px; }
.tab-list { min-height: 0; max-height: 260px; overflow-y: auto; border-top: 1px solid var(--border); }
.tab-list .tab-row { border-radius: 8px; border-width: 0 0 1px; border-color: var(--border); }
.tab-list .tab-row.selected { border-color: var(--border); background: color-mix(in srgb, var(--picker-accent) 7%, transparent); }

.picker-footer { margin-top: auto; padding-top: 14px; }
.save-button { width: 100%; height: 38px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--accent-contrast); background: var(--picker-accent); font-size: 11px; font-weight: 650; }
.save-button:hover { background: color-mix(in srgb, var(--picker-accent) 86%, white); }
.save-button:disabled { cursor: default; opacity: 0.45; transform: none; }
.save-button.success { opacity: 1; color: #f7fff9; background: #4f8f68; }
.error-message { display: flex; align-items: center; gap: 8px; margin: 0; padding: 8px 9px; border-radius: 9px; color: #f19a8e; background: rgba(181, 82, 69, 0.12); font-size: 10px; line-height: 1.4; }
.error-message span { flex: 1; }
.error-message button { flex: 0 0 auto; padding: 4px 7px; color: #ffd7d1; background: rgba(181, 82, 69, 0.24); font-size: 9px; }

.empty-state { flex: 1; display: grid; place-content: center; justify-items: center; padding: 34px 0; color: var(--text-secondary); text-align: center; }
.empty-state .empty-mark { width: 34px; height: 34px; display: grid; place-items: center; margin-bottom: 9px; border: 1px solid var(--border); border-radius: 50%; color: #69b989; }
.empty-state strong { color: var(--text-primary); font-size: 12px; }
.empty-state p { margin: 4px 0 0; font-size: 10px; }

.loading-state { flex: 1; display: grid; gap: 8px; padding: 12px 0 30px; }
.loading-state i { height: 46px; border-radius: 10px; background: var(--bg-glass); animation: shimmer 0.8s ease-in-out infinite alternate; }
.loading-state i:nth-child(2) { opacity: 0.72; }
.loading-state i:nth-child(3) { opacity: 0.46; }
@keyframes shimmer { to { opacity: 0.45; } }

@media (prefers-reduced-motion: reduce) {
  .loading-state i { animation: none; }
}
</style>
