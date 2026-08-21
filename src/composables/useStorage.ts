import { ref, watch, type Ref } from 'vue'

const isChromeExtension =
  typeof chrome !== 'undefined' &&
  typeof chrome.storage !== 'undefined' &&
  typeof chrome.storage.local !== 'undefined'

/**
 * Reactive wrapper around chrome.storage.local.
 * Falls back to localStorage when not running as a Chrome extension.
 */
export function useStorage<T>(
  key: string,
  defaultValue: T,
  decodeValue: (value: unknown) => T | undefined,
): {
  data: Ref<T>
  ready: Ref<boolean>
  save: () => Promise<void>
  load: () => Promise<void>
} {
  const data = ref<T>(cloneValue(defaultValue)) as Ref<T>
  const ready = ref(false)
  let savePromise: Promise<void> | null = null
  let needsSave = false
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  async function load() {
    try {
      if (isChromeExtension) {
        const result = await chrome.storage.local.get(key)
        if (result[key] !== undefined) {
          const decoded = decodeValue(result[key])
          if (decoded !== undefined) data.value = cloneValue(decoded)
          else await persistCurrentValue()
        }
      } else {
        const stored = localStorage.getItem(key)
        if (stored !== null) {
          const decoded = decodeValue(JSON.parse(stored))
          if (decoded !== undefined) data.value = cloneValue(decoded)
          else await persistCurrentValue()
        }
      }
    } catch (e) {
      console.warn(`[useStorage] Failed to load key "${key}":`, e)
    } finally {
      ready.value = true
    }
  }

  async function persistCurrentValue() {
    // Convert Vue reactive proxies into plain JSON-compatible data before
    // handing the payload to chrome.storage.
    const value = cloneValue(data.value)
    if (isChromeExtension) {
      await chrome.storage.local.set({ [key]: value })
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }

  async function tryPersist(): Promise<unknown | null> {
    try {
      await persistCurrentValue()
      return null
    } catch (e) {
      return e
    }
  }

  async function persistSafely() {
    const firstError = await tryPersist()
    if (firstError === null) return

    console.warn(`[useStorage] Failed to save key "${key}":`, firstError)
  }

  async function flushSaveQueue() {
    while (needsSave) {
      needsSave = false
      await persistSafely()
    }
  }

  function save(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    needsSave = true
    savePromise ??= flushSaveQueue().finally(() => {
      savePromise = null
    })
    return savePromise
  }

  // Auto-save on change with debounce
  watch(
    data,
    () => {
      if (!ready.value) return
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveTimer = null
        void save()
      }, 300)
    },
    { deep: true }
  )

  return { data, ready, save, load }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export async function loadStorageValue<T>(key: string): Promise<T | undefined> {
  try {
    if (isChromeExtension) {
      const result = await chrome.storage.local.get(key)
      return result[key] as T | undefined
    }
    const stored = localStorage.getItem(key)
    return stored === null ? undefined : (JSON.parse(stored) as T)
  } catch (e) {
    console.warn(`[useStorage] Failed to load key "${key}":`, e)
    return undefined
  }
}

export async function removeStorageValue(key: string): Promise<void> {
  try {
    if (isChromeExtension) {
      await chrome.storage.local.remove(key)
    } else {
      localStorage.removeItem(key)
    }
  } catch (e) {
    console.warn(`[useStorage] Failed to remove key "${key}":`, e)
  }
}
