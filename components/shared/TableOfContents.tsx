import type { HeadingItem } from '@/lib/render-lexical'

/**
 * Sidebar "On this page" jump-link list. Replaces the "About this
 * guide/article" + disclaimer cards on the guide/news detail pages
 * (2026-09-03, founder request). Ids come from extractHeadings(), which must
 * stay in sync with the ids renderNode() stamps on the actual headings in
 * RenderLexical -- both derive from slugifyHeadingText().
 */
export function TableOfContents({ headings }: { headings: HeadingItem[] }) {
  if (!headings || headings.length === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="text-h4 text-ink-primary mb-3">On this page</h3>
      <nav className="space-y-2.5">
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={`block text-body-sm leading-snug hover:text-brand-accent transition ${
              h.level === 3 ? 'pl-4 text-ink-tertiary' : 'text-ink-secondary font-medium'
            }`}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </div>
  )
}
