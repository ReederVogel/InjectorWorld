/**
 * Brand wordmark shown on the admin login screen and nav header.
 * Uses Payload theme text color so it flips in light/dark; mint dot is the
 * one brand accent. No external font dependency (admin runs its own font).
 */
export function Logo() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        fontSize: 30,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        color: 'var(--theme-text, #0B1B34)',
      }}
    >
      <span>injectors</span>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: '#3FA68A', display: 'inline-block' }} />
      <span>world</span>
    </div>
  )
}
