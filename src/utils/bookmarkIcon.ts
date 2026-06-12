import type { Bookmark } from '../types'

type BookmarkLike = Pick<Bookmark, 'name' | 'url' | 'iconUrl'>

export function faviconCandidates(bookmark: Pick<BookmarkLike, 'url' | 'iconUrl'>): string[] {
  const candidates: string[] = []
  if (bookmark.iconUrl) candidates.push(bookmark.iconUrl)
  try {
    const url = new URL(bookmark.url)
    candidates.push(`${url.origin}/favicon.ico`)
    candidates.push(`${url.origin}/logo.png`)
    candidates.push(`https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`)
  } catch {
    return candidates
  }
  return Array.from(new Set(candidates.filter(Boolean)))
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function displayBookmarkName(bookmark: Pick<BookmarkLike, 'name' | 'url'>): string {
  return bookmark.name || extractDomain(bookmark.url)
}
