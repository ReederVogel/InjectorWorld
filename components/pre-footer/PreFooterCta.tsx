"use client"

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const imageData = [
  { id: 1,  src: 'https://picsum.photos/seed/iw-f1/400/400' },
  { id: 2,  src: 'https://picsum.photos/seed/iw-c1/400/400' },
  { id: 3,  src: 'https://picsum.photos/seed/iw-s1/400/400' },
  { id: 4,  src: 'https://picsum.photos/seed/iw-b1/400/400' },
  { id: 5,  src: 'https://picsum.photos/seed/iw-m1/400/400' },
  { id: 6,  src: 'https://picsum.photos/seed/iw-f2/400/400' },
  { id: 7,  src: 'https://picsum.photos/seed/iw-p1/400/400' },
  { id: 8,  src: 'https://picsum.photos/seed/iw-s2/400/400' },
  { id: 9,  src: 'https://picsum.photos/seed/iw-c2/400/400' },
  { id: 10, src: 'https://picsum.photos/seed/iw-f3/400/400' },
  { id: 11, src: 'https://picsum.photos/seed/iw-b2/400/400' },
  { id: 12, src: 'https://picsum.photos/seed/iw-m2/400/400' },
  { id: 13, src: 'https://picsum.photos/seed/iw-s3/400/400' },
  { id: 14, src: 'https://picsum.photos/seed/iw-p2/400/400' },
  { id: 15, src: 'https://picsum.photos/seed/iw-f4/400/400' },
  { id: 16, src: 'https://picsum.photos/seed/iw-c3/400/400' },
]

export function PreFooterCta() {
  const [tiles, setTiles] = useState(imageData)

  const shuffleTiles = useCallback(() => {
    setTiles(prev => shuffle(prev))
  }, [])

  useEffect(() => {
    const id = setInterval(shuffleTiles, 3000)
    return () => clearInterval(id)
  }, [shuffleTiles])

  return (
    <section className="bg-[#0B1B34] relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 mesh-dark pointer-events-none" />
      <div aria-hidden className="absolute inset-0 dot-grid opacity-30 pointer-events-none" />

      <div className="max-w-canvas mx-auto px-5 md:px-10 py-24 md:py-32 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-16 lg:gap-20">

          {/* Left: text + CTA */}
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-pill bg-white/5 border border-white/15">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#3FA68A] opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3FA68A]" />
              </span>
              <span className="overline text-[#3FA68A]">Ready when you are</span>
            </div>

            <h2 className="headline-display text-h2-m md:text-h1 text-white mb-6 text-balance">
              Find a verified injector in your city.
            </h2>

            <p className="font-serif text-lede-m text-white/70 leading-[1.45] mb-10 text-balance max-w-[460px]">
              License-verified providers in 200+ US cities. Just expert-vetted injectors near you.
            </p>

            <Link
              href="/botox/new-york-ny"
              className="group inline-flex items-center gap-3 bg-[#3FA68A] text-white rounded-pill px-8 py-4 text-body font-semibold hover:bg-[#338F76] hover:scale-[1.02] transition-all duration-300 shadow-[0_12px_40px_rgba(63,166,138,0.35)]"
            >
              Find an injector near you
              <span className="inline-flex w-7 h-7 rounded-pill bg-white/20 items-center justify-center transition-transform duration-300 group-hover:translate-x-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </Link>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10 text-caption text-white/55 uppercase tracking-wider font-semibold">
              <span className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#3FA68A]" />
                12,400+ verified injectors
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#3FA68A]" />
                Rankings aren&apos;t for sale
              </span>
              <span className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#3FA68A]" />
                4 years independent
              </span>
            </div>
          </div>

          {/* Right: shuffle grid — desktop only */}
          <div className="hidden lg:grid grid-cols-4 grid-rows-4 gap-1.5 h-[460px]">
            {tiles.map((tile) => (
              <motion.div
                key={tile.id}
                layout
                transition={{ duration: 1.5, type: 'spring' }}
                className="w-full h-full rounded-md overflow-hidden bg-white/5"
                style={{
                  backgroundImage: `url(${tile.src})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
