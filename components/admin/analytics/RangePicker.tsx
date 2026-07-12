'use client'

import type { RangeDays } from './types'

const OPTIONS: RangeDays[] = [7, 30, 90]

export function RangePicker({ value, onChange }: { value: RangeDays; onChange: (v: RangeDays) => void }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, marginBottom: 16 }}>
      {OPTIONS.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '6px 14px',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 999,
              cursor: 'pointer',
              border: `1px solid ${active ? '#0B1B34' : 'var(--theme-elevation-150, #e2e8f0)'}`,
              background: active ? '#0B1B34' : 'var(--theme-elevation-50, #fff)',
              color: active ? '#fff' : 'var(--theme-text, #0B1B34)',
            }}
          >
            {opt}d
          </button>
        )
      })}
    </div>
  )
}
