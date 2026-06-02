'use client'

import { useEffect, useRef, useState } from 'react'

export function SectionReveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setTimeout(() => setSeen(true), delay)
          io.disconnect()
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [delay])

  const Element = Tag as any
  return (
    <Element
      ref={ref}
      className={`transition-all duration-700 ease-out ${seen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
    >
      {children}
    </Element>
  )
}
