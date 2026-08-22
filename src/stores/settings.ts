import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useStorage } from '../composables/useStorage'
import { loadLargeStorageValue, saveLargeStorageValue } from '../composables/useLargeStorage'
import {
  createGridSnapshot,
  findFirstFreePosition,
  type GridBounds,
  type MovableGridItem,
} from '../layout/gridLayout'
import { parseImportedConfig } from '../config/importConfig'
import { clampIconAreaInset, ICON_AREA_MAX_INSET_PERCENT } from '../layout/iconArea'
import type {
  Settings,
  SearchEngine,
  Widget,
  Bookmark,
  WidgetType,
  MTabConfig,
  ThemeId,
  WallpaperEntry,
  CurrencyCode,
} from '../types'
import { isSupportedCurrencyCode } from '../exchange/exchangeRate'

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
  { id: 'bm_gmail', name: 'Gmail', url: 'https://mail.google.com', gridX: 4, gridY: 6 },
  { id: 'bm_bilibili', name: 'Bilibili', url: 'https://www.bilibili.com', gridX: 5, gridY: 6 },
  { id: 'bm_github', name: 'GitHub', url: 'https://github.com', gridX: 6, gridY: 6 },
  { id: 'bm_xiaohongshu', name: '小红书', url: 'https://www.xiaohongshu.com', iconUrl: 'https://www.xiaohongshu.com/favicon.ico', gridX: 7, gridY: 6 },
  { id: 'bm_douyin', name: '抖音', url: 'https://www.douyin.com', gridX: 8, gridY: 6 },
  { id: 'bm_youtube', name: 'YouTube', url: 'https://www.youtube.com', gridX: 9, gridY: 6 },
  { id: 'bm_notion', name: 'Notion', url: 'https://www.notion.so', gridX: 10, gridY: 6 },
  { id: 'bm_vercel', name: 'Vercel', url: 'https://vercel.com', gridX: 11, gridY: 6 },

  { id: 'bm_chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', gridX: 4, gridY: 7 },
  { id: 'bm_deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', gridX: 5, gridY: 7 },
  { id: 'bm_qwen', name: 'Qwen', url: 'https://chat.qwen.ai', gridX: 6, gridY: 7 },
  { id: 'bm_kimi', name: 'Kimi', url: 'https://kimi.com', gridX: 7, gridY: 7 },
  { id: 'bm_zai', name: 'Z.ai', url: 'https://chat.z.ai', gridX: 8, gridY: 7 },
  { id: 'bm_ai_studio', name: 'AI Studio', url: 'https://aistudio.google.com/prompts/new_chat', gridX: 9, gridY: 7 },
  { id: 'bm_ikuncode', name: 'iKunCode', url: 'https://api.ikuncode.cc', iconUrl: 'https://api.ikuncode.cc/favicon.ico', gridX: 10, gridY: 7 },
  { id: 'bm_claude', name: 'Claude', url: 'https://claude.ai', gridX: 11, gridY: 7 },
  { id: 'bm_gemini', name: 'Gemini', url: 'https://gemini.google.com', gridX: 12, gridY: 7 },
  { id: 'bm_perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai', gridX: 13, gridY: 7 },
  { id: 'bm_doubao', name: '豆包', url: 'https://www.doubao.com', gridX: 14, gridY: 7 },

  { id: 'bm_figma', name: 'Figma', url: 'https://www.figma.com', gridX: 4, gridY: 8 },
  { id: 'bm_monkeytype', name: 'Monkeytype', url: 'https://monkeytype.com', gridX: 5, gridY: 8 },
  { id: 'bm_zhihu', name: '知乎', url: 'https://www.zhihu.com', gridX: 6, gridY: 8 },
  { id: 'bm_wallhaven', name: 'Wallhaven', url: 'https://wallhaven.cc', gridX: 7, gridY: 8 },
  { id: 'bm_human_benchmark', name: 'Human Benchmark', url: 'https://humanbenchmark.com', gridX: 8, gridY: 8 },
  { id: 'bm_taobao', name: '淘宝', url: 'https://www.taobao.com', gridX: 9, gridY: 8 },
  { id: 'bm_jd', name: '京东', url: 'https://www.jd.com', gridX: 10, gridY: 8 },
  { id: 'bm_google_scholar', name: 'Google Scholar', url: 'https://scholar.google.com', gridX: 11, gridY: 8 },
]

