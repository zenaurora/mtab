// Theme
export type ThemeId = 'default' | 'gruvbox' | 'catppuccin' | 'everforest' | 'shadcn'

export interface ThemeInfo {
  id: ThemeId
  label: string
  preview: string // accent color hex
}

// Search engine configuration
export interface SearchEngine {
  id: string
  name: string
  urlTemplate: string // e.g. "https://www.google.com/search?q={query}"
  icon?: string
}

// Widget types
export type WidgetType = 'clock' | 'date' | 'notes' | 'bookmarks'

export interface Widget {
  id: string
  type: WidgetType
  // Snap-to-grid position (in grid cells, not pixels)
  gridX: number   // column index (0-based)
  gridY: number   // row index (0-based)
  // Fixed size per widget type (in grid cells)
  gridW: number   // width in cells
  gridH: number   // height in cells
  // Legacy (kept for import compat)
  x: number
  y: number
  width: number
  height: number
  order: number
  config: Record<string, unknown>
}

// Bookmark item
export interface Bookmark {
  id: string
  name: string
  url: string
  iconUrl?: string
  gridX?: number   // column index (0-based)
  gridY?: number   // row index (0-based)
  gridW?: number   // always 1
  gridH?: number   // always 1
}

// Wallpaper history entry
export interface WallpaperEntry {
  id: string
  // Source: the actual wallpaper (base64 full or URL)
  source: string
  sourceType: 'url' | 'base64' | 'wallhaven'
  label: string  // display label
  addedAt: string // ISO date
}

// Global settings
export interface Settings {
  // Theme
  theme: ThemeId

  // Desktop icons
  iconSize: number      // 40-96 px

  // Wallpaper
  wallpaperUrl: string
  wallpaperBase64: string
  wallpaperColor: string  // hex solid color, e.g. '#1a1a2e'
  wallpaperHistory: WallpaperEntry[]
  blurAmount: number // 0-30 px

  // Search bar
  searchBarWidth: number // percentage 20-80
  searchBarPosition: 'top' | 'center' | 'bottom'
  searchBarOffsetY: number // fine-tune vertical offset in px
  activeEngineId: string
  searchEngines: SearchEngine[]

  // Theme
  darkMode: boolean
  performanceMode: boolean

  // Widgets
  widgets: Widget[]

  // Bookmarks
  bookmarks: Bookmark[]
  defaultBookmarkSeedVersion: number

  // Chrome bookmarks bar mirror
  showBrowserBookmarkBar: boolean

  // Add shortcut desktop item
  showAddButton: boolean
  addButtonGridX: number
  addButtonGridY: number

  // Notes widget content
  notesContent: string
}

// Export/import config structure
export interface MTabConfig {
  version: number
  exportedAt: string
  settings: Settings
}
