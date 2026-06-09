/**
 * Persistent quick link added under the admin nav. Lets an operator jump to the
 * live public site from any admin screen.
 */
export function NavLinks() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      style={{
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
      }}
    >
      Open live site →
    </a>
  )
}
