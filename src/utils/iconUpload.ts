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
  'image/gif',
])

/** `accept` attribute for the upload <input type="file">. */
export const ICON_ACCEPT_ATTR =
  '.svg,.png,.jpg,.jpeg,.webp,.gif,image/svg+xml,image/png,image/jpeg,image/webp,image/gif'

/** Raster icons are downscaled to fit within this many pixels on the long edge. */
const MAX_RASTER_DIMENSION = 256

/** Hard cap on the encoded icon, protecting storage + export size. */
const MAX_ICON_BYTES = 256 * 1024

const EXTENSION_MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function fileToIconDataUrl(file: File): Promise<string> {
  const type = file.type || inferMimeFromName(file.name)
  if (!ACCEPTED_MIME.has(type)) {
    throw new IconUploadError('不支持的图片格式，请上传 SVG / PNG / JPG / WebP / GIF')
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
// Rendered via <img>, which already blocks scripting; stripping obvious
// vectors here is defense-in-depth, not the primary safeguard.
async function svgToDataUrl(file: File): Promise<string> {
  const clean = sanitizeSvg(await file.text())
  return `data:image/svg+xml;base64,${utf8ToBase64(clean)}`
}

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(href|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '')
}

function utf8ToBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
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
    throw new IconUploadError('图片太大了（压缩后仍超过 256KB），请换一张更简单的图片')
  }
}
