import type { ThemeId } from '../themes'

export type { ThemeId } from '../themes'

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
}

// Bookmark item
export interface Bookmark {
  id: string
  name: string
  url: string
  iconUrl?: string
  gridX: number   // signed column index on the centered desktop grid
  gridY: number   // row index (0-based)
}

// Wallpaper history entry
export interface WallpaperEntry {
  id: string
  // Local entries point to the single Blob stored in IndexedDB.
  source: string
  sourceType: 'url' | 'local' | 'wallhaven'
  label: string  // display label
  addedAt: string // ISO date
}

// Global settings
export interface Settings {
  // Theme
  theme: ThemeId

  // Desktop icons
  iconSize: number      // 40-96 px
  iconTileColor: string // hex color, e.g. '#ffffff'
  iconTileOpacity: number // percentage 0-100
  iconLabelColor: string // empty means follow the active theme
  iconArea: {
    leftPercent: number  // horizontal inset from the left edge, 0-40%
    rightPercent: number // horizontal inset from the right edge, 0-40%
  }

  // Wallpaper
  wallpaperUrl: string
  wallpaperColor: string  // hex solid color, e.g. '#1a1a2e'
  wallpaperHistory: WallpaperEntry[]
  blurAmount: number // 0-30 px

  // Search bar
  searchBar: {
    widthPercent: number // percentage 20-80
    verticalPosition: 'top' | 'center' | 'bottom'
    offsetY: number // fine-tune vertical offset in px
  }
  activeEngineId: string
  searchEngines: SearchEngine[]

  // Theme
  darkMode: boolean
  performanceMode: boolean

  // Widgets
  widgets: Widget[]

  // Bookmarks
  bookmarks: Bookmark[]

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
  exportedAt: string
  settings: Settings
}
