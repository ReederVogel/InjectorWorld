import type { CSSProperties } from 'react'

export const box: CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  background: 'var(--theme-elevation-50, #fff)',
}

export const navCard: CSSProperties = {
  flex: '1 1 180px',
  textDecoration: 'none',
  color: 'var(--theme-text, #0B1B34)',
  padding: '14px 16px',
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  background: 'var(--theme-elevation-50, #fff)',
  fontSize: 13,
  fontWeight: 600,
}
