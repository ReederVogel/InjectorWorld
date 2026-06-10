'use client'

import { useEffect, useState } from 'react'

type Clinic = { id: number; clinicId: string; clinicName: string; city: string; state: string; brandId: number | null }
type Suggestion = {
  groupId: string
  signals: string[]
  alertKeys: string[]
  suggestedBrandName: string
  clinics: Clinic[]
}
type Brand = { id: number; name: string; slug: string }

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  background: 'var(--theme-elevation-50, #fff)',
}

function btn(busy: boolean, bg = '#0B1B34', disabled = false): React.CSSProperties {
  const off = busy || disabled
  return {
    padding: '8px 16px', borderRadius: 999, border: 'none', cursor: off ? 'default' : 'pointer',
    background: bg, color: '#fff', fontSize: 13, fontWeight: 600, opacity: off ? 0.55 : 1,
  }
}

/**
 * Admin branch-confirm tool. Lists clinics that share a brand prefix + phone or a
 * website across distinct locations (likely branches), and lets an operator link
 * them under one Brand or dismiss them. Never merges clinic records.
 */
export function BranchSuggestions({ onAfterChange }: { onAfterChange?: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [brands, setBrands] = useState<Brand[]>([])
  const [busy, setBusy] = useState<string>('')
  const [msg, setMsg] = useState<string>('')
  const [nameByGroup, setNameByGroup] = useState<Record<string, string>>({})
  const [brandByGroup, setBrandByGroup] = useState<Record<string, string>>({})

  async function load() {
    try {
      const res = await fetch('/api/admin/branches', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setSuggestions([]); return }
      setSuggestions(json.suggestions ?? [])
      setBrands(json.brands ?? [])
      const names: Record<string, string> = {}
      for (const s of json.suggestions ?? []) names[s.groupId] = s.suggestedBrandName
      setNameByGroup(names)
    } catch {
      setSuggestions([])
    }
  }
  useEffect(() => { load() }, [])

  async function act(s: Suggestion, action: 'link' | 'dismiss') {
    setBusy(s.groupId + action); setMsg('')
    try {
      const existingBrandId = brandByGroup[s.groupId]
      const payload: any = {
        action,
        clinicIds: s.clinics.map((c) => c.id),
        alertKeys: s.alertKeys,
      }
      if (action === 'link') {
        if (existingBrandId) payload.brandId = parseInt(existingBrandId, 10)
        else payload.brandName = (nameByGroup[s.groupId] || s.suggestedBrandName).trim()
      }
      const res = await fetch('/api/admin/branches', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Action failed.'); return }
      if (action === 'link') setMsg(`Linked ${json.linked} location${json.linked === 1 ? '' : 's'} under "${json.brandName}".`)
      else setMsg('Dismissed: marked as not a branch.')
      await load()
      onAfterChange?.()
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy('')
    }
  }

  if (suggestions === null) {
    return (
      <div style={{ ...box, borderLeft: '4px solid #C2A14E' }}>
        <strong style={{ fontSize: 15 }}>Branch suggestions</strong>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ ...box, borderLeft: `4px solid ${suggestions.length ? '#C2A14E' : '#3FA68A'}` }}>
      <strong style={{ fontSize: 15 }}>Branch suggestions</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Clinics that look like branches of one brand (same name and phone or website, different
        locations). Linking groups them under a brand hub. Records are never merged. Two same-named
        clinics in different cities are not always the same business, so confirm before linking.
      </div>

      {suggestions.length === 0 ? (
        <div style={{ fontSize: 13 }}>No pending branch suggestions.</div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {suggestions.map((s) => (
            <div key={s.groupId} style={{ border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                Shared {s.signals.join(' + ')} · {s.clinics.length} locations
              </div>
              <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 13 }}>
                {s.clinics.map((c) => (
                  <li key={c.id} style={{ marginBottom: 2 }}>
                    {c.clinicName} <span style={{ opacity: 0.7 }}>· {c.city}, {c.state}</span>
                    {c.brandId != null && <span style={{ color: '#3FA68A' }}> (already in a brand)</span>}
                  </li>
                ))}
              </ul>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label style={{ fontSize: 12, flex: 1, minWidth: 200 }}>
                  New brand name
                  <input
                    value={nameByGroup[s.groupId] ?? ''}
                    onChange={(e) => setNameByGroup((p) => ({ ...p, [s.groupId]: e.target.value }))}
                    disabled={!!brandByGroup[s.groupId]}
                    style={{ display: 'block', marginTop: 4, width: '100%', padding: '6px 8px', opacity: brandByGroup[s.groupId] ? 0.5 : 1 }}
                  />
                </label>
                {brands.length > 0 && (
                  <label style={{ fontSize: 12 }}>
                    or existing brand
                    <select
                      value={brandByGroup[s.groupId] ?? ''}
                      onChange={(e) => setBrandByGroup((p) => ({ ...p, [s.groupId]: e.target.value }))}
                      style={{ display: 'block', marginTop: 4, padding: '6px 8px' }}
                    >
                      <option value="">(new brand)</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => act(s, 'link')}
                  style={btn(busy === s.groupId + 'link', '#3FA68A')}
                >
                  {busy === s.groupId + 'link' ? 'Linking…' : 'Link as brand'}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => act(s, 'dismiss')}
                  style={btn(busy === s.groupId + 'dismiss', '#64748b')}
                >
                  Not a branch
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && <p style={{ fontSize: 13, marginTop: 12 }}>{msg}</p>}
    </div>
  )
}
