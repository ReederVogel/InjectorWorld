'use client'

import { useEffect, useRef, useState } from 'react'

export function useTurnstile() {
  const [token, setToken] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | undefined>(undefined)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || typeof window === 'undefined' || !containerRef.current) return

    const render = () => {
      if (!containerRef.current || widgetRef.current !== undefined) return
      widgetRef.current = (window as any).turnstile?.render(containerRef.current, {
        sitekey: siteKey,
        callback: (t: string) => setToken(t),
        'expired-callback': () => setToken(''),
        'error-callback': () => setToken(''),
      })
    }

    if ((window as any).turnstile) {
      render()
    } else {
      const existing = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]',
      ) as HTMLScriptElement | null
      if (!existing) {
        const script = document.createElement('script')
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.onload = render
        document.head.appendChild(script)
      } else {
        existing.addEventListener('load', render)
      }
    }

    return () => {
      if (widgetRef.current !== undefined && (window as any).turnstile) {
        ;(window as any).turnstile.remove(widgetRef.current)
        widgetRef.current = undefined
      }
    }
  }, [siteKey])

  function reset() {
    if (widgetRef.current !== undefined && (window as any).turnstile) {
      ;(window as any).turnstile.reset(widgetRef.current)
    }
    setToken('')
  }

  return { token, containerRef, reset, siteKey }
}
