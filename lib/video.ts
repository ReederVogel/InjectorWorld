/**
 * Clinic video links (clinics.videoUrl). Only YouTube and Vimeo, turned into a
 * privacy-friendly embed: youtube-nocookie.com, Vimeo with dnt=1. The clinic page
 * loads nothing from either until the visitor presses play. Client-safe.
 */

export type ClinicVideo = {
  provider: 'youtube' | 'vimeo'
  id: string
  embedUrl: string
  /** YouTube only; Vimeo needs an API call for one, so its player shows a plain frame. */
  thumbnailUrl?: string
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

export function parseVideoUrl(raw: string | null | undefined): ClinicVideo | null {
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')

  let id: string | null = null
  if (host === 'youtu.be') id = u.pathname.split('/')[1] || null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null)
  }
  if (id && YOUTUBE_ID.test(id)) {
    return {
      provider: 'youtube',
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    }
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // vimeo.com/123, /channels/x/123, /groups/x/videos/123, /123/<unlisted hash>, player.vimeo.com/video/123?h=<hash>
    const m = u.pathname.match(/^\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?\/?$/i)
    if (m) {
      const params = new URLSearchParams({ autoplay: '1', dnt: '1' })
      const hash = m[2] || u.searchParams.get('h')
      if (hash && /^[0-9a-f]{6,20}$/i.test(hash)) params.set('h', hash)
      return { provider: 'vimeo', id: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}?${params}` }
    }
  }
  return null
}

export const VIDEO_URL_ERROR = 'Use a YouTube or Vimeo video link.'
