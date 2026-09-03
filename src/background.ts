import type { OpenTabCandidate, ReadLaterItem } from './types'
import { mergeReadLaterItems, READ_LATER_STORAGE_KEY } from './readLater/model'

const CONTEXT_MENU_ID = 'mtab-add-to-read-later'

function isReadableUrl(url: string | undefined): url is string {
  if (!url) return false
  try {
    const protocol = new URL(url).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

async function readItems(): Promise<ReadLaterItem[]> {
  const result = await chrome.storage.local.get(READ_LATER_STORAGE_KEY)
  return Array.isArray(result[READ_LATER_STORAGE_KEY])
    ? result[READ_LATER_STORAGE_KEY] as ReadLaterItem[]
    : []
}

function toReadLaterItem(tab: chrome.tabs.Tab, existing?: ReadLaterItem): ReadLaterItem | undefined {
  if (!isReadableUrl(tab.url)) return undefined
  return {
    id: existing?.id ?? crypto.randomUUID(),
    title: tab.title?.trim() || new URL(tab.url).hostname,
    url: tab.url,
    savedAt: new Date().toISOString(),
    ...(tab.favIconUrl ? { iconUrl: tab.favIconUrl } : {}),
  }
}

async function saveTabs(tabs: chrome.tabs.Tab[]): Promise<ReadLaterItem[]> {
  const items = await readItems()
  const selected: ReadLaterItem[] = []
  const selectedUrls = new Set<string>()
  for (const tab of tabs) {
    const existing = isReadableUrl(tab.url)
      ? items.find((item) => item.url === tab.url)
      : undefined
    const item = toReadLaterItem(tab, existing)
    if (item && !selectedUrls.has(item.url)) {
      selectedUrls.add(item.url)
      selected.push(item)
    }
  }
  if (selected.length === 0) return []
  await chrome.storage.local.set({
    [READ_LATER_STORAGE_KEY]: mergeReadLaterItems(selected, items),
  })
  return selected
}

async function saveTab(tab: chrome.tabs.Tab): Promise<ReadLaterItem | undefined> {
  return (await saveTabs([tab]))[0]
}

async function showBadge(tabId: number | undefined, ok: boolean) {
  if (tabId === undefined) return
  await chrome.action.setBadgeBackgroundColor({ tabId, color: ok ? '#4f8f68' : '#b55245' })
  await chrome.action.setBadgeText({ tabId, text: ok ? '✓' : '!' })
  setTimeout(() => void chrome.action.setBadgeText({ tabId, text: '' }), 1600)
}

async function listOpenTabs(): Promise<OpenTabCandidate[]> {
  const tabs = await chrome.tabs.query({ currentWindow: true })
  return tabs
    .filter((tab) => isReadableUrl(tab.url))
    .sort((a, b) => Number(b.active) - Number(a.active) || (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    .flatMap((tab): OpenTabCandidate[] => tab.id === undefined || !tab.url
      ? []
      : [{
          id: tab.id,
          title: tab.title?.trim() || new URL(tab.url).hostname,
          url: tab.url,
          ...(tab.favIconUrl ? { iconUrl: tab.favIconUrl } : {}),
          active: Boolean(tab.active),
          lastAccessed: tab.lastAccessed ?? 0,
        }])
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.remove(CONTEXT_MENU_ID, () => {
    void chrome.runtime.lastError
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: '加入续看',
      contexts: ['page', 'link'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
      targetUrlPatterns: ['http://*/*', 'https://*/*'],
    })
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab) return
  const targetUrl = info.linkUrl || info.pageUrl || tab.url
  void saveTab({
    ...tab,
    url: targetUrl,
    title: info.linkUrl ? info.selectionText || targetUrl : tab.title,
    favIconUrl: info.linkUrl ? undefined : tab.favIconUrl,
  }).then((item) => showBadge(tab.id, Boolean(item)))
})

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false
  const request = message as { type?: string; tabIds?: unknown }
  if (request.type === 'read-later:list-tabs') {
    void listOpenTabs()
      .then((tabs) => sendResponse({ ok: true, tabs }))
      .catch(() => sendResponse({ ok: false, reason: 'unavailable' }))
    return true
  }
  if (request.type !== 'read-later:add-tabs' || !Array.isArray(request.tabIds)) return false
  const tabIds = request.tabIds.filter((id): id is number => Number.isInteger(id))
  void chrome.tabs.query({ currentWindow: true })
    .then((tabs) => saveTabs(tabs.filter((tab) => tab.id !== undefined && tabIds.includes(tab.id))))
    .then((items) => sendResponse(items.length
      ? { ok: true, items }
      : { ok: false, reason: 'no-page' }))
    .catch(() => sendResponse({ ok: false, reason: 'unavailable' }))
  return true
})
