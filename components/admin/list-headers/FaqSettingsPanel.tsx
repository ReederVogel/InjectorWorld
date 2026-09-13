'use client'

import { useEffect, useState } from 'react'
import { button, hint, input, label, panel, readError } from './faqAdminStyles'

/** Sitewide FAQ switches, on the FAQs screen. Saved through /api/admin/faqs/settings. */

type Settings = {
  hubEnabled: boolean
  hubTitle: string
  hubIntro: string
  hubMetaDescription: string
  previewCount: number
  showOnServicePages: boolean
  showOnBrandPages: boolean
  showOnGuidePages: boolean
  showOnLocationPages: boolean
  schemaEnabled: boolean
}

const TOGGLES: Array<{ key: keyof Settings; title: string; help: string }> = [
  { key: 'hubEnabled', title: 'FAQ pages are live', help: 'Off makes /faq and every /faq/<category> page return 404. Previews elsewhere are controlled below.' },
  { key: 'showOnServicePages', title: 'Preview on treatment pages', help: '/services/<treatment>: first questions of the linked category.' },
  { key: 'showOnBrandPages', title: 'Preview on brand pages', help: '/brands/<brand>: first questions of the linked category.' },
  { key: 'showOnGuidePages', title: 'Preview on guides', help: '/guides/<guide>: first questions of the linked category.' },
  { key: 'showOnLocationPages', title: 'FAQs on state and city pages', help: 'Only FAQs whose Place is that state or city. Never general FAQs.' },
  { key: 'schemaEnabled', title: 'FAQ schema on category pages', help: 'Structured data (FAQPage) on /faq/<category>. It is never added anywhere else.' },
]

export function FaqSettingsPanel() {
  const [s, setS] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/faqs/settings', { credentials: 'include', cache: 'no-store' })
        if (!res.ok) throw new Error(await readError(res, 'Could not load settings'))
        setS(await res.json())
      } catch (err: any) {
        setMsg(err?.message || 'Could not load settings.')
      }
    })()
  }, [])

  async function save() {
    if (!s) return
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/faqs/settings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s),
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      const j = await res.json()
      setS(j.settings)
      setMsg('Saved. Pages pick this up on their next request.')
    } catch (err: any) {
      setMsg(err?.message || 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!s) return <div style={panel}><p style={{ fontSize: 12.5, margin: 0 }}>{msg || 'Loading settings…'}</p></div>

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })

  return (
    <div style={panel}>
      <strong style={{ fontSize: 14 }}>FAQ settings</strong>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 12 }}>
        {TOGGLES.map((t) => (
          <label key={t.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={Boolean(s[t.key])} onChange={(e) => set(t.key, e.target.checked as any)} style={{ marginTop: 3 }} />
            <span>
              <span style={{ fontWeight: 600 }}>{t.title}</span>
              <span style={{ ...hint, display: 'block' }}>{t.help}</span>
            </span>
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
        <div>
          <label style={label}>Questions in each preview</label>
          <input style={{ ...input, maxWidth: 120 }} type="number" min={1} max={20} value={s.previewCount}
            onChange={(e) => set('previewCount', Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
          <div style={hint}>1 to 20. Order comes from each FAQ's sort rank.</div>
        </div>
        <div>
          <label style={label}>/faq heading</label>
          <input style={input} value={s.hubTitle} onChange={(e) => set('hubTitle', e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={label}>/faq intro</label>
        <textarea style={{ ...input, minHeight: 56 }} value={s.hubIntro} onChange={(e) => set('hubIntro', e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={label}>/faq search description (optional)</label>
        <input style={input} value={s.hubMetaDescription} onChange={(e) => set('hubMetaDescription', e.target.value)} />
        <div style={hint}>Leave empty to use the intro.</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <button type="button" style={button('primary', busy)} disabled={busy || !s.hubTitle.trim()} onClick={save}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span style={{ fontSize: 12.5 }}>{msg}</span>}
      </div>
    </div>
  )
}
