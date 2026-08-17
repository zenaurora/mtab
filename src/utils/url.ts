export function stripWwwHostname(hostname: string): string {
  return hostname.replace(/^www\./, '')
}

export function extractDomain(url: string): string {
  try {
    return stripWwwHostname(new URL(url).hostname)
  } catch {
    return url
  }
}

export function ensureHttpUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
