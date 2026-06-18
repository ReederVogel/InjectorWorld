'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRef } from 'react'
import type { VideoTile } from '@/lib/videos-data'
import { CarouselDots } from '@/components/ui/CarouselDots'

const platformBadge: Record<string, { label: string; bg: string }> = {
  instagram: { label: 'IG', bg: 'linear-gradient(135deg,#f09433,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888)' },
  tiktok: { label: 'TT', bg: '#000' },
  youtube: { label: 'YT', bg: '#FF0000' },
}

export function VideoGrid({ videos }: { videos: VideoTile[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <>
      <div
        ref={scrollRef}
        className="flex md:grid md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-5 md:mx-0 px-5 md:px-0 pb-2"
      >
        {videos.map((v) => {
          const badge = platformBadge[v.platform]
          return (
            <Link
              key={v.id}
              href={v.href}
              className="group relative flex-shrink-0 w-[200px] md:w-auto snap-start block aspect-[9/16] rounded-2xl overflow-hidden bg-surface card-premium"
            >
              <Image
                src={v.thumbnailUrl}
                alt={v.caption}
                fill
                sizes="(min-width:1024px) 22vw, 200px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />
              <span
                className="absolute top-3 left-3 inline-flex items-center justify-center w-7 h-7 rounded-pill text-[10px] font-bold text-white shadow-md"
                style={{ background: badge.bg }}
              >
                {badge.label}
              </span>
              <span className="absolute top-3 right-3 text-[10px] font-semibold tracking-wider uppercase bg-black/55 text-white px-2 py-1 rounded-pill">
                {v.duration}
              </span>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-14 h-14 rounded-pill bg-white/15 backdrop-blur-md flex items-center justify-center transition group-hover:bg-[#3FA68A] group-hover:scale-110">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="ml-1">
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="text-white text-body-sm font-semibold leading-tight line-clamp-2 mb-1">{v.caption}</div>
                <div className="text-white/75 text-caption truncate">{v.creator}</div>
              </div>
            </Link>
          )
        })}
      </div>
      <CarouselDots scrollRef={scrollRef} count={videos.length} />
    </>
  )
}
