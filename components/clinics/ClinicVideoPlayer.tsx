'use client'

import { useState } from 'react'
import type { ClinicVideo } from '@/lib/video'

/**
 * Click-to-play clinic video. Until the visitor presses play the page loads only
 * the YouTube thumbnail (nothing at all for Vimeo), so it costs no player script
 * and sets no third-party cookies. The embed is youtube-nocookie / Vimeo dnt=1.
 * Needs frame-src (and i.ytimg.com in img-src) in next.config.mjs.
 */
export function ClinicVideoPlayer({ video, clinicName }: { video: ClinicVideo; clinicName: string }) {
  const [playing, setPlaying] = useState(false)
  const provider = video.provider === 'youtube' ? 'YouTube' : 'Vimeo'
  return (
    <section>
      <h2 className="mb-5 font-serif text-h3 text-ink-primary">Video</h2>
      {/* Always-dark frame, like a player. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-control bg-[#0B1B34]">
        {playing ? (
          <iframe
            src={video.embedUrl}
            title={`Video from ${clinicName}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play the video from ${clinicName}`}
            className="group absolute inset-0 flex items-center justify-center"
          >
            {video.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white transition group-hover:bg-black/75">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
            </span>
          </button>
        )}
      </div>
      <p className="mt-2 text-caption text-ink-tertiary">Plays from {provider}. Nothing loads from {provider} until you press play.</p>
    </section>
  )
}
