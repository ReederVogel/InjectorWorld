/**
 * Extracts a playable video ID from a YouTube URL, or null if the URL points at
 * a channel/handle page rather than a specific video. Channel pages cannot be
 * embedded: youtube.com sends X-Frame-Options on them, and the old
 * uploads-playlist embed trick YouTube used to support for that is gone.
 *
 * Handles youtu.be/ID, watch?v=ID, /embed/ID, /shorts/ID and /live/ID.
 * /channel/…, /@handle, /c/… and /user/… fall through to null on purpose.
 */
export function getYouTubeEmbedId(url?: string): string | null {
  if (!url) return null

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.hostname !== 'youtu.be' && !/(^|\.)youtube\.com$/.test(parsed.hostname)) return null

  if (parsed.hostname === 'youtu.be') {
    return parsed.pathname.split('/').filter(Boolean)[0] || null
  }

  const fromQuery = parsed.searchParams.get('v')
  if (fromQuery) return fromQuery

  const [kind, id] = parsed.pathname.split('/').filter(Boolean)
  if ((kind === 'embed' || kind === 'shorts' || kind === 'live') && id) return id

  return null
}
