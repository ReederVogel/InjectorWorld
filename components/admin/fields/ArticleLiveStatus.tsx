'use client'

/**
 * Top of the Guides / News sidebar: is this article on the site right now?
 *
 * The site shows an article when its SAVED Review Status is Approved
 * (lib/guide-queries.ts, lib/news-queries.ts). The legacy Status field does
 * not decide it, which the old screen never made clear. The link uses the
 * saved slug, so it never points at a url that does not exist yet.
 */

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import type { CSSProperties } from 'react'

type Props = { basePath: string }

export function ArticleLiveStatus({ basePath }: Props) {
  const { id } = useDocumentInfo()
  const review = useFormFields(([f]) => f.reviewStatus)
  const slug = useFormFields(([f]) => f.slug)

  const savedReview = review?.initialValue
  const savedSlug = typeof slug?.initialValue === 'string' ? slug.initialValue : ''
  const live = !!id && savedReview === 'approved' && !!savedSlug
  const pending = review?.value !== savedReview

  return (
    <div style={S.box}>
      <div style={S.row}>
        <span style={{ ...S.dot, background: live ? 'var(--theme-success-500, #2A7560)' : 'var(--theme-elevation-400)' }} />
        <strong style={S.title}>{live ? 'Live on the site' : 'Not on the site'}</strong>
      </div>
      {live ? (
        <a href={`${basePath}/${savedSlug}`} target="_blank" rel="noopener noreferrer" style={S.link}>
          View page
        </a>
      ) : (
        <span style={S.note}>Set Review Status to Approved and save to put it on the site.</span>
      )}
      {pending && <span style={S.note}>Review Status changed: it takes effect when you save.</span>}
    </div>
  )
}

const S: Record<string, CSSProperties> = {
  box: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 'var(--spacing-field, 24px)',
    padding: '10px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--theme-elevation-150)',
    borderRadius: 'var(--style-radius-m, 6px)',
    background: 'var(--theme-elevation-50)',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  title: { fontSize: 13 },
  link: { fontSize: 13, color: 'var(--theme-elevation-1000)', textDecoration: 'underline' },
  note: { fontSize: 12, color: 'var(--theme-elevation-500)' },
}
