import { defineStore } from 'pinia'
import { loadStorageValue, removeStorageValue, useStorage } from '../composables/useStorage'
import { loadLargeStorageValue, saveLargeStorageValue } from '../composables/useLargeStorage'
import type {
  Settings,
  SearchEngine,
  Widget,
  Bookmark,
  WidgetType,
  MTabConfig,
  ThemeId,
  WallpaperEntry,
} from '../types'

const DEFAULT_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    urlTemplate: 'https://www.google.com/search?q={query}',
  },
  {
    id: 'bing',
    name: 'Bing',
    urlTemplate: 'https://www.bing.com/search?q={query}',
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    urlTemplate: 'https://duckduckgo.com/?q={query}',
  },
]

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: 'bm_gmail',       name: 'Gmail',       url: 'https://mail.google.com',                         gridX: 4,  gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_bilibili',    name: 'Bilibili',    url: 'https://www.bilibili.com',                        gridX: 5,  gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_github',      name: 'GitHub',      url: 'https://github.com',                              gridX: 6,  gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_xiaohongshu', name: '小红书',       url: 'https://www.xiaohongshu.com',                     iconUrl: 'https://www.xiaohongshu.com/favicon.ico', gridX: 7,  gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_douyin',      name: '抖音',         url: 'https://www.douyin.com',                          gridX: 8,  gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_youtube',     name: 'YouTube',     url: 'https://www.youtube.com',                         gridX: 9,  gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_notion',      name: 'Notion',      url: 'https://www.notion.so',                           gridX: 10, gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_vercel',      name: 'Vercel',      url: 'https://vercel.com',                              gridX: 11, gridY: 6, gridW: 1, gridH: 1 },

  { id: 'bm_chatgpt',     name: 'ChatGPT',     url: 'https://chatgpt.com',                             gridX: 4,  gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_deepseek',    name: 'DeepSeek',    url: 'https://chat.deepseek.com',                       gridX: 5,  gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_qwen',        name: 'Qwen',        url: 'https://chat.qwen.ai',                            gridX: 6,  gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_kimi',        name: 'Kimi',        url: 'https://kimi.com',                                gridX: 7,  gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_zai',         name: 'Z.ai',        url: 'https://chat.z.ai',                               gridX: 8,  gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_ai_studio',   name: 'AI Studio',   url: 'https://aistudio.google.com/prompts/new_chat',     gridX: 9,  gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_ikuncode',    name: 'iKunCode',    url: 'https://api.ikuncode.cc',                         iconUrl: 'https://api.ikuncode.cc/favicon.ico', gridX: 10, gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_claude',      name: 'Claude',      url: 'https://claude.ai',                               gridX: 11, gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_gemini',      name: 'Gemini',      url: 'https://gemini.google.com',                       gridX: 12, gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_perplexity',  name: 'Perplexity',  url: 'https://www.perplexity.ai',                       gridX: 13, gridY: 7, gridW: 1, gridH: 1 },
  { id: 'bm_doubao',      name: '豆包',         url: 'https://www.doubao.com',                          gridX: 14, gridY: 7, gridW: 1, gridH: 1 },
]

const CURRENT_DEFAULT_BOOKMARK_SEED_VERSION = 2

const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  iconSize: 64,
  wallpaperUrl: '',
  wallpaperBase64: '',
  wallpaperColor: '',
  wallpaperHistory: [],
  blurAmount: 0,
  searchBarWidth: 50,
  searchBarPosition: 'center',
  searchBarOffsetY: 0,
  activeEngineId: 'google',
  searchEngines: DEFAULT_ENGINES,
  darkMode: true,
  performanceMode: false,
  widgets: [],
  bookmarks: DEFAULT_BOOKMARKS,
  defaultBookmarkSeedVersion: 0,
  showBrowserBookmarkBar: true,
  showAddButton: true,
  addButtonGridX: 15,
  addButtonGridY: 7,
  notesContent: '',
}

const SETTINGS_KEY = 'mtab_settings'
const WALLPAPER_BASE64_KEY = 'mtab_wallpaper_base64'
const LEGACY_SEARCH_HISTORY_KEY = 'mtab_search_history'
const LOCAL_WALLPAPER_SOURCE = '__local_wallpaper_base64__'