const DEFAULT_SETTINGS: Settings = {
  theme: 'default',
  iconSize: 52,
  iconTileColor: '#ffffff',
  iconTileOpacity: 8,
  iconLabelColor: '',
  iconArea: {
    leftPercent: 0,
    rightPercent: 0,
  },
  wallpaperUrl: '',
  wallpaperColor: '',
  wallpaperHistory: [],
  blurAmount: 0,
  searchBar: {
    widthPercent: 50,
    verticalPosition: 'center',
    offsetY: 0,
  },
  activeEngineId: 'google',
  searchEngines: DEFAULT_ENGINES,
  darkMode: true,
  performanceMode: false,
  widgets: [
    {
      id: 'widget_currency_default',
      type: 'currency',
      gridX: 0,
      gridY: 6,
      gridW: 3,
      gridH: 3,
    },
  ],
  bookmarks: DEFAULT_BOOKMARKS,
  showBrowserBookmarkBar: true,
  showAddButton: true,
  addButtonGridX: 15,
  addButtonGridY: 7,
  notesContent: '',
  currencyConverter: {
    baseCurrency: 'CNY',
    quoteCurrency: 'USD',
  },
}

const SETTINGS_KEY = 'mtab_settings'
const WALLPAPER_BLOB_KEY = 'mtab_wallpaper_blob'
const STORAGE_GRID: GridBounds = { minX: 0, minY: 0, maxX: 19, maxY: 29 }
const WIDGET_SIZES: Record<WidgetType, { gridW: number; gridH: number }> = {
  clock: { gridW: 2, gridH: 2 },
  date: { gridW: 2, gridH: 1 },
  notes: { gridW: 3, gridH: 3 },
  bookmarks: { gridW: 3, gridH: 2 },
  currency: { gridW: 3, gridH: 3 },
}
const WIDGET_TYPES = new Set(Object.keys(WIDGET_SIZES))

function decodeSettings(value: unknown, onMigration: () => void): Settings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const settings = value as Record<string, unknown>
  const searchBar = settings.searchBar
  if (!searchBar || typeof searchBar !== 'object' || Array.isArray(searchBar)) return undefined
  const search = searchBar as Record<string, unknown>
  if (
    typeof search.widthPercent !== 'number' ||
    !['top', 'center', 'bottom'].includes(String(search.verticalPosition)) ||
    typeof search.offsetY !== 'number' ||
    !Array.isArray(settings.widgets) ||
    settings.widgets.some((widget) =>
      !widget ||
      typeof widget !== 'object' ||
      !WIDGET_TYPES.has(String((widget as Record<string, unknown>).type)),
    ) ||
    !Array.isArray(settings.bookmarks) ||
    settings.bookmarks.some((bookmark) => {
      if (!bookmark || typeof bookmark !== 'object') return true
      const item = bookmark as Record<string, unknown>
      return !Number.isInteger(item.gridX) || !Number.isInteger(item.gridY)
    })
  ) {
    return undefined
  }

  // Settings saved before icon-area controls existed remain valid and receive
  // the non-restrictive default. New payloads are validated at the same seam.
  let normalized = value as Settings
  let migrated = false

  const iconArea = settings.iconArea
  if (iconArea === undefined) {
    normalized = { ...normalized, iconArea: { ...DEFAULT_SETTINGS.iconArea } }
    migrated = true
  } else {
    if (!iconArea || typeof iconArea !== 'object' || Array.isArray(iconArea)) return undefined
    const area = iconArea as Record<string, unknown>
    if (
      typeof area.leftPercent !== 'number' ||
      !Number.isFinite(area.leftPercent) ||
      area.leftPercent < 0 ||
      area.leftPercent > ICON_AREA_MAX_INSET_PERCENT ||
      typeof area.rightPercent !== 'number' ||
      !Number.isFinite(area.rightPercent) ||
      area.rightPercent < 0 ||
      area.rightPercent > ICON_AREA_MAX_INSET_PERCENT
    ) {
      return undefined
    }
  }

  const currencyConverter = settings.currencyConverter
  if (currencyConverter === undefined) {
    normalized = {
      ...normalized,
      currencyConverter: { ...DEFAULT_SETTINGS.currencyConverter },
    }
    migrated = true
  } else {
    if (!currencyConverter || typeof currencyConverter !== 'object' || Array.isArray(currencyConverter)) {
      return undefined
    }
    const converter = currencyConverter as Record<string, unknown>
    if (
      !isSupportedCurrencyCode(converter.baseCurrency) ||
      !isSupportedCurrencyCode(converter.quoteCurrency) ||
      converter.baseCurrency === converter.quoteCurrency
    ) {
      return undefined
    }
  }

  const storedWidgets = normalized.widgets
  const hasLegacyCurrencySize = storedWidgets.some(
    (widget) => widget.type === 'currency' && (widget.gridW !== 3 || widget.gridH !== 3),
  )
  if (hasLegacyCurrencySize) {
    normalized = {
      ...normalized,
      widgets: storedWidgets.map((widget) =>
        widget.type === 'currency' ? { ...widget, gridW: 3, gridH: 3 } : widget,
      ),
    }
    migrated = true
  }

  if (migrated) onMigration()
  return normalized
}

