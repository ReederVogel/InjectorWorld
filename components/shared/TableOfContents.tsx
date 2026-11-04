import type { HeadingItem } from '@/lib/render-lexical'

/**
 * "On this page" jump-link list. Replaces the "About this
 * guide/article" + disclaimer cards on the guide/news detail pages
 * (2026-09-03, founder request). Ids come from extractHeadings(), which must
 * stay in sync with the ids renderNode() stamps on the actual headings in
 * RenderLexical -- both derive from slugifyHeadingText().
 *
 * Two copies per page: the sidebar one (lg+ only) and a collapsible one above
 * the body (below lg). Below lg the sidebar stacks under the whole article,
 * where jump links are useless (2026-11-05).
 */
export function TableOfContents({
  headings,
  collapsible = false,
}: {
  headings: HeadingItem[]
  collapsible?: boolean
}) {
  if (!headings || headings.length === 0) return null

  const links = (
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
  )

  if (collapsible) {
    return (
      <details className="group mb-8 rounded-control border border-border bg-surface lg:hidden">
        <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none">
          <h2 className="text-h4 text-ink-primary">On this page</h2>
          <svg
            className="flex-shrink-0 w-5 h-5 text-ink-tertiary group-open:rotate-180 transition-transform duration-200"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="px-5 pb-5 pt-4 border-t border-border-subtle">{links}</div>
      </details>
    )
  }

  return (
    <div className="hidden lg:block rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-h4 text-ink-primary mb-3">On this page</h2>
      {links}
    </div>
  )
}
