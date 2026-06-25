'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export function LazyMapMount({
  children,
  placeholder,
  className,
  rootMargin = '200px',
}: {
  children: ReactNode
  placeholder: ReactNode
  className?: string
  rootMargin?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shouldMount, setShouldMount] = useState(false)

  useEffect(() => {
    if (shouldMount) return
    const node = ref.current
    if (!node) return

    if (!('IntersectionObserver' in window)) {
      setShouldMount(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldMount(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [rootMargin, shouldMount])

  return (
    <div ref={ref} className={className}>
      {shouldMount ? children : placeholder}
    </div>
  )
}
