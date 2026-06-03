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
  serializeValue: (value: T) => T = (value) => value,
  onSaveError?: (error: unknown) => Promise<void> | void
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

  async function load() {
    try {
      if (isChromeExtension) {
        const result = await chrome.storage.local.get(key)
        if (result[key] !== undefined) {
          data.value = mergeDefaultValue(defaultValue, result[key]) as T
        }
      } else {
        const stored = localStorage.getItem(key)
        if (stored !== null) {
          data.value = mergeDefaultValue(defaultValue, JSON.parse(stored)) as T
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
    const value = cloneValue(serializeValue(data.value))
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

  async function persistWithRetry() {
    const firstError = await tryPersist()
    if (firstError === null) return

    if (!onSaveError) {
      console.warn(`[useStorage] Failed to save key "${key}":`, firstError)
      return
    }

    try {
      await onSaveError(firstError)
    } catch (cleanupError) {
      console.warn(`[useStorage] Failed to run cleanup for key "${key}":`, cleanupError)
    }

    const retryError = await tryPersist()
    if (retryError !== null) {
      console.warn(`[useStorage] Failed to save key "${key}":`, retryError)
    }
  }

  async function flushSaveQueue() {
    while (needsSave) {
      needsSave = false
      await persistWithRetry()
    }
  }

  function save(): Promise<void> {
    needsSave = true
    savePromise ??= flushSaveQueue().finally(() => {
      savePromise = null
    })
    return savePromise
  }

  // Auto-save on change with debounce
  let saveTimer: ReturnType<typeof setTimeout> | null = null
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

function mergeDefaultValue<T>(defaultValue: T, storedValue: unknown): T {
  if (
    defaultValue &&
    typeof defaultValue === 'object' &&
    !Array.isArray(defaultValue) &&
    storedValue &&
    typeof storedValue === 'object' &&
    !Array.isArray(storedValue)
  ) {
    return {
      ...(cloneValue(defaultValue) as Record<string, unknown>),
      ...(storedValue as Record<string, unknown>),
    } as T
  }
  return storedValue as T
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

export async function saveStorageValue<T>(key: string, value: T): Promise<void> {
  try {
    if (isChromeExtension) {
      await chrome.storage.local.set({ [key]: value })
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (e) {
    console.warn(`[useStorage] Failed to save key "${key}":`, e)
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
