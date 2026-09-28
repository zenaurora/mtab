import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useStorage } from '../composables/useStorage'
import { READ_LATER_LIMIT, READ_LATER_STORAGE_KEY } from '../readLater/model'
import type { OpenTabCandidate, ReadLaterItem } from '../types'

type ReadLaterResponse = {
  ok: boolean
  tabs?: OpenTabCandidate[]
  item?: ReadLaterItem
  items?: ReadLaterItem[]
  reason?: 'no-page' | 'unavailable'
}

function decodeItems(value: unknown): ReadLaterItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items: ReadLaterItem[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined
    const item = entry as Record<string, unknown>
    if (
      typeof item.id !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.url !== 'string' ||
      typeof item.savedAt !== 'string' ||
      (item.iconUrl !== undefined && typeof item.iconUrl !== 'string')
    ) {
      return undefined
    }
    try {
      const protocol = new URL(item.url).protocol
      if (protocol !== 'http:' && protocol !== 'https:') return undefined
    } catch {
      return undefined
    }
    items.push({
      id: item.id,
      title: item.title,
      url: item.url,
      savedAt: item.savedAt,
      ...(item.iconUrl ? { iconUrl: item.iconUrl } : {}),
    })
  }
  return items.slice(0, READ_LATER_LIMIT)
}

export const useReadLaterStore = defineStore('readLater', () => {
  const { data, ready, load: loadStored, save } = useStorage<ReadLaterItem[]>(
    READ_LATER_STORAGE_KEY,
    [],
    decodeItems,
    { autoSave: typeof chrome === 'undefined' || typeof chrome.runtime?.sendMessage !== 'function' },
  )
  let listening = false

  const items = computed(() =>
    [...data.value].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  )

  async function load() {
    await loadStored()
    if (
      !listening &&
      typeof chrome !== 'undefined' &&
      chrome.storage?.onChanged
    ) {
      listening = true
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return
        const next = changes[READ_LATER_STORAGE_KEY]?.newValue
        if (next === undefined) return
        const decoded = decodeItems(next)
        if (decoded) data.value = decoded
      })
    }
  }

  async function sendMessage(message: object): Promise<ReadLaterResponse> {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return { ok: false, reason: 'unavailable' }
    }
    try {
      return await chrome.runtime.sendMessage(message) as ReadLaterResponse
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
  }

  async function listOpenTabs(): Promise<ReadLaterResponse> {
    return sendMessage({ type: 'read-later:list-tabs' })
  }

  async function captureTabs(tabIds: number[]): Promise<ReadLaterResponse> {
    if (tabIds.length === 0) return { ok: false, reason: 'no-page' }
    const response = await sendMessage({ type: 'read-later:add-tabs', tabIds })
    return response
  }

  async function remove(id: string): Promise<ReadLaterItem | undefined> {
    if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
      const response = await sendMessage({ type: 'read-later:remove', id })
      return response.ok ? response.item : undefined
    }
    const index = data.value.findIndex((item) => item.id === id)
    if (index === -1) return undefined
    const [removed] = data.value.splice(index, 1)
    await save()
    return removed
  }

  async function restore(item: ReadLaterItem): Promise<boolean> {
    if (typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
      const response = await sendMessage({ type: 'read-later:restore', item })
      return response.ok
    }
    data.value = [item, ...data.value.filter((entry) => entry.url !== item.url)]
      .slice(0, READ_LATER_LIMIT)
    await save()
    return true
  }

  return {
    items,
    ready,
    load,
    listOpenTabs,
    captureTabs,
    remove,
    restore,
  }
})
