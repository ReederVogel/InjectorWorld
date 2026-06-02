"use client"

import { CaretUp } from '@phosphor-icons/react'

export function BackToTop() {
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="inline-flex items-center gap-1.5 text-body-sm text-white/50 hover:text-white transition-colors duration-200"
      aria-label="Back to top"
    >
      <CaretUp size={12} weight="bold" />
      Back to top
    </button>
  )
}
