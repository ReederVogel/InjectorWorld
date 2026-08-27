const linkStyle: React.CSSProperties = {
  display: 'block',
  margin: '8px 0',
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 6,
  textDecoration: 'none',
  color: 'var(--theme-text, #0B1B34)',
  background: 'var(--theme-elevation-50, #f7f8fa)',
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
}

/**
 * Persistent quick links added under the admin nav: jump to the live public
 * site, or to the Operations, Indexing, and Data Tools views.
 */
export function NavLinks() {
  return (
    <>
      <a href="/admin/ops" style={linkStyle}>
        Operations
      </a>
      <a href="/admin/content-indexing" style={linkStyle}>
        Content indexing
      </a>
      <a href="/admin/indexing" style={linkStyle}>
        Indexing (auto pages)
      </a>
      <a href="/admin/tools" style={linkStyle}>
        Data Tools
      </a>
      <a href="/admin/analytics" style={linkStyle}>
        Analytics
      </a>
      <a href="/admin/content-report" style={linkStyle}>
        Content Report
      </a>
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        style={linkStyle}
      >
        Open live site →
      </a>
    </>
  )
}
