import { ref, watch, type Ref } from 'vue'

const isChromeExtension =
  typeof chrome !== 'undefined' &&
  typeof chrome.storage !== 'undefined' &&
  typeof chrome.storage.local !== 'undefined'

/**
 * Reactive wrapper around chrome.storage.local.
 * Falls back to localStorage when not running as a Chrome extension.
 */
export function useStorage<T>(key: string, defaultValue: T): {
  data: Ref<T>
  ready: Ref<boolean>
  save: () => Promise<void>
  load: () => Promise<void>
} {
  const data = ref<T>(defaultValue) as Ref<T>
  const ready = ref(false)

  async function load() {
    try {
      if (isChromeExtension) {
        const result = await chrome.storage.local.get(key)
        if (result[key] !== undefined) {
          data.value = result[key] as T
        }
      } else {
        const stored = localStorage.getItem(key)
        if (stored !== null) {
          data.value = JSON.parse(stored) as T
        }
      }
    } catch (e) {
      console.warn(`[useStorage] Failed to load key "${key}":`, e)
    } finally {
      ready.value = true
    }
  }

  async function save() {
    try {
      if (isChromeExtension) {
        await chrome.storage.local.set({ [key]: data.value })
      } else {
        localStorage.setItem(key, JSON.stringify(data.value))
      }
    } catch (e) {
      console.warn(`[useStorage] Failed to save key "${key}":`, e)
    }
  }

  // Auto-save on change with debounce
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    data,
    () => {
      if (!ready.value) return
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(save, 300)
    },
    { deep: true }
  )

  return { data, ready, save, load }
}
