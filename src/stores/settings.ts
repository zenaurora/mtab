import { defineStore } from 'pinia'
import { useStorage } from '../composables/useStorage'
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
  { id: 'bm_gmail',    name: 'Gmail',    url: 'https://mail.google.com',  gridX: 5, gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_bilibili', name: 'Bilibili', url: 'https://www.bilibili.com', gridX: 6, gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_github',  name: 'GitHub',   url: 'https://github.com',      gridX: 7, gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_chatgpt', name: 'ChatGPT',  url: 'https://chatgpt.com',     gridX: 8, gridY: 6, gridW: 1, gridH: 1 },
  { id: 'bm_deepseek',name: 'DeepSeek', url: 'https://chat.deepseek.com',gridX: 9, gridY: 6, gridW: 1, gridH: 1 },
]

const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  iconSize: 64,
  iconSpacing: 20,
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
  widgets: [],
  bookmarks: DEFAULT_BOOKMARKS,
  notesContent: '',
}

let uid = 0
function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${++uid}`
}

export const useSettingsStore = defineStore('settings', () => {
  const { data, ready, load, save } = useStorage<Settings>(
    'mtab_settings',
    { ...DEFAULT_SETTINGS }
  )

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
  }

  function setBlurAmount(amount: number) {
    data.value.blurAmount = Math.max(0, Math.min(30, amount))
  }

  // ── Wallpaper History ─────────────────────────────────
  function addToHistory(entry: Omit<WallpaperEntry, 'id' | 'addedAt'>) {
    // Avoid duplicates by source
    const existing = data.value.wallpaperHistory.find((h) => h.source === entry.source)
    if (existing) return existing.id
    const newEntry: WallpaperEntry = {
      ...entry,
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

  function patchHistoryThumbnail(id: string, thumbnail: string) {
    const entry = data.value.wallpaperHistory.find((h) => h.id === id)
    if (entry) entry.thumbnail = thumbnail
  }

  function applyFromHistory(entry: WallpaperEntry) {
    if (entry.sourceType === 'base64') {
      setWallpaperBase64(entry.source)
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

  function setIconSize(size: number) {
    data.value.iconSize = Math.max(40, Math.min(96, size))
  }

  function setIconSpacing(spacing: number) {
    data.value.iconSpacing = Math.max(8, Math.min(48, spacing))
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
  }

  return {
    data,
    ready,
    async load() {
      await load()
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
    patchHistoryThumbnail,
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
    migrateBookmarkPositions,
    // notes
    setNotesContent,
    // theme & display
    setTheme,
    toggleDarkMode,
    setIconSize,
    setIconSpacing,
    // config I/O
    exportConfig,
    importConfig,
  }
})
