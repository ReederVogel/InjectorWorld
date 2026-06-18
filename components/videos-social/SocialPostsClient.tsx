'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { SocialPost } from '@/lib/social-posts-data'

type Filter = 'all' | SocialPost['platform']

const PLATFORM_COLOR: Record<SocialPost['platform'], string> = {
  x: '#000000',
  facebook: '#1877F2',
  instagram: '#E1306C',
  reddit: '#FF4500',
  google: '#4285F4',
}

const PLATFORM_LABEL: Record<SocialPost['platform'], string> = {
  x: '',
  facebook: 'Facebook',
  instagram: 'Instagram',
  reddit: 'Reddit',
  google: 'Google',
}

function fmtCount(n: number): string {
  if (n <= 0) return ''
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function PlatformIcon({ platform }: { platform: SocialPost['platform'] }) {
  switch (platform) {
    case 'x':
      return (
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )
    case 'facebook':
      return (
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'reddit':
      return (
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
        </svg>
      )
    case 'google':
      return (
        <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
        </svg>
      )
  }
}

function EngagementIcon({ platform }: { platform: SocialPost['platform'] }) {
  if (platform === 'reddit') {
    return (
      <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 14h4v7h8v-7h4l-8-8z" />
      </svg>
    )
  }
  if (platform === 'facebook') {
    return (
      <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
      </svg>
    )
  }
  // Heart for X, Instagram
  return (
    <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
    </svg>
  )
}

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} aria-hidden width={size} height={size} viewBox="0 0 24 24" fill={i < rating ? '#FBBC04' : '#E2E8F0'}>
          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
      ))}
    </div>
  )
}

function FeaturedCard({ post }: { post: SocialPost }) {
  const pColor = PLATFORM_COLOR[post.platform]
  const count = fmtCount(post.likes)

  return (
    <Link
      href={post.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-surface-canvas border border-border rounded-2xl p-7 md:p-8 hover:shadow-hover hover:-translate-y-0.5 transition-all duration-300"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[11px] font-semibold tracking-wide text-white"
          style={{ backgroundColor: pColor }}
        >
          <PlatformIcon platform={post.platform} />
          {PLATFORM_LABEL[post.platform]}
        </span>
        <span className="text-caption text-ink-tertiary">{post.date}</span>
      </div>

      {/* Decorative opening quote */}
      <div
        aria-hidden
        className="font-serif text-[72px] leading-[0.75] text-brand-accent/25 mb-1 select-none"
      >
        &ldquo;
      </div>

      {/* Quote text */}
      <p className="font-serif text-[19px] md:text-[21px] leading-[1.55] text-ink-primary mb-7">
        {post.quote}
      </p>

      {/* Divider */}
      <div className="h-px bg-border-default mb-5" />

      {/* Author + engagement */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Image
            src={post.author.avatarUrl}
            alt={post.author.name}
            width={36}
            height={36}
            className="rounded-full object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="text-body-sm font-semibold text-ink-primary leading-tight truncate">
              {post.author.name}
            </div>
            <div className="text-caption text-ink-tertiary truncate">{post.author.handle}</div>
          </div>
        </div>

        {post.platform === 'google' && post.rating ? (
          <StarRating rating={post.rating} size={13} />
        ) : count ? (
          <div className="flex items-center gap-1.5 text-ink-tertiary flex-shrink-0">
            <EngagementIcon platform={post.platform} />
            <span className="text-caption font-semibold">{count}</span>
          </div>
        ) : null}
      </div>
    </Link>
  )
}

function PostCard({ post }: { post: SocialPost }) {
  const pColor = PLATFORM_COLOR[post.platform]
  const count = fmtCount(post.likes)

  return (
    <Link
      href={post.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-surface-canvas border border-border rounded-xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
      style={{ borderLeft: `3px solid ${pColor}` }}
    >
      {/* Author row */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <Image
            src={post.author.avatarUrl}
            alt={post.author.name}
            width={28}
            height={28}
            className="rounded-full object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-ink-primary leading-tight truncate">
              {post.author.name}
            </div>
            <div className="text-[11px] text-ink-tertiary leading-tight truncate">
              {post.author.handle}
            </div>
          </div>
        </div>
        <span style={{ color: pColor }} className="flex-shrink-0">
          <PlatformIcon platform={post.platform} />
        </span>
      </div>

      {/* Quote */}
      <p className="text-[14px] leading-[1.65] text-ink-primary line-clamp-4 mb-4">
        &ldquo;{post.quote}&rdquo;
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {post.platform === 'google' && post.rating ? (
          <StarRating rating={post.rating} size={11} />
        ) : count ? (
          <div className="flex items-center gap-1 text-ink-tertiary">
            <EngagementIcon platform={post.platform} />
            <span className="text-[11px] font-semibold">{count}</span>
          </div>
        ) : (
          <div />
        )}
        <span className="text-[11px] text-ink-tertiary">{post.date}</span>
      </div>
    </Link>
  )
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'x', label: 'X' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'google', label: 'Google' },
]

export function SocialPostsClient({ posts = [] }: { posts?: SocialPost[] }) {
  const [activeFilter, setActiveFilter] = useState<Filter>('all')

  const featured = posts.filter((p) => p.featured)
  const regular = posts.filter(
    (p) => !p.featured && (activeFilter === 'all' || p.platform === activeFilter)
  )

  const availablePlatforms = new Set(posts.filter((p) => !p.featured).map((p) => p.platform))
  const visibleFilters = FILTERS.filter(
    (f) => f.id === 'all' || availablePlatforms.has(f.id as SocialPost['platform'])
  )

  return (
    <div>
      {/* Featured pull-quote cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10 md:mb-12">
        {featured.map((p) => (
          <FeaturedCard key={p.id} post={p} />
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {visibleFilters.map((f) => {
          const isActive = activeFilter === f.id
          const platformColor =
            f.id !== 'all' ? PLATFORM_COLOR[f.id as SocialPost['platform']] : undefined
          return (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill text-[13px] font-medium transition-all ${
                isActive
                  ? 'bg-ink-primary text-white shadow-sm'
                  : 'bg-surface border border-border text-ink-secondary hover:border-ink-primary/40 hover:text-ink-primary'
              }`}
            >
              {f.id !== 'all' && (
                <span style={{ color: isActive ? 'white' : platformColor }}>
                  <PlatformIcon platform={f.id as SocialPost['platform']} />
                </span>
              )}
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Regular grid */}
      {regular.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regular.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-ink-tertiary text-body-sm">
          No posts for this platform yet.
        </div>
      )}

      {/* See all */}
      <div className="mt-8">
        <Link
          href="/social"
          className="group inline-flex items-center gap-2 text-body-sm font-medium text-brand-accent hover:underline"
        >
          See all posts
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="group-hover:translate-x-0.5 transition"
            aria-hidden
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
      </div>
    </div>
  )
}
