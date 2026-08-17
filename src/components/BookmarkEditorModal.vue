<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import type { Bookmark } from '../types'
import { ensureHttpUrl, extractDomain } from '../utils/url'
import { fileToIconDataUrl, ICON_ACCEPT_ATTR, IconUploadError } from '../utils/iconUpload'

const props = defineProps<{
  bookmark: Bookmark | null
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useSettingsStore()
const name = ref(props.bookmark?.name ?? '')
const url = ref(props.bookmark?.url ?? '')
const iconUrl = ref(props.bookmark?.iconUrl ?? '')
const iconFileInput = ref<HTMLInputElement | null>(null)
const iconUploading = ref(false)
const iconUploadError = ref('')
const isDataUrlIcon = computed(() => /^data:image\/[a-z+.-]+;base64,/i.test(iconUrl.value))

function close() {
  emit('close')
}

function triggerIconUpload() {
  iconFileInput.value?.click()
}

async function onIconFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  iconUploadError.value = ''
  iconUploading.value = true
  try {
    iconUrl.value = await fileToIconDataUrl(file)
  } catch (error) {
    iconUploadError.value =
      error instanceof IconUploadError ? error.message : '图标处理失败，请换一张图片'
  } finally {
    iconUploading.value = false
  }
}

function clearIcon() {
  iconUrl.value = ''
  iconUploadError.value = ''
}

function submit() {
  let normalizedUrl = url.value.trim()
  let normalizedIconUrl = iconUrl.value.trim()
  if (!normalizedUrl) return
  normalizedUrl = ensureHttpUrl(normalizedUrl)
  if (
    normalizedIconUrl &&
    !/^https?:\/\//.test(normalizedIconUrl) &&
    !/^data:image\//.test(normalizedIconUrl)
  ) {
    normalizedIconUrl = ensureHttpUrl(normalizedIconUrl)
  }

  const patch = {
    name: name.value.trim() || extractDomain(normalizedUrl),
    url: normalizedUrl,
    iconUrl: normalizedIconUrl || undefined,
  }
  if (props.bookmark) store.updateBookmark(props.bookmark.id, patch)
  else store.addBookmark(patch)
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade" appear>
      <div class="modal-overlay" @click.self="close">
        <div class="modal glass-panel">
          <h3>{{ bookmark ? 'Edit Shortcut' : 'Add Shortcut' }}</h3>
          <div class="modal-field">
            <label>Name (optional)</label>
            <input v-model="name" placeholder="Auto-detected from URL" @keydown.enter="submit" />
          </div>
          <div class="modal-field">
            <label>URL</label>
            <input v-model="url" placeholder="github.com" @keydown.enter="submit" autofocus />
          </div>
          <div class="modal-field">
            <label>Icon (optional)</label>
            <div v-if="isDataUrlIcon" class="icon-upload-preview">
              <img :src="iconUrl" alt="icon preview" />
              <span class="icon-upload-name">已上传自定义图标</span>
              <button type="button" @click="clearIcon">移除</button>
            </div>
            <input
              v-else
              v-model="iconUrl"
              placeholder="https://example.com/favicon.ico"
              @keydown.enter="submit"
            />
            <div class="icon-upload-row">
              <button type="button" :disabled="iconUploading" @click="triggerIconUpload">
                {{ iconUploading ? '处理中…' : isDataUrlIcon ? '更换图片' : '上传图片' }}
              </button>
              <span class="icon-upload-hint">支持 SVG / PNG / JPG / WebP</span>
            </div>
            <p v-if="iconUploadError" class="icon-upload-error">{{ iconUploadError }}</p>
            <input
              ref="iconFileInput"
              type="file"
              class="icon-upload-input"
              :accept="ICON_ACCEPT_ATTR"
              @change="onIconFileChange"
            />
          </div>
          <div class="modal-actions">
            <button @click="close">Cancel</button>
            <button class="primary" @click="submit">{{ bookmark ? 'Save' : 'Add' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  width: 360px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-field label {
  font-size: 12px;
  color: var(--text-secondary);
}

.modal-field input {
  width: 100%;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.icon-upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-upload-hint {
  font-size: 11px;
  color: var(--text-secondary);
}

.icon-upload-input {
  display: none;
}

.icon-upload-error {
  margin: 0;
  font-size: 12px;
  color: #f87171;
}

.icon-upload-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-glass);
}

.icon-upload-preview img {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--bg-glass);
}

.icon-upload-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