let uid = 0
function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${++uid}`
}

export const useSettingsStore = defineStore('settings', () => {
  const { data, ready, load, save } = useStorage<Settings>(
    SETTINGS_KEY,
    { ...DEFAULT_SETTINGS },
    sanitizeForStorage
  )

  function sanitizeForStorage(settings: Settings): Settings {
    const wallpaperHistory = Array.isArray(settings.wallpaperHistory) ? settings.wallpaperHistory : []
    return {
      ...settings,
      wallpaperBase64: '',
      wallpaperHistory: wallpaperHistory.map((entry) => ({
        id: entry.id,
        source: entry.sourceType === 'base64' ? LOCAL_WALLPAPER_SOURCE : entry.source,
        sourceType: entry.sourceType,
        label: entry.label,
        addedAt: entry.addedAt,
      })),
    }
  }

  // ── Wallpaper ──────────────────────────────────────────
  function setWallpaperUrl(url: string) {
    data.value.wallpaperUrl = url
    data.value.wallpaperBase64 = ''
    data.value.wallpaperColor = ''
  }

  function setWallpaperBase64(base64: string) {
    data.value.wallpaperBase64 = base64
    data.value.wallpaperUrl = ''
    data.value.wallpaperColor = ''
    void saveLargeStorageValue(WALLPAPER_BASE64_KEY, base64)
  }

  function setWallpaperColor(color: string) {
    data.value.wallpaperColor = color
    data.value.wallpaperUrl = ''
    data.value.wallpaperBase64 = ''
  }

  function clearWallpaper() {
    data.value.wallpaperUrl = ''
    data.value.wallpaperBase64 = ''
    data.value.wallpaperColor = ''
    void saveLargeStorageValue(WALLPAPER_BASE64_KEY, '')
  }

  function setBlurAmount(amount: number) {
    data.value.blurAmount = Math.max(0, Math.min(30, amount))
  }

  // ── Wallpaper History ─────────────────────────────────
  function addToHistory(entry: Omit<WallpaperEntry, 'id' | 'addedAt'>) {
    // Avoid duplicates by source
    const normalizedSource = entry.sourceType === 'base64' ? LOCAL_WALLPAPER_SOURCE : entry.source
    const existing = data.value.wallpaperHistory.find((h) => h.source === normalizedSource)
    if (existing) return existing.id
    const newEntry: WallpaperEntry = {
      ...entry,
      source: normalizedSource,
      id: genId('wp'),
      addedAt: new Date().toISOString(),
    }
    data.value.wallpaperHistory.unshift(newEntry)
    // Keep max 30 entries
    if (data.value.wallpaperHistory.length > 30) {
      data.value.wallpaperHistory.length = 30
    }
    return newEntry.id
  }

  function removeFromHistory(id: string) {
    const idx = data.value.wallpaperHistory.findIndex((h) => h.id === id)
    if (idx !== -1) data.value.wallpaperHistory.splice(idx, 1)
  }

  function applyFromHistory(entry: WallpaperEntry) {
    if (entry.sourceType === 'base64') {
      if (entry.source === LOCAL_WALLPAPER_SOURCE) {
        void loadStoredWallpaperBase64().then((base64) => {
          if (base64) setWallpaperBase64(base64)
        })
      } else {
        setWallpaperBase64(entry.source)
      }
    } else {
      setWallpaperUrl(entry.source)
    }
  }

  // ── Search Bar ──────────────────────────────────────────
  function setSearchBarWidth(width: number) {
    data.value.searchBarWidth = Math.max(20, Math.min(80, width))
  }

  function setSearchBarPosition(pos: Settings['searchBarPosition']) {
    data.value.searchBarPosition = pos
  }

  function setSearchBarOffsetY(offset: number) {
    data.value.searchBarOffsetY = offset
  }

  function setActiveEngine(id: string) {
    data.value.activeEngineId = id
  }

  function addSearchEngine(engine: Omit<SearchEngine, 'id'>) {
    const newEngine: SearchEngine = { ...engine, id: genId('engine') }
    data.value.searchEngines.push(newEngine)
  }

  function updateSearchEngine(id: string, patch: Partial<SearchEngine>) {
    const engine = data.value.searchEngines.find((e) => e.id === id)
    if (engine) Object.assign(engine, patch)
  }

  function removeSearchEngine(id: string) {
    const idx = data.value.searchEngines.findIndex((e) => e.id === id)
    if (idx !== -1) {
      data.value.searchEngines.splice(idx, 1)
      if (data.value.activeEngineId === id) {
        data.value.activeEngineId = data.value.searchEngines[0]?.id ?? ''
      }
    }
  }

  // ── Widgets ──────────────────────────────────────────────
  // Fixed sizes per widget type (in grid cells, each cell ~80px)
  const WIDGET_SIZES: Record<WidgetType, { gridW: number; gridH: number }> = {
    clock:     { gridW: 2, gridH: 2 },
    date:      { gridW: 2, gridH: 1 },
    notes:     { gridW: 3, gridH: 3 },
    bookmarks: { gridW: 3, gridH: 2 },
  }

  // Find a free spot on the grid (considers widgets + positioned bookmarks)
  function findFreePosition(gridW: number, gridH: number, startRow = 0): { gridX: number; gridY: number } {
    const maxCols = 20
    for (let row = startRow; row < 30; row++) {
      for (let col = 0; col < maxCols; col++) {
        const widgetOccupied = data.value.widgets.some((w) =>
          col < w.gridX + w.gridW && col + gridW > w.gridX &&
          row < w.gridY + w.gridH && row + gridH > w.gridY
        )
        const bmOccupied = data.value.bookmarks.some((b) =>
          b.gridX !== undefined && b.gridY !== undefined &&
          col < (b.gridX ?? 0) + (b.gridW ?? 1) && col + gridW > (b.gridX ?? 0) &&
          row < (b.gridY ?? 0) + (b.gridH ?? 1) && row + gridH > (b.gridY ?? 0)
        )
        if (!widgetOccupied && !bmOccupied) return { gridX: col, gridY: row }
      }
    }
    return { gridX: 0, gridY: startRow }
  }

  function addWidget(type: WidgetType) {
    const size = WIDGET_SIZES[type]
    const pos = findFreePosition(size.gridW, size.gridH)
    const widget: Widget = {
      id: genId('widget'),
      type,
      gridX: pos.gridX,
      gridY: pos.gridY,
      gridW: size.gridW,
      gridH: size.gridH,
      // Legacy fields
      x: 0, y: 0, width: 0, height: 0, order: 0,
      config: {},
    }
    data.value.widgets.push(widget)
  }

  function removeWidget(id: string) {
    const idx = data.value.widgets.findIndex((w) => w.id === id)
    if (idx !== -1) data.value.widgets.splice(idx, 1)
  }

  function moveWidget(id: string, gridX: number, gridY: number) {
    const widget = data.value.widgets.find((w) => w.id === id)
    if (widget) {
      widget.gridX = Math.max(0, gridX)
      widget.gridY = Math.max(0, gridY)
    }
  }

  function reorderWidgets(fromIndex: number, toIndex: number) {
    const list = data.value.widgets
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= list.length) return
    if (toIndex < 0 || toIndex >= list.length) return
    const [item] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, item)
  }

  function moveBookmark(id: string, gridX: number, gridY: number) {
    const bm = data.value.bookmarks.find((b) => b.id === id)
    if (bm) {
      bm.gridX = Math.max(0, gridX)
      bm.gridY = Math.max(0, gridY)
    }
  }

  function moveBookmarks(patches: Array<{ id: string; gridX: number; gridY: number }>) {
    if (patches.length === 0) return
    const byId = new Map(data.value.bookmarks.map((b) => [b.id, b]))
    for (const patch of patches) {
      const bm = byId.get(patch.id)
      if (!bm) continue
      bm.gridX = Math.max(0, patch.gridX)
      bm.gridY = Math.max(0, patch.gridY)
    }
  }

  function moveAddButton(gridX: number, gridY: number) {
    data.value.addButtonGridX = Math.max(0, gridX)
    data.value.addButtonGridY = Math.max(0, gridY)
  }

  function hideAddButton() {
    data.value.showAddButton = false
  }

  function showAddButton() {
    data.value.showAddButton = true
  }

  // ── Bookmarks ──────────────────────────────────────────
  function addBookmark(bookmark: Omit<Bookmark, 'id'>) {
    const pos = bookmark.gridX !== undefined
      ? { gridX: bookmark.gridX, gridY: bookmark.gridY ?? 6 }
      : findFreePosition(1, 1, 6)
    const newBookmark: Bookmark = {
      ...bookmark,
      id: genId('bm'),
      gridX: pos.gridX,
      gridY: pos.gridY,
      gridW: 1,
      gridH: 1,
    }
    data.value.bookmarks.push(newBookmark)
  }

  function updateBookmark(id: string, patch: Partial<Bookmark>) {
    const bm = data.value.bookmarks.find((b) => b.id === id)
    if (bm) Object.assign(bm, patch)
  }

  function removeBookmark(id: string) {
    const idx = data.value.bookmarks.findIndex((b) => b.id === id)
    if (idx !== -1) data.value.bookmarks.splice(idx, 1)
  }

  function reorderBookmarks(fromIndex: number, toIndex: number) {
    const list = data.value.bookmarks
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || fromIndex >= list.length) return
    if (toIndex < 0 || toIndex >= list.length) return
    const [item] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, item)
  }

  // ── Notes ──────────────────────────────────────────────
  function setNotesContent(content: string) {
    data.value.notesContent = content
  }

  // ── Theme & Display ─────────────────────────────────────
  function setTheme(theme: ThemeId) {
    data.value.theme = theme
  }

  function toggleDarkMode() {
    data.value.darkMode = !data.value.darkMode
  }

  function setPerformanceMode(enabled: boolean) {
    data.value.performanceMode = enabled
  }

  function setIconSize(size: number) {
    data.value.iconSize = Math.max(40, Math.min(96, size))
  }

  // ── Export / Import ──────────────────────────────────────
  function exportConfig(): MTabConfig {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: JSON.parse(JSON.stringify(data.value)),
    }
  }

  function importConfig(config: MTabConfig) {
    if (!config || config.version !== 1 || !config.settings) {
      throw new Error('Invalid mtab config file')
    }
    Object.assign(data.value, config.settings)
  }

  // ── Migration ──────────────────────────────────────────
  function migrateBookmarkPositions() {
    normalizeSettingsShape()
    seedDefaultBookmarks()

    data.value.showAddButton ??= true
    data.value.showBrowserBookmarkBar ??= true
    data.value.addButtonGridX ??= 15
    data.value.addButtonGridY ??= 7

    let startX = 5
    let startY = 6
    for (const bm of data.value.bookmarks) {
      if (bm.gridX === undefined || bm.gridY === undefined) {
        const pos = findFreePosition(1, 1, startY)
        bm.gridX = pos.gridX
        bm.gridY = pos.gridY
        bm.gridW = 1
        bm.gridH = 1
        startX = pos.gridX + 1
        if (startX > 14) {
          startX = 5
          startY = pos.gridY + 1
        }
      }
    }

    normalizeLayoutPositions()
  }

  function seedDefaultBookmarks() {
    if (data.value.defaultBookmarkSeedVersion >= CURRENT_DEFAULT_BOOKMARK_SEED_VERSION) return

    const existingIds = new Set(data.value.bookmarks.map((bm) => bm.id))
    const defaultById = new Map(DEFAULT_BOOKMARKS.map((bm) => [bm.id, bm]))
    for (const bm of DEFAULT_BOOKMARKS) {
      if (!existingIds.has(bm.id)) {
        data.value.bookmarks.push({ ...bm })
      }
    }
    for (const bm of data.value.bookmarks) {
      const defaultBookmark = defaultById.get(bm.id)
      if (defaultBookmark?.iconUrl && !bm.iconUrl) {
        bm.iconUrl = defaultBookmark.iconUrl
      }
    }
    data.value.defaultBookmarkSeedVersion = CURRENT_DEFAULT_BOOKMARK_SEED_VERSION
  }

  function normalizeSettingsShape() {
    if (!Array.isArray(data.value.searchEngines) || data.value.searchEngines.length === 0) {
      data.value.searchEngines = [...DEFAULT_ENGINES]
    }
    if (!Array.isArray(data.value.widgets)) {
      data.value.widgets = []
    }
    if (!Array.isArray(data.value.bookmarks)) {
      data.value.bookmarks = [...DEFAULT_BOOKMARKS.map((bm) => ({ ...bm }))]
    }
    if (!Array.isArray(data.value.wallpaperHistory)) {
      data.value.wallpaperHistory = []
    }
  }

  function normalizeLayoutPositions() {
    const occupied = new Set<string>()
    const key = (gridX: number, gridY: number) => `${gridX},${gridY}`

    for (const w of data.value.widgets) {
      for (let dx = 0; dx < w.gridW; dx++) {
        for (let dy = 0; dy < w.gridH; dy++) {
          occupied.add(key(w.gridX + dx, w.gridY + dy))
        }
      }
    }

    for (const bm of data.value.bookmarks) {
      const gridX = bm.gridX ?? 0
      const gridY = bm.gridY ?? 0
      const currentKey = key(gridX, gridY)
      if (occupied.has(currentKey)) {
        const pos = findFreePositionIgnoringOccupied(occupied)
        bm.gridX = pos.gridX
        bm.gridY = pos.gridY
        occupied.add(key(pos.gridX, pos.gridY))
      } else {
        occupied.add(currentKey)
      }
      bm.gridW = 1
      bm.gridH = 1
    }

    if (data.value.showAddButton) {
      const addKey = key(data.value.addButtonGridX, data.value.addButtonGridY)
      if (occupied.has(addKey)) {
        const pos = findFreePositionIgnoringOccupied(occupied)
        data.value.addButtonGridX = pos.gridX
        data.value.addButtonGridY = pos.gridY
      }
    }
  }

  async function cleanupLegacyLargeStorage() {
    const oldWallpaper = await loadStorageValue<string>(WALLPAPER_BASE64_KEY)
    if (oldWallpaper) {
      await saveLargeStorageValue(WALLPAPER_BASE64_KEY, oldWallpaper)
    }
    await removeStorageValue(WALLPAPER_BASE64_KEY)
    await removeStorageValue(LEGACY_SEARCH_HISTORY_KEY)
  }

  async function loadStoredWallpaperBase64() {
    const indexedDbValue = await loadLargeStorageValue<string>(WALLPAPER_BASE64_KEY)
    if (indexedDbValue) {
      await removeStorageValue(WALLPAPER_BASE64_KEY)
      return indexedDbValue
    }

    // Compatibility for old builds that tried to keep the wallpaper in chrome.storage/localStorage.
    const oldValue = await loadStorageValue<string>(WALLPAPER_BASE64_KEY)
    if (oldValue) {
      await saveLargeStorageValue(WALLPAPER_BASE64_KEY, oldValue)
      await removeStorageValue(WALLPAPER_BASE64_KEY)
    }
    return oldValue
  }

  function findFreePositionIgnoringOccupied(occupied: Set<string>) {
    const maxCols = 20
    for (let row = 0; row < 30; row++) {
      for (let col = 0; col < maxCols; col++) {
        if (!occupied.has(`${col},${row}`)) return { gridX: col, gridY: row }
      }
    }
    return { gridX: 0, gridY: 0 }
  }

  return {
    data,
    ready,
    async load() {
      await cleanupLegacyLargeStorage()
      await load()
      if (data.value.wallpaperBase64) {
        await saveLargeStorageValue(WALLPAPER_BASE64_KEY, data.value.wallpaperBase64)
      }
      const localWallpaper = await loadStoredWallpaperBase64()
      if (localWallpaper && !data.value.wallpaperUrl && !data.value.wallpaperColor) {
        data.value.wallpaperBase64 = localWallpaper
      }
      migrateBookmarkPositions()
    },
    save,
    // wallpaper
    setWallpaperUrl,
    setWallpaperBase64,
    setWallpaperColor,
    clearWallpaper,
    setBlurAmount,
    // wallpaper history
    addToHistory,
    removeFromHistory,
    applyFromHistory,
    // search bar
    setSearchBarWidth,
    setSearchBarPosition,
    setSearchBarOffsetY,
    setActiveEngine,
    addSearchEngine,
    updateSearchEngine,
    removeSearchEngine,
    // widgets
    addWidget,
    removeWidget,
    moveWidget,
    reorderWidgets,
    findFreePosition,
    // bookmarks
    addBookmark,
    updateBookmark,
    removeBookmark,
    reorderBookmarks,
    moveBookmark,
    moveBookmarks,
    moveAddButton,
    hideAddButton,
    showAddButton,
    migrateBookmarkPositions,
    // notes
    setNotesContent,
    // theme & display
    setTheme,
    toggleDarkMode,
    setPerformanceMode,
    setIconSize,
    // config I/O
    exportConfig,
    importConfig,
  }
})
