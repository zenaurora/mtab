import type { SearchEngine } from '../types'

export function buildSearchUrl(query: string, engine: SearchEngine | undefined): string | null {
  const normalizedQuery = query.trim()
  if (!normalizedQuery || !engine) return null
  return engine.urlTemplate.replace('{query}', encodeURIComponent(normalizedQuery))
}

export function isSearchSubmitKey(event: Pick<KeyboardEvent, 'key' | 'isComposing'>): boolean {
  return event.key === 'Enter' && !event.isComposing
}
