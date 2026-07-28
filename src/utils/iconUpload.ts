/**
 * Turns an uploaded image file into an inline data URL suitable for storing in
 * `Bookmark.iconUrl`. Raster images are downscaled to icon size so they stay
 * small enough to travel inside the exported settings JSON; SVGs are kept as
 * vectors (lightly sanitized). Throws {@link IconUploadError} with a
 * user-facing message when the file is unsupported or too large.
 */

export class IconUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IconUploadError'
  }
}

const ACCEPTED_MIME = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
])

/** `accept` attribute for the upload <input type="file">. */
export const ICON_ACCEPT_ATTR =
  '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp'

/** Raster icons are downscaled to fit within this many pixels on the long edge. */
const MAX_RASTER_DIMENSION = 256

/** Hard cap on the encoded icon, protecting storage + export size. */
const MAX_ICON_BYTES = 64 * 1024

/**
 * Pre-decode guards: reject oversized files before reading them into memory,
 * so a huge file (or a decompression-bomb PNG) never gets fully read/decoded
 * only to fail the final size check anyway.
 */
const MAX_RASTER_FILE_BYTES = 10 * 1024 * 1024
const MAX_SVG_FILE_BYTES = 512 * 1024

const EXTENSION_MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

export async function fileToIconDataUrl(file: File): Promise<string> {
  const type = file.type || inferMimeFromName(file.name)
  if (!ACCEPTED_MIME.has(type)) {
    throw new IconUploadError('不支持的图片格式，请上传 SVG / PNG / JPG / WebP')
  }

  if (type === 'image/svg+xml' && file.size > MAX_SVG_FILE_BYTES) {
    throw new IconUploadError('SVG 文件过大，请上传 512KB 以内的文件')
  }
  if (type !== 'image/svg+xml' && file.size > MAX_RASTER_FILE_BYTES) {
    throw new IconUploadError('文件过大，请上传 10MB 以内的图片')
  }

  const dataUrl =
    type === 'image/svg+xml' ? await svgToDataUrl(file) : await rasterToDataUrl(file)

  assertWithinSizeLimit(dataUrl)
  return dataUrl
}

function inferMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_MIME[ext] ?? ''
}

// ── SVG ────────────────────────────────────────────────────────
// Rendered via <img>, which already blocks scripting — that is the primary
// safeguard. The DOM-based sanitization below is defense-in-depth in case a
// future code path ever inlines these SVGs (v-html, innerHTML, import
// preview, ...); it must not be relied on as the only barrier.
async function svgToDataUrl(file: File): Promise<string> {
  const clean = sanitizeSvg(await file.text())
  return `data:image/svg+xml;base64,${utf8ToBase64(clean)}`
}

function sanitizeSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  if (doc.querySelector('parsererror') || doc.documentElement.nodeName !== 'svg') {
    throw new IconUploadError('SVG 文件无法解析，请换一张图片')
  }
  for (const el of doc.querySelectorAll('script, foreignObject')) el.remove()
  for (const el of doc.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      // Strip control/whitespace chars so "java\tscript:" style tricks match too.
      const value = attr.value.replace(/[\u0000-\u0020]/g, '').toLowerCase()
      if (name.startsWith('on') || (name.endsWith('href') && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name)
      }
    }
  }
  return new XMLSerializer().serializeToString(doc.documentElement)
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

// ── Raster ─────────────────────────────────────────────────────
async function rasterToDataUrl(file: File): Promise<string> {
  const img = await loadImage(file)
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, MAX_RASTER_DIMENSION)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new IconUploadError('图标处理失败，请换一张图片')
  ctx.drawImage(img, 0, 0, width, height)

  // Prefer WebP (smallest); fall back to PNG if the browser declines it.
  const webp = canvas.toDataURL('image/webp', 0.92)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new IconUploadError('无法读取图片，请换一张图片'))
    }
    img.src = url
  })
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (!w || !h) return { width: max, height: max }
  const scale = Math.min(1, max / Math.max(w, h))
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

function assertWithinSizeLimit(dataUrl: string): void {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const bytes = Math.ceil((base64.length * 3) / 4)
  if (bytes > MAX_ICON_BYTES) {
    throw new IconUploadError('图片太大了（处理后仍超过 64KB），请换一张更简单的图片')
  }
}
