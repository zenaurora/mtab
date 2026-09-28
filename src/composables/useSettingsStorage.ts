import { ref, watch, type Ref } from 'vue'
import { mergeChanges } from '../settings/mergeChanges'
import { SETTINGS_KEY, SETTINGS_REVISION_KEY } from '../settings/storage'
import { useStorage } from './useStorage'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Keeps each tab's unsaved edits while the background merges writes in storage order. */
export function useSettingsStorage<T>(defaults: T, decode: (value: unknown) => T | undefined): {
  data: Ref<T>
  load: () => Promise<void>
  save: () => Promise<void>
} {
  if (typeof chrome === 'undefined' || !chrome.storage?.local || !chrome.runtime?.sendMessage) {
    return useStorage(SETTINGS_KEY, defaults, decode)
  }

  const data = ref(clone(defaults)) as Ref<T>
  let baseline = clone(defaults)
  let revision = 0
  let ready = false
  let writing: Promise<void> | undefined
  let pendingRemote: { value: T; revision: number } | undefined
  let applyingStoredValue = false

  function applyStoredValue(value: T) {
    applyingStoredValue = true
    data.value = value
    applyingStoredValue = false
  }

  function receive(value: T, nextRevision: number) {
    if (nextRevision <= revision) return
    if (writing) {
      if (!pendingRemote || nextRevision > pendingRemote.revision) {
        pendingRemote = { value: clone(value), revision: nextRevision }
      }
      return
    }
    applyStoredValue(mergeChanges(baseline, clone(data.value), value))
    baseline = clone(value)
    revision = nextRevision
    if (!same(data.value, baseline)) void save()
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) return
    const stored = changes[SETTINGS_KEY].newValue
    if (stored === undefined) return
    const decoded = decode(stored)
    if (!decoded) return
    const nextRevision = changes[SETTINGS_REVISION_KEY]?.newValue
    const updated = { value: decoded, revision: typeof nextRevision === 'number' ? nextRevision : revision + 1 }
    if (!ready) {
      if (!pendingRemote || updated.revision > pendingRemote.revision) pendingRemote = updated
      return
    }
    receive(updated.value, updated.revision)
  })

  async function load() {
    try {
      const stored = await chrome.storage.local.get([SETTINGS_KEY, SETTINGS_REVISION_KEY])
      if (stored[SETTINGS_KEY] !== undefined) {
        baseline = clone(stored[SETTINGS_KEY] as T)
        applyStoredValue(clone(decode(stored[SETTINGS_KEY]) ?? defaults))
      }
      revision = typeof stored[SETTINGS_REVISION_KEY] === 'number'
        ? stored[SETTINGS_REVISION_KEY] : 0
    } catch (error) {
      console.warn('[settings] Failed to load:', error)
    } finally {
      ready = true
      if (pendingRemote) {
        const remote = pendingRemote
        pendingRemote = undefined
        receive(remote.value, remote.revision)
      }
    }
  }

  async function flush() {
    while (!same(data.value, baseline)) {
      const before = clone(baseline)
      const after = clone(data.value)
      try {
        const response = await chrome.runtime.sendMessage({ type: 'settings:merge', before, after }) as {
          ok?: boolean; settings?: T; revision?: number
        }
        if (!response?.ok || !response.settings || typeof response.revision !== 'number') {
          throw new Error('Settings merge failed')
        }
        const current = clone(data.value)
        baseline = clone(response.settings)
        revision = response.revision
        applyStoredValue(mergeChanges(after, current, baseline))
        if (pendingRemote && pendingRemote.revision > revision) {
          const remote = pendingRemote
          pendingRemote = undefined
          applyStoredValue(mergeChanges(baseline, clone(data.value), remote.value))
          baseline = clone(remote.value)
          revision = remote.revision
        } else {
          pendingRemote = undefined
        }
      } catch (error) {
        console.warn('[settings] Failed to save:', error)
        throw error
      }
    }
  }

  function save(): Promise<void> {
    if (!ready) return Promise.resolve()
    writing ??= flush().finally(() => { writing = undefined })
    return writing
  }

  watch(data, () => {
    if (ready && !applyingStoredValue) void save().catch(() => undefined)
  }, { deep: true, flush: 'sync' })

  return { data, load, save }
}
