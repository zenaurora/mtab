import type { ReadLaterItem } from '../types'

export const READ_LATER_STORAGE_KEY = 'mtab_read_later'
export const READ_LATER_LIMIT = 50

export function mergeReadLaterItems(
  selected: ReadLaterItem[],
  existing: ReadLaterItem[],
): ReadLaterItem[] {
  const seen = new Set<string>()
  const merged: ReadLaterItem[] = []
  for (const item of [...selected, ...existing]) {
    if (seen.has(item.url)) continue
    seen.add(item.url)
    merged.push(item)
    if (merged.length === READ_LATER_LIMIT) break
  }
  return merged
}
