<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useReadLaterStore } from '../../stores/readLater'
import type { ReadLaterItem } from '../../types'
import { extractDomain } from '../../utils/url'
import FaviconImage from '../FaviconImage.vue'
import OpenTabsPicker from '../OpenTabsPicker.vue'

const store = useReadLaterStore()
const undoneItem = ref<ReadLaterItem | null>(null)
const showPicker = ref(false)
let undoTimer = 0

const visibleItems = computed(() => store.items.slice(0, 4))
const remainingCount = computed(() => Math.max(0, store.items.length - visibleItems.value.length))

function relativeTime(iso: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime())
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return days < 30 ? `${days} 天前` : `${Math.floor(days / 30)} 个月前`
}

function closePickerAfterFeedback() {
  window.setTimeout(() => { showPicker.value = false }, 1050)
}

function continueReading(item: ReadLaterItem) {
  window.location.href = item.url
}

async function markDone(item: ReadLaterItem) {
  const removed = await store.remove(item.id)
  if (!removed) return
  undoneItem.value = removed
  window.clearTimeout(undoTimer)
  undoTimer = window.setTimeout(() => { undoneItem.value = null }, 5000)
}

async function undoDone() {
  if (!undoneItem.value) return
  await store.restore(undoneItem.value)
  undoneItem.value = null
  window.clearTimeout(undoTimer)
}

onMounted(() => void store.load())
onBeforeUnmount(() => {
  window.clearTimeout(undoTimer)
})
</script>

<template>
  <section class="read-later-widget" aria-label="续看列表">
    <header class="read-later-header">
      <div class="title-lockup">
        <span class="page-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M6 3h9l3 3v15l-6-3-6 3V3Z" />
            <path d="M15 3v4h4" />
          </svg>
        </span>
        <div>
          <h3>续看</h3>
          <p>{{ store.items.length ? `${store.items.length} 个未读完` : '临时放下，不会忘掉' }}</p>
        </div>
      </div>
      <button
        class="capture-button"
        type="button"
        title="从这个窗口打开的标签页中选择"
        @click="showPicker = true"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>从标签页添加</span>
      </button>
    </header>

    <div v-if="store.items.length" class="reading-list">
      <article v-for="(item, index) in visibleItems" :key="item.id" class="reading-item">
        <span class="reading-line" :class="{ newest: index === 0 }" aria-hidden="true"></span>
        <button class="page-button" type="button" :title="item.url" @click="continueReading(item)">
          <span class="favicon-wrap">
            <FaviconImage :bookmark="item" :alt="''" image-class="favicon">
              <template #fallback>
                <span class="favicon-fallback">{{ extractDomain(item.url).charAt(0).toUpperCase() }}</span>
              </template>
            </FaviconImage>
          </span>
          <span class="page-copy">
            <strong>{{ item.title || extractDomain(item.url) }}</strong>
            <span>{{ extractDomain(item.url) }} · {{ relativeTime(item.savedAt) }}</span>
          </span>
        </button>
        <button class="done-button" type="button" title="标记为已看完" @click="markDone(item)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="m5 12 4 4L19 6" />
          </svg>
        </button>
      </article>
      <p v-if="remainingCount" class="remaining">还有 {{ remainingCount }} 个，滚动查看</p>
    </div>

    <div v-else class="empty-state">
      <div class="empty-lines" aria-hidden="true"><i></i><i></i><i></i></div>
      <p>点击浏览器里的 mtab 图标，<br />选择一个或多个未读完的页面。</p>
    </div>

    <Transition name="status">
      <button v-if="undoneItem" class="status-toast undo" type="button" @click="undoDone">
        已标记看完 <span>撤销</span>
      </button>
    </Transition>
  </section>

  <Teleport to="body">
    <div v-if="showPicker" class="picker-backdrop" @pointerdown.self="showPicker = false">
      <OpenTabsPicker surface="modal" @close="showPicker = false" @saved="closePickerAfterFeedback" />
    </div>
  </Teleport>
</template>

