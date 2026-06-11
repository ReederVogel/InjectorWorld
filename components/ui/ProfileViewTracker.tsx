'use client'

import { useEffect } from 'react'

export function ProfileViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    fetch('/api/providers/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
    }).catch(() => {})
  }, [slug])
  return null
}
