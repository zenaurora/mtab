const MIN_MEANINGFUL_ICON_SIZE = 8
const BRIGHT_PIXEL_THRESHOLD = 245
const SATURATION_THRESHOLD = 18
const BRIGHT_OR_TRANSPARENT_RATIO = 0.9

function sampleStep(length: number) {
  return Math.max(1, Math.floor(length / 256))
}

export function shouldRejectLoadedFavicon(img: HTMLImageElement): boolean {
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height

  if (!width || !height) return true
  if (Math.max(width, height) < MIN_MEANINGFUL_ICON_SIZE) return true

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  try {
    ctx.drawImage(img, 0, 0, width, height)
    const { data } = ctx.getImageData(0, 0, width, height)
    const step = sampleStep(width * height)
    let sampled = 0
    let brightOrTransparent = 0
    let saturated = 0

    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      sampled += 1

      if (a < 24) {
        brightOrTransparent += 1
        continue
      }

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max >= BRIGHT_PIXEL_THRESHOLD && min >= BRIGHT_PIXEL_THRESHOLD) {
        brightOrTransparent += 1
      }
      if (max - min >= SATURATION_THRESHOLD) saturated += 1
    }

    if (!sampled) return true

    const blankRatio = brightOrTransparent / sampled
    const saturationRatio = saturated / sampled

    return blankRatio >= BRIGHT_OR_TRANSPARENT_RATIO && saturationRatio < 0.12
  } catch {
    // Cross-origin canvas reads can fail; in that case we keep the image.
    return false
  }
}
