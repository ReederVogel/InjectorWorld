'use client'

import { useEffect, useState } from 'react'

export function ScrollProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function update() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[200] h-[2px] pointer-events-none"
    >
      <div
        className="h-full bg-gradient-to-r from-brand-accent via-brand-accent to-[#5fc8aa] transition-[width] duration-100 ease-out shadow-[0_0_8px_rgba(63,166,138,0.5)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
