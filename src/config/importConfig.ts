import type { Bookmark, SearchEngine, Settings, Widget, WidgetType } from '../types'
import { THEME_IDS } from '../themes'
import { ICON_AREA_MAX_INSET_PERCENT } from '../layout/iconArea'
import { SUPPORTED_CURRENCY_CODES } from '../exchange/exchangeRate'

const WIDGET_TYPES = new Set<WidgetType>(['clock', 'date', 'notes', 'bookmarks', 'currency'])
const SEARCH_POSITIONS = new Set<Settings['searchBar']['verticalPosition']>(['top', 'center', 'bottom'])

export function parseImportedConfig(input: unknown, current: Settings): Settings {
  const config = expectRecord(input, 'Config')
  const raw = expectRecord(config.settings, 'Config settings')
  const next = cloneSettings(current)

  if ('theme' in raw) next.theme = expectMember(raw.theme, THEME_IDS, 'theme')
  if ('iconSize' in raw) next.iconSize = expectNumber(raw.iconSize, 'iconSize', 40, 96)
  if ('iconTileColor' in raw) {
    next.iconTileColor = expectHexColor(raw.iconTileColor, 'iconTileColor')
  }
  if ('iconTileOpacity' in raw) {
    next.iconTileOpacity = expectNumber(raw.iconTileOpacity, 'iconTileOpacity', 0, 100)
  }
  if ('iconLabelColor' in raw) {
    next.iconLabelColor = raw.iconLabelColor === ''
      ? ''
      : expectHexColor(raw.iconLabelColor, 'iconLabelColor')
  }
  if ('iconArea' in raw) {
    const iconArea = expectRecord(raw.iconArea, 'iconArea')
    next.iconArea = {
      leftPercent: expectNumber(
        iconArea.leftPercent,
        'iconArea.leftPercent',
        0,
        ICON_AREA_MAX_INSET_PERCENT,
      ),
      rightPercent: expectNumber(
        iconArea.rightPercent,
        'iconArea.rightPercent',
        0,
        ICON_AREA_MAX_INSET_PERCENT,
      ),
    }
  }
  if ('blurAmount' in raw) next.blurAmount = expectNumber(raw.blurAmount, 'blurAmount', 0, 30)
  if ('searchBar' in raw) {
    const searchBar = expectRecord(raw.searchBar, 'searchBar')
    next.searchBar = {
      widthPercent: expectNumber(searchBar.widthPercent, 'searchBar.widthPercent', 20, 80),
      verticalPosition: expectMember(
        searchBar.verticalPosition,
        SEARCH_POSITIONS,
        'searchBar.verticalPosition',
      ),
      offsetY: expectNumber(searchBar.offsetY, 'searchBar.offsetY', -200, 200),
    }
  }
  if ('activeEngineId' in raw) next.activeEngineId = expectString(raw.activeEngineId, 'activeEngineId')
  if ('searchEngines' in raw) next.searchEngines = parseSearchEngines(raw.searchEngines)
  if ('darkMode' in raw) next.darkMode = expectBoolean(raw.darkMode, 'darkMode')
  if ('performanceMode' in raw) {
    next.performanceMode = expectBoolean(raw.performanceMode, 'performanceMode')
  }
  if ('widgets' in raw) next.widgets = parseWidgets(raw.widgets)
  if ('bookmarks' in raw) next.bookmarks = parseBookmarks(raw.bookmarks)
  if ('showBrowserBookmarkBar' in raw) {
    next.showBrowserBookmarkBar = expectBoolean(raw.showBrowserBookmarkBar, 'showBrowserBookmarkBar')
  }
  if ('showAddButton' in raw) {
    next.showAddButton = expectBoolean(raw.showAddButton, 'showAddButton')
  }
  if ('addButtonGridX' in raw) {
    next.addButtonGridX = expectInteger(raw.addButtonGridX, 'addButtonGridX')
  }
  if ('addButtonGridY' in raw) {
    next.addButtonGridY = expectInteger(raw.addButtonGridY, 'addButtonGridY', 0)
  }
  if ('notesContent' in raw) next.notesContent = expectString(raw.notesContent, 'notesContent')
  if ('currencyConverter' in raw) {
    const converter = expectRecord(raw.currencyConverter, 'currencyConverter')
    next.currencyConverter = {
      baseCurrency: expectMember(
        converter.baseCurrency,
        SUPPORTED_CURRENCY_CODES,
        'currencyConverter.baseCurrency',
      ),
      quoteCurrency: expectMember(
        converter.quoteCurrency,
        SUPPORTED_CURRENCY_CODES,
        'currencyConverter.quoteCurrency',
      ),
    }
    if (next.currencyConverter.baseCurrency === next.currencyConverter.quoteCurrency) {
      throw new Error('currencyConverter currencies must be different')
    }
  }

  if (!next.searchEngines.some((engine) => engine.id === next.activeEngineId)) {
    next.activeEngineId = next.searchEngines[0]?.id ?? ''
  }

  return next
}

