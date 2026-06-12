'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { NewsCard } from '@/lib/news-queries'

const TABS = [
  { label: 'All', value: 'all' },
  { label: 'Treatment Update', value: 'treatment-update' },
  { label: 'Industry', value: 'industry' },
  { label: 'Company', value: 'company' },
  { label: 'Announcement', value: 'announcement' },
  { label: 'Product Launch', value: 'product-launch' },
  { label: 'Research', value: 'research' },
  { label: 'Regulation', value: 'regulation' },
]

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  TABS.filter((t) => t.value !== 'all').map((t) => [t.value, t.label]),
)

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function NewsCardUI({ article }: { article: NewsCard }) {
  return (
    <Link
      href={`/news/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:shadow-hover transition-shadow"
    >
      {article.coverImageUrl ? (
        <div className="relative w-full aspect-[16/9] overflow-hidden bg-surface-warm">
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            fill
            sizes="(min-width:1024px) 350px, (min-width:640px) 50vw, 100vw"
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="w-full aspect-[16/9] bg-surface-warm flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-ink-tertiary"
          >
            <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8L2 8v12a2 2 0 002 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
      )}

      <div className="flex-1 p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-pill bg-brand-accent-soft text-brand-accent">
            {CATEGORY_LABELS[article.category] ?? article.category}
          </span>
          {article.publishedAt && (
            <span className="text-caption text-ink-tertiary">{formatDate(article.publishedAt)}</span>
          )}
        </div>

        <h2 className="font-serif text-h3 font-medium leading-snug tracking-tight text-ink-primary mb-2 group-hover:text-brand-accent transition-colors line-clamp-3">
          {article.title}
        </h2>

        <p className="text-body-sm text-ink-secondary leading-relaxed line-clamp-2 flex-1">
          {article.excerpt}
        </p>

        <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-3">
          {article.author.photoUrl && (
            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-surface-warm flex-shrink-0">
              <Image
                src={article.author.photoUrl}
                alt={article.author.fullName}
                fill
                sizes="28px"
                className="object-cover"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-caption text-ink-secondary font-medium">
              {article.author.fullName}
            </span>
            {article.medicalReviewer && (
              <span className="block text-[11px] text-ink-tertiary">
                Reviewed by {article.medicalReviewer.fullName},{' '}
                {article.medicalReviewer.credentials}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

export function NewsGrid({ articles }: { articles: NewsCard[] }) {
  const [activeTab, setActiveTab] = useState('all')

  const filtered = useMemo(
    () => (activeTab === 'all' ? articles : articles.filter((a) => a.category === activeTab)),
    [articles, activeTab],
  )

  const countFor = (cat: string) =>
    cat === 'all' ? articles.length : articles.filter((a) => a.category === cat).length

  const visibleTabs = TABS.filter((t) => t.value === 'all' || countFor(t.value) > 0)

  return (
    <>
      {/* Sticky filter tabs */}
      <div className="sticky top-[65px] z-20 bg-surface-canvas border-b border-border">
        <div className="max-canvas">
          <div className="flex items-center gap-1.5 overflow-x-auto py-3 scrollbar-none">
            {visibleTabs.map((tab) => {
              const count = countFor(tab.value)
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex-shrink-0 px-4 py-2 rounded-pill text-body-sm font-medium transition ${
                    activeTab === tab.value
                      ? 'bg-brand-primary text-surface-canvas'
                      : 'bg-surface text-ink-secondary hover:bg-surface-warm hover:text-ink-primary border border-border'
                  }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 text-[11px] ${
                        activeTab === tab.value ? 'text-surface-canvas/70' : 'text-ink-tertiary'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Grid */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-body text-ink-secondary">No articles in this category yet.</p>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className="mt-3 text-brand-accent text-body-sm hover:underline"
              >
                View all news
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((article) => (
                <NewsCardUI key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
