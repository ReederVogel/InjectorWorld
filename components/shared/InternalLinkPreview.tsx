import Link from 'next/link'

/**
 * Wikipedia/Notion-style hover card for an inline internal link. Pure CSS
 * hover (group-hover) so it needs no client JS -- renders fine from a server
 * component tree like RenderLexical.
 */
export function InternalLinkPreview({
  href,
  title,
  excerpt,
  typeLabel,
  children,
}: {
  href: string
  title: string
  excerpt?: string
  typeLabel?: string
  children: React.ReactNode
}) {
  return (
    <span className="relative inline-block group/linkpreview">
      <Link
        href={href}
        className="text-brand-accent font-medium underline decoration-brand-accent/40 underline-offset-2 hover:decoration-brand-accent"
      >
        {children}
      </Link>
      <span className="pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 w-64 -translate-x-1/2 translate-y-1 opacity-0 transition-all duration-150 group-hover/linkpreview:pointer-events-auto group-hover/linkpreview:translate-y-0 group-hover/linkpreview:opacity-100">
        <span className="block rounded-lg border border-border bg-surface-canvas p-3 text-left shadow-lg">
          {typeLabel && (
            <span className="mb-1 block text-overline text-ink-tertiary">{typeLabel}</span>
          )}
          <span className="block text-body-sm font-semibold leading-snug text-ink-primary">{title}</span>
          {excerpt && (
            <span className="mt-1 block line-clamp-3 text-caption leading-snug text-ink-secondary">
              {excerpt}
            </span>
          )}
        </span>
        <span className="absolute left-1/2 top-full -mt-1 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-surface-canvas" />
      </span>
    </span>
  )
}
