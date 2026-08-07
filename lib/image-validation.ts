import 'server-only'
import sharp from 'sharp'

/**
 * Server-side image validation for user uploads.
 *
 * WHY THE DECLARED MIME TYPE IS NOT ENOUGH.
 *
 * The upload route checked `file.type` against an allowlist. `file.type` comes
 * from the multipart part's Content-Type header, which the client writes. It is
 * a claim, not a fact: any file at all can be labelled `image/jpeg`. The check
 * stopped an honest browser from sending a PDF by accident and stopped nothing
 * else.
 *
 * The bytes themselves are the fact. Every format here starts with a fixed
 * signature, so reading the first few bytes says what the file actually is.
 *
 * SVG IS DELIBERATELY ABSENT, as it was before. SVG is XML, it can carry
 * <script>, and it is served from a media domain — that combination is a stored
 * XSS delivery mechanism. Do not add it because "it is an image format".
 */

type Sniffed = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'image/avif'

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false
  return bytes.every((b, i) => buf[offset + i] === b)
}

function asciiAt(buf: Buffer, offset: number, length: number): string {
  if (buf.length < offset + length) return ''
  return buf.subarray(offset, offset + length).toString('ascii')
}

/**
 * Identifies the format from the file's leading bytes, or null when it matches
 * none of the accepted formats.
 */
export function sniffImageType(buf: Buffer): Sniffed | null {
  // JPEG: SOI marker.
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  // PNG: 8-byte signature including the CRLF/EOF trap bytes.
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  // GIF: "GIF87a" or "GIF89a".
  const gif = asciiAt(buf, 0, 6)
  if (gif === 'GIF87a' || gif === 'GIF89a') return 'image/gif'
  // WebP is a RIFF container: "RIFF" <4-byte size> "WEBP".
  if (asciiAt(buf, 0, 4) === 'RIFF' && asciiAt(buf, 8, 4) === 'WEBP') return 'image/webp'
  // AVIF is ISO-BMFF: <4-byte box size> "ftyp" <brand>.
  if (asciiAt(buf, 4, 4) === 'ftyp') {
    const brand = asciiAt(buf, 8, 4)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  return null
}

/**
 * Largest edge accepted, in pixels.
 *
 * This is a decompression-bomb guard, not a quality policy. A 50,000 x 50,000
 * PNG of one flat colour compresses to a couple of megabytes, sails past a
 * byte-size limit, and then asks the server to allocate roughly ten gigabytes
 * the moment anything decodes it. The byte cap alone cannot see that coming;
 * only the declared dimensions can.
 *
 * 12,000 is set well above any real camera or phone output (a 100MP sensor is
 * about 12,000 x 9,000) so no genuine provider photo is ever rejected. It is not
 * a number to tune downward for tidiness — the point is purely to have a ceiling.
 */
export const MAX_IMAGE_DIMENSION = 12000

export type ImageCheckResult =
  | { ok: true; mime: Sniffed; width: number; height: number }
  | { ok: false; status: number; error: string }

/**
 * Full validation: real format from the bytes, then real dimensions from the
 * header. Returns a ready-to-send status and message on failure so callers do
 * not each invent their own wording.
 *
 * `sharp` only parses metadata here; it never decodes the pixels, so this stays
 * cheap even for a file that would be expensive to render.
 */
export async function validateImageUpload(buf: Buffer): Promise<ImageCheckResult> {
  const mime = sniffImageType(buf)
  if (!mime) {
    return {
      ok: false,
      status: 415,
      error: 'That file is not a JPG, PNG, WebP, GIF, or AVIF image.',
    }
  }

  let width: number | undefined
  let height: number | undefined
  try {
    const meta = await sharp(buf, { failOn: 'none' }).metadata()
    width = meta.width
    height = meta.height
  } catch {
    // The signature said image, the parser disagreed. Treat as malformed rather
    // than letting it through on the strength of the first three bytes.
    return { ok: false, status: 415, error: 'That image could not be read.' }
  }

  if (!width || !height) {
    return { ok: false, status: 415, error: 'That image could not be read.' }
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return {
      ok: false,
      status: 413,
      error: `Image is too large (max ${MAX_IMAGE_DIMENSION}px on either side).`,
    }
  }

  return { ok: true, mime, width, height }
}
