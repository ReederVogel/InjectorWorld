'use client'

import { useState, useEffect } from 'react'

type State = 'hidden' | 'live'

export function SiteIndexToggle() {
  const [state, setState] = useState<State | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/site-config', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setState(d.siteNoindex ? 'hidden' : 'live'))
      .catch(() => setError('Could not load current state.'))
  }, [])

  function handleButtonClick() {
    if (loading || state === null) return
    if (confirming) return
    setConfirming(true)
    setError(null)
  }

  async function confirmToggle() {
    if (state === null) return
    setConfirming(false)
    setLoading(true)
    setError(null)
    const next = state === 'hidden' ? 'live' : 'hidden'
    try {
      const res = await fetch('/api/admin/site-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteNoindex: next === 'hidden' }),
      })
      if (!res.ok) throw new Error('Server error')
      setState(next)
      setSavedAt(new Date().toLocaleTimeString())
    } catch {
      setError('Update failed — try again.')
    } finally {
      setLoading(false)
    }
  }

  const isHidden = state === 'hidden'
  const isLive = state === 'live'
  const unknown = state === null

  const red = '#ef4444'
  const green = '#3FA68A'
  const activeColor = isLive ? green : red

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Panel */}
      <div style={{
        background: '#0d1117',
        borderRadius: 20,
        padding: '28px 32px',
        border: `1.5px solid ${unknown ? '#334155' : activeColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 36,
        transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
        boxShadow: unknown ? 'none' : `0 0 40px ${activeColor}22, 0 2px 8px rgba(0,0,0,0.4)`,
        flexWrap: 'wrap',
      }}>

        {/* Big ignition button */}
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={loading || unknown || confirming}
          title={unknown ? 'Loading...' : isHidden ? 'Click to go live' : 'Click to hide site'}
          style={{
            width: 108,
            height: 108,
            borderRadius: '50%',
            border: `3px solid ${unknown ? '#334155' : activeColor}`,
            background: unknown
              ? '#1e293b'
              : isLive
              ? 'radial-gradient(circle at 38% 38%, #052e1c, #011a0e)'
              : 'radial-gradient(circle at 38% 38%, #2d0808, #160404)',
            cursor: loading || confirming ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.5s ease',
            boxShadow: unknown
              ? 'none'
              : isLive
              ? `0 0 24px ${green}88, 0 0 60px ${green}33, inset 0 2px 6px rgba(255,255,255,0.08)`
              : `0 0 24px ${red}88, 0 0 60px ${red}33, inset 0 2px 6px rgba(255,255,255,0.08)`,
            transform: loading ? 'scale(0.96)' : 'scale(1)',
          }}
        >
          {/* Power / ignition icon */}
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M12 3v6"
              stroke={unknown ? '#475569' : activeColor}
              strokeWidth="2.5"
            />
            <path
              d="M6.34 6.34A8 8 0 1 0 17.66 6.34"
              stroke={unknown ? '#475569' : activeColor}
              strokeWidth="2.5"
            />
          </svg>
        </button>

        {/* Status block */}
        <div style={{ flex: 1, minWidth: 200 }}>
          {/* Label row */}
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#475569',
            marginBottom: 6,
          }}>
            Search Engine Visibility
          </div>

          {/* Big status text */}
          <div style={{
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: unknown ? '#475569' : activeColor,
            lineHeight: 1,
            transition: 'color 0.4s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            {unknown ? '...' : isLive ? 'LIVE' : 'HIDDEN'}

            {/* Pulse dot */}
            {!unknown && !loading && (
              <span style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: activeColor,
                display: 'inline-block',
                animation: isLive ? 'iw-pulse 2s ease-in-out infinite' : 'none',
                opacity: isHidden ? 0.6 : 1,
              }} />
            )}

            {/* Spinner */}
            {loading && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'iw-spin 0.7s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
          </div>

          {/* Sub-label */}
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 1.4 }}>
            {unknown
              ? 'Loading current state...'
              : isLive
              ? 'Google and Bing can crawl and index this site.'
              : 'robots.txt blocks all crawlers. Pages have noindex tag.'}
          </div>

          {savedAt && !confirming && (
            <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>
              Last changed at {savedAt}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: red, marginTop: 8, fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>

        {/* Right side — action label or confirm */}
        <div style={{ flexShrink: 0 }}>
          {!confirming && !loading && !unknown && (
            <button
              type="button"
              onClick={handleButtonClick}
              style={{
                background: 'transparent',
                border: `1.5px solid ${isHidden ? green : red}`,
                color: isHidden ? green : red,
                borderRadius: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {isHidden ? 'Go Live' : 'Hide Site'}
            </button>
          )}

          {confirming && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>
                Are you sure?
              </div>
              <button
                type="button"
                onClick={confirmToggle}
                style={{
                  background: isHidden ? green : red,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Yes, {isHidden ? 'Go Live' : 'Hide Site'}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                style={{
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  padding: '7px 18px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyframes injected once */}
      <style>{`
        @keyframes iw-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes iw-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