<style scoped>
.read-later-widget {
  --reading-accent: color-mix(in srgb, var(--accent) 78%, #f28b48);
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px 13px 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--bg-secondary) 97%, transparent);
  backdrop-filter: blur(24px) saturate(1.08);
  -webkit-backdrop-filter: blur(24px) saturate(1.08);
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255, 255, 255, 0.055);
  user-select: none;
}

.read-later-widget::before {
  content: '';
  position: absolute;
  left: 0;
  top: 17px;
  bottom: 17px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--reading-accent);
  opacity: 0.8;
}

.read-later-header,
.title-lockup,
.capture-button,
.reading-item,
.page-button {
  display: flex;
  align-items: center;
}

.read-later-header {
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}

.title-lockup { gap: 8px; min-width: 0; }
.title-lockup h3 { margin: 0; font-size: 13px; font-weight: 680; letter-spacing: 0.04em; }
.title-lockup p { margin: 2px 0 0; color: var(--text-secondary); font-size: 9.5px; }

.page-mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--reading-accent);
  border: 1px solid color-mix(in srgb, var(--reading-accent) 38%, var(--border));
  border-radius: 9px 9px 9px 3px;
  background: color-mix(in srgb, var(--reading-accent) 10%, transparent);
}

.capture-button {
  gap: 4px;
  flex: 0 0 auto;
  height: 28px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--reading-accent) 28%, var(--border));
  color: var(--text-primary);
  background: color-mix(in srgb, var(--reading-accent) 8%, transparent);
  font-size: 10px;
}

.capture-button:hover { color: var(--reading-accent); border-color: var(--reading-accent); }

.reading-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;
}

.reading-item {
  position: relative;
  min-height: 45px;
  border-top: 1px solid var(--border);
}

.reading-line {
  width: 5px;
  height: 5px;
  margin: 0 8px 0 3px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text-secondary) 40%, transparent);
}

.reading-line.newest {
  background: var(--reading-accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--reading-accent) 12%, transparent);
}

.page-button {
  min-width: 0;
  flex: 1;
  gap: 8px;
  padding: 5px 2px;
  text-align: left;
  background: transparent;
}

.page-button:hover { background: transparent; }
.page-button:hover strong { color: var(--reading-accent); }

.favicon-wrap,
.favicon,
.favicon-fallback {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 7px;
}

.favicon { object-fit: cover; }
.favicon-fallback {
  display: grid;
  place-items: center;
  background: var(--bg-glass-hover);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
}

.page-copy { min-width: 0; display: grid; gap: 2px; }
.page-copy strong,
.page-copy span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.page-copy strong { color: var(--text-primary); font-size: 11px; font-weight: 570; transition: color var(--transition); }
.page-copy span { color: var(--text-secondary); font-size: 9px; }

.done-button {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  padding: 0;
  opacity: 0;
  color: var(--text-secondary);
  background: transparent;
}

.reading-item:hover .done-button,
.done-button:focus-visible { opacity: 1; }
.done-button:hover { color: #69b989; background: color-mix(in srgb, #69b989 12%, transparent); }

.remaining { padding: 5px 10px; color: var(--text-secondary); font-size: 9px; text-align: center; }

.empty-state {
  min-height: 0;
  flex: 1;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 9px;
  color: var(--text-secondary);
  text-align: center;
  font-size: 10px;
  line-height: 1.55;
}

.empty-lines { width: 72px; display: grid; gap: 5px; }
.empty-lines i { height: 2px; border-radius: 2px; background: var(--border); }
.empty-lines i:nth-child(2) { width: 78%; }
.empty-lines i:nth-child(3) { width: 52%; }

.status-toast {
  position: absolute;
  left: 50%;
  bottom: 10px;
  z-index: 2;
  transform: translateX(-50%);
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--bg-secondary) 98%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
  font-size: 10px;
  white-space: nowrap;
}

.status-toast.undo span { margin-left: 7px; color: var(--reading-accent); }
.status-enter-active, .status-leave-active { transition: opacity 0.16s, transform 0.16s; }
.status-enter-from, .status-leave-to { opacity: 0; transform: translate(-50%, 5px); }

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 14px;
  background: rgba(3, 5, 8, 0.48);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

@media (prefers-reduced-motion: reduce) {
  .status-enter-active, .status-leave-active { transition: none; }
}
</style>
