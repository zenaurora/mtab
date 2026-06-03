<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import type { MTabConfig } from '../../types'

const store = useSettingsStore()
const importInput = ref<HTMLInputElement | null>(null)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

function exportConfig() {
  const config = store.exportConfig()
  const json = JSON.stringify(config, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mtab-config-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showMsg('Config exported successfully!', 'success')
}

function triggerImport() {
  importInput.value?.click()
}

function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const config = JSON.parse(reader.result as string) as MTabConfig
      store.importConfig(config)
      showMsg('Config imported successfully!', 'success')
    } catch (err) {
      showMsg(
        err instanceof Error ? err.message : 'Invalid config file',
        'error'
      )
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function showMsg(msg: string, type: 'success' | 'error') {
  message.value = msg
  messageType.value = type
  setTimeout(() => {
    message.value = ''
  }, 3000)
}
</script>

<template>
  <div class="config-io">
    <h4>Config Sync</h4>
    <p class="desc">Export your settings to a file and import them on another device.</p>

    <div class="buttons">
      <button class="primary" @click="exportConfig">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        Export Config
      </button>
      <button @click="triggerImport">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
        Import Config
      </button>
      <input
        ref="importInput"
        type="file"
        accept=".json"
        @change="onImportFile"
        style="display: none"
      />
    </div>

    <Transition name="fade">
      <p v-if="message" class="msg" :class="messageType">{{ message }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.config-io {
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

.desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.buttons {
  display: flex;
  gap: 8px;
}

.buttons button {
  display: flex;
  align-items: center;
  gap: 6px;
}

.msg {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
}

.msg.success {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.msg.error {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