let uid = 0
function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${++uid}`
}

export const useSettingsStore = defineStore('settings', () => {
  let shouldPersistDecodedSettings = false
  const { data, load, save } = useStorage<Settings>(
    SETTINGS_KEY,
    DEFAULT_SETTINGS,
    (value) => decodeSettings(value, () => {
      shouldPersistDecodedSettings = true
    }),
  )

  // Blob URL for local wallpaper. It is recreated from IndexedDB on load and
  // never persisted in the JSON settings payload.
  const wallpaperBlobUrl = ref<string>('')

  function createWallpaperBlobUrl(blob: Blob): string {
    return URL.createObjectURL(blob)
  }

  function revokeWallpaperBlobUrl() {
    if (wallpaperBlobUrl.value) {
      URL.revokeObjectURL(wallpaperBlobUrl.value)
      wallpaperBlobUrl.value = ''
    }
  }

  // ── Wallpaper ──────────────────────────────────────────
  function setWallpaperUrl(url: string) {
    revokeWallpaperBlobUrl()
    data.value.wallpaperUrl = url
    data.value.wallpaperColor = ''
  }

  function setWallpaperBlob(blob: Blob) {
    revokeWallpaperBlobUrl()
    wallpaperBlobUrl.value = createWallpaperBlobUrl(blob)
    data.value.wallpaperUrl = ''
    data.value.wallpaperColor = ''
    void saveLargeStorageValue(WALLPAPER_BLOB_KEY, blob)
  }

  function setWallpaperColor(color: string) {
    revokeWallpaperBlobUrl()
    data.value.wallpaperColor = color
    data.value.wallpaperUrl = ''
  }

  function clearWallpaper() {
    revokeWallpaperBlobUrl()
    data.value.wallpaperUrl = ''
    data.value.wallpaperColor = ''
    data.value.wallpaperHistory = data.value.wallpaperHistory.filter((entry) => entry.sourceType !== 'local')
    void saveLargeStorageValue(WALLPAPER_BLOB_KEY, '')
  }

  function setBlurAmount(amount: number) {
    data.value.blurAmount = Math.max(0, Math.min(30, amount))
  }

  // ── Wallpaper History ─────────────────────────────────
  function addToHistory(entry: Omit<WallpaperEntry, 'id' | 'addedAt'>) {
    const existing = data.value.wallpaperHistory.find((item) =>
      entry.sourceType === 'local'
        ? item.sourceType === 'local'
        : item.sourceType === entry.sourceType && item.source === entry.source,
    )
    if (existing && entry.sourceType === 'local') {
      existing.label = entry.label
      existing.addedAt = new Date().toISOString()
      return existing.id
    }
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

  function applyFromHistory(entry: WallpaperEntry) {
    if (entry.sourceType === 'local') {
      void loadStoredWallpaperBlob().then((blob) => {
        if (blob) setWallpaperBlob(blob)
      })
      return
    }
    setWallpaperUrl(entry.source)
  }

  // ── Search Bar ──────────────────────────────────────────
  function setSearchBarWidth(width: number) {
    data.value.searchBar.widthPercent = Math.max(20, Math.min(80, width))
  }

  function setSearchBarPosition(pos: Settings['searchBar']['verticalPosition']) {
    data.value.searchBar.verticalPosition = pos
  }

  function setSearchBarOffsetY(offset: number) {
    data.value.searchBar.offsetY = Math.max(-200, Math.min(200, offset))
  }

  function setActiveEngine(id: string) {
    data.value.activeEngineId = id
  }

  function addSearchEngine(engine: Omit<SearchEngine, 'id'>) {
    const newEngine: SearchEngine = { ...engine, id: genId('engine') }
    data.value.searchEngines.push(newEngine)
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
  // Find a free spot on the grid (considers widgets + positioned bookmarks)
  function findFreePosition(gridW: number, gridH: number, startRow = 0): { gridX: number; gridY: number } {
    const movableItems = positionedBookmarks()
    if (data.value.showAddButton) {
      movableItems.push({
        id: '__add_btn__',
        gridX: data.value.addButtonGridX,
        gridY: data.value.addButtonGridY,
      })
    }
    const snapshot = createGridSnapshot(movableItems, data.value.widgets)
    return findFirstFreePosition(
      snapshot,
      { gridW, gridH },
      boundsForSize(gridW, gridH),
      startRow,
    )
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

  function setCurrencyPair(baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode) {
    if (baseCurrency === quoteCurrency) return
    data.value.currencyConverter.baseCurrency = baseCurrency
    data.value.currencyConverter.quoteCurrency = quoteCurrency
  }

  function moveBookmarks(patches: Array<{ id: string; gridX: number; gridY: number }>) {
    if (patches.length === 0) return
    const byId = new Map(data.value.bookmarks.map((b) => [b.id, b]))
    for (const patch of patches) {
      const bm = byId.get(patch.id)
      if (!bm) continue
      bm.gridX = patch.gridX
      bm.gridY = Math.max(0, patch.gridY)
    }
  }

  function moveAddButton(gridX: number, gridY: number) {
    data.value.addButtonGridX = gridX
    data.value.addButtonGridY = Math.max(0, gridY)
  }

  function hideAddButton() {
    data.value.showAddButton = false
  }

  function showAddButton() {
    data.value.showAddButton = true
  }

  // ── Bookmarks ──────────────────────────────────────────
  function addBookmark(
    bookmark: Omit<Bookmark, 'id' | 'gridX' | 'gridY'> & Partial<Pick<Bookmark, 'gridX' | 'gridY'>>,
  ) {
    const pos = bookmark.gridX !== undefined
      ? { gridX: bookmark.gridX, gridY: bookmark.gridY ?? 6 }
      : findFreePosition(1, 1, 6)
    const newBookmark: Bookmark = {
      ...bookmark,
      id: genId('bm'),
      gridX: pos.gridX,
      gridY: pos.gridY,
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

  function setIconAreaLeft(percent: number) {
    data.value.iconArea.leftPercent = clampIconAreaInset(percent)
  }

  function setIconAreaRight(percent: number) {
    data.value.iconArea.rightPercent = clampIconAreaInset(percent)
  }

  function setIconTileColor(color: string) {
    if (/^#[0-9a-f]{6}$/i.test(color)) data.value.iconTileColor = color.toLowerCase()
  }

  function setIconTileOpacity(opacity: number) {
    data.value.iconTileOpacity = Math.max(0, Math.min(100, opacity))
  }

  function setIconLabelColor(color: string) {
    if (color === '' || /^#[0-9a-f]{6}$/i.test(color)) {
      data.value.iconLabelColor = color.toLowerCase()
    }
  }

  // ── Export / Import ──────────────────────────────────────
  function exportConfig(): MTabConfig {
    const settings = JSON.parse(JSON.stringify(data.value)) as Settings
    settings.wallpaperUrl = ''
    settings.wallpaperColor = ''
    settings.wallpaperHistory = []
    return {
      exportedAt: new Date().toISOString(),
      settings,
    }
  }

  function importConfig(config: unknown) {
    const imported = parseImportedConfig(config, data.value)
    Object.assign(data.value, imported)
  }

  async function loadStoredWallpaperBlob() {
    const wallpaper = await loadLargeStorageValue<unknown>(WALLPAPER_BLOB_KEY)
    return wallpaper instanceof Blob ? wallpaper : undefined
  }

  function positionedBookmarks(): MovableGridItem[] {
    return data.value.bookmarks.map(({ id, gridX, gridY }) => ({ id, gridX, gridY }))
  }

  function boundsForSize(gridW: number, gridH: number): GridBounds {
    return {
      ...STORAGE_GRID,
      maxX: Math.max(STORAGE_GRID.minX, STORAGE_GRID.maxX - gridW + 1),
      maxY: Math.max(STORAGE_GRID.minY, STORAGE_GRID.maxY - gridH + 1),
    }
  }

  return {
    data,
    wallpaperBlobUrl,
    async load() {
      await load()
      if (shouldPersistDecodedSettings) {
        shouldPersistDecodedSettings = false
        await save()
      }
      const localWallpaper = await loadStoredWallpaperBlob()
      if (localWallpaper && !data.value.wallpaperUrl && !data.value.wallpaperColor) {
        wallpaperBlobUrl.value = createWallpaperBlobUrl(localWallpaper)
      }
    },
    save,
    // wallpaper
    setWallpaperUrl,
    setWallpaperBlob,
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
    removeSearchEngine,
    // widgets
    addWidget,
    removeWidget,
    moveWidget,
    setCurrencyPair,
    // bookmarks
    addBookmark,
    updateBookmark,
    removeBookmark,
    moveBookmarks,
    moveAddButton,
    hideAddButton,
    showAddButton,
    // notes
    setNotesContent,
    // theme & display
    setTheme,
    toggleDarkMode,
    setPerformanceMode,
    setIconSize,
    setIconAreaLeft,
    setIconAreaRight,
    setIconTileColor,
    setIconTileOpacity,
    setIconLabelColor,
    // config I/O
    exportConfig,
    importConfig,
  }
})