function parseSearchEngines(value: unknown): SearchEngine[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('searchEngines must be a non-empty array')
  }
  const engines = value.map((entry, index) => {
    const engine = expectRecord(entry, `searchEngines[${index}]`)
    const parsed: SearchEngine = {
      id: expectString(engine.id, `searchEngines[${index}].id`, true),
      name: expectString(engine.name, `searchEngines[${index}].name`, true),
      urlTemplate: expectString(engine.urlTemplate, `searchEngines[${index}].urlTemplate`, true),
    }
    if (!parsed.urlTemplate.includes('{query}')) {
      throw new Error(`searchEngines[${index}].urlTemplate must contain {query}`)
    }
    if (engine.icon !== undefined) {
      parsed.icon = expectString(engine.icon, `searchEngines[${index}].icon`)
    }
    return parsed
  })
  assertUniqueIds(engines, 'searchEngines')
  return engines
}

function parseWidgets(value: unknown): Widget[] {
  if (!Array.isArray(value)) throw new Error('widgets must be an array')
  const widgets = value.map((entry, index) => {
    const widget = expectRecord(entry, `widgets[${index}]`)
    const type = expectMember(widget.type, WIDGET_TYPES, `widgets[${index}].type`)
    return {
      id: expectString(widget.id, `widgets[${index}].id`, true),
      type,
      gridX: expectInteger(widget.gridX, `widgets[${index}].gridX`, 0),
      gridY: expectInteger(widget.gridY, `widgets[${index}].gridY`, 0),
      gridW: type === 'currency' ? 3 : expectInteger(widget.gridW, `widgets[${index}].gridW`, 1),
      gridH: type === 'currency' ? 3 : expectInteger(widget.gridH, `widgets[${index}].gridH`, 1),
    }
  })
  assertUniqueIds(widgets, 'widgets')
  return widgets
}

function parseBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) throw new Error('bookmarks must be an array')
  const bookmarks = value.map((entry, index) => {
    const bookmark = expectRecord(entry, `bookmarks[${index}]`)
    const parsed: Bookmark = {
      id: expectString(bookmark.id, `bookmarks[${index}].id`, true),
      name: expectString(bookmark.name, `bookmarks[${index}].name`),
      url: expectString(bookmark.url, `bookmarks[${index}].url`, true),
      gridX: expectInteger(bookmark.gridX, `bookmarks[${index}].gridX`),
      gridY: expectInteger(bookmark.gridY, `bookmarks[${index}].gridY`, 0),
    }
    if (bookmark.iconUrl !== undefined) {
      parsed.iconUrl = expectString(bookmark.iconUrl, `bookmarks[${index}].iconUrl`)
    }
    return parsed
  })
  assertUniqueIds(bookmarks, 'bookmarks')
  return bookmarks
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function expectString(value: unknown, label: string, nonEmpty = false): string {
  if (typeof value !== 'string' || (nonEmpty && value.trim() === '')) {
    throw new Error(`${label} must be ${nonEmpty ? 'a non-empty string' : 'a string'}`)
  }
  return value
}

function expectBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

function expectHexColor(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${label} must be a six-digit hex color`)
  }
  return value.toLowerCase()
}

function expectNumber(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a number between ${min} and ${max}`)
  }
  return value
}

function expectInteger(value: unknown, label: string, min?: number): number {
  if (!Number.isInteger(value) || (min !== undefined && (value as number) < min)) {
    throw new Error(
      min === undefined
        ? `${label} must be an integer`
        : `${label} must be an integer greater than or equal to ${min}`,
    )
  }
  return value as number
}

function expectMember<T extends string>(value: unknown, allowed: Set<T>, label: string): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`${label} has an unsupported value`)
  }
  return value as T
}

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`${label} contains duplicate id "${item.id}"`)
    ids.add(item.id)
  }
}

function cloneSettings(settings: Settings): Settings {
  return JSON.parse(JSON.stringify(settings)) as Settings
}
