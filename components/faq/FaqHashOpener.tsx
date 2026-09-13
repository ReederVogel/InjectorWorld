'use client'

import { useEffect } from 'react'

/**
 * Opens the question named in the url hash on /faq/<slug>, so a shared link
 * like /faq/botox#will-botox-make-me-look-frozen lands on that answer, open.
 *
 * Progressive: every answer is already in the served HTML inside <details>, so
 * crawlers and no-JS visitors lose nothing. This only saves a click.
 */
export function FaqHashOpener() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      const el = document.getElementById(id)
      if (el instanceof HTMLDetailsElement) {
        el.open = true
        el.scrollIntoView({ block: 'start' })
      }
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])

  return null
}
