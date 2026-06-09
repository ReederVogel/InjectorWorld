/**
 * Compact brand mark for the collapsed nav / small header slot.
 */
export function Icon() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--theme-text, #0B1B34)',
      }}
    >
      <span>i</span>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: '#3FA68A', display: 'inline-block' }} />
      <span>w</span>
    </div>
  )
}
