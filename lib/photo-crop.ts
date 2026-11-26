/**
 * Browser-only helpers for the owner photo cropper (components/dashboard/PhotoCropper.tsx).
 * The server re-encodes whatever arrives to a 1600x900 WebP (lib/image-validation.ts
 * encodeClinicPhoto), so this side only has to get the framing right.
 */

export const CROP_ASPECT = 16 / 9
export const OUT_WIDTH = 1600
// Any photo: the cropper opens what the browser can show (plus HEIC via heic-to) and the server re-encodes to WebP.
export const PHOTO_ACCEPT = 'image/*,.heic,.heif'
/** Original file size the browser will open; only the cropped JPEG is sent. */
export const MAX_PICK_BYTES = 50 * 1024 * 1024
/** Longest edge kept in the browser: iPhones refuse canvases past ~16.7 MP (4096 x 4096). */
const WORK_EDGE = 4000

export const UNREADABLE = 'This file could not be opened as a photo. Use a JPG, PNG, WebP or iPhone (HEIC) photo.'
export const HEIC_FAILED = 'This iPhone photo could not be converted. Save it as JPG and try again.'

const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']

/** HEIC/HEIF by name, type or the file's own ftyp box (Windows often gives a .heic file no type). */
export async function looksHeic(file: Blob & { name?: string }): Promise<boolean> {
  if (/\.(heic|heif)$/i.test(file.name ?? '') || /^image\/hei[cf]/.test(file.type)) return true
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to))
  return ascii(4, 8) === 'ftyp' && HEIF_BRANDS.includes(ascii(8, 12))
}

/** Decodes a photo the way <img> shows it, EXIF orientation applied. */
export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(UNREADABLE))
    }
    img.src = url
  })
}

/**
 * Opens any photo the browser can show. A HEIC it cannot (Chrome, Firefox) goes
 * through heic-to, loaded only then; its csp build needs no eval or WebAssembly.
 */
export async function openPhoto(file: File, onConvert: () => void): Promise<HTMLImageElement> {
  try {
    return await loadImage(file)
  } catch {
    if (!(await looksHeic(file))) throw new Error(UNREADABLE)
  }
  onConvert()
  try {
    const { heicTo } = await import('heic-to/csp')
    return await loadImage(await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 }))
  } catch {
    throw new Error(HEIC_FAILED)
  }
}

/** The photo upright, at most WORK_EDGE on its long side, turned `quarterTurns` x 90 degrees clockwise. */
export function workCanvas(img: HTMLImageElement, quarterTurns: number): HTMLCanvasElement {
  const scale = Math.min(1, WORK_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const turns = ((quarterTurns % 4) + 4) % 4
  const canvas = document.createElement('canvas')
  canvas.width = turns % 2 ? h : w
  canvas.height = turns % 2 ? w : h
  const ctx = canvas.getContext('2d')!
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return canvas
}

export type Area = { x: number; y: number; width: number; height: number }

/** The chosen area as a JPEG in the frame's shape (16:9 unless told), at most OUT_WIDTH wide. Transparency becomes white. */
export function cropToBlob(source: HTMLCanvasElement, area: Area, aspect = CROP_ASPECT): Promise<Blob> {
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.min(OUT_WIDTH, Math.round(area.width)))
  out.height = Math.round(out.width / aspect)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, area.x, area.y, area.width, area.height, 0, 0, out.width, out.height)
  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare this photo. Try another one.'))), 'image/jpeg', 0.92),
  )
}
