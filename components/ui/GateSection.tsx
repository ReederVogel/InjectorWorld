'use client'

import Link from 'next/link'

const FREE_COUNT = 6

/**
 * SEO-safe partial gate for listing pages.
 *
 * Items 1-FREE_COUNT always render in the DOM (server-rendered, indexable).
 * Items FREE_COUNT+ are rendered inside a blurred div that Googlebot reads
 * normally, but anonymous visitors see only blurred silhouettes + a sign-in
 * prompt. The blur is applied client-side only — SSR output is unblurred.
 *
 * Usage:
 *   const locked = ready && !loggedIn && total > FREE_COUNT
 *   <GateSection locked={locked} total={total} label="injectors" previewItems={...} />
 */
export { FREE_COUNT }

export function GateSection({
  locked,
  total,
  label = 'results',
  previewItems,
}: {
  locked: boolean
  total: number
  label?: string
  previewItems: React.ReactNode
}) {
  if (!locked) return null

  return (
    <div className="relative mt-5 rounded-2xl overflow-hidden border border-border">
      {/* Blurred ghost row — in DOM so Googlebot indexes content */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 p-1"
        style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}
        aria-hidden="true"
      >
        {previewItems}
      </div>

      {/* Sign-in overlay */}
      <div className="absolute inset-0 bg-surface-canvas/65 flex items-center justify-center p-6">
        <div className="bg-surface-canvas border border-border rounded-2xl shadow-lg px-7 py-6 text-center max-w-sm w-full">
          <div className="w-12 h-12 rounded-full bg-brand-accent-soft flex items-center justify-center mx-auto mb-4">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgb(var(--brand-accent))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <p className="font-semibold text-ink-primary text-body mb-1">
            See all {total} {label}
          </p>
          <p className="text-body-sm text-ink-secondary mb-5 leading-snug">
            Create a free account to view the full list, save favorites, and track your consults.
          </p>

          <Link
            href="/signup"
            className="block w-full bg-brand-primary text-surface-canvas rounded-pill py-3 text-body-sm font-semibold hover:opacity-90 transition mb-3"
          >
            Create free account
          </Link>
          <Link
            href="/login"
            className="text-body-sm text-ink-secondary hover:text-ink-primary transition"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
