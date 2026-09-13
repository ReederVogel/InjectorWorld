import type { CSSProperties } from 'react'

/** Shared inline styles for the FAQ admin panels. Payload theme vars so dark admin mode stays readable. */

export const panel: CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 16,
  background: 'var(--theme-elevation-50, #fff)',
}

export const label: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  opacity: 0.8,
}

export const hint: CSSProperties = { fontSize: 11.5, opacity: 0.65, marginTop: 3, lineHeight: 1.45 }

export const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 13,
  padding: '7px 9px',
  borderRadius: 8,
  border: '1px solid var(--theme-elevation-250, #cbd5e1)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0, #fff))',
  color: 'var(--theme-text, #0B1B34)',
}

export function button(kind: 'primary' | 'accent' | 'ghost' | 'danger', busy = false): CSSProperties {
  const base: CSSProperties = {
    padding: '7px 14px',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.55 : 1,
    border: '1px solid transparent',
    whiteSpace: 'nowrap',
  }
  if (kind === 'primary') return { ...base, background: '#0B1B34', color: '#fff' }
  if (kind === 'accent') return { ...base, background: '#3FA68A', color: '#fff' }
  if (kind === 'danger') return { ...base, background: 'transparent', color: '#B91C1C', borderColor: '#B91C1C66' }
  return { ...base, background: 'transparent', color: 'var(--theme-text, #0B1B34)', borderColor: 'var(--theme-elevation-250, #cbd5e1)' }
}

export const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11.5,
  padding: '2px 8px',
  borderRadius: 8,
  background: 'var(--theme-elevation-100, #eef1f5)',
  whiteSpace: 'nowrap',
}

export const th: CSSProperties = {
  textAlign: 'left',
  fontSize: 11.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  opacity: 0.6,
  padding: '6px 8px',
  borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)',
}

export const td: CSSProperties = {
  fontSize: 13,
  padding: '8px',
  borderBottom: '1px solid var(--theme-elevation-100, #eef1f5)',
  verticalAlign: 'top',
}

export async function readError(res: Response, fallback: string): Promise<string> {
  const j = await res.json().catch(() => ({}))
  return (j && (j.error as string)) || `${fallback} (${res.status})`
}
