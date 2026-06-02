"use client"

import { useRef, useState, useCallback } from 'react'

export function FooterBrandmark() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [maskPos, setMaskPos] = useState({ cx: '50%', cy: '50%' })
  const [hovered, setHovered] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const cx = ((e.clientX - rect.left) / rect.width) * 100
    const cy = ((e.clientY - rect.top) / rect.height) * 100
    setMaskPos({ cx: `${cx}%`, cy: `${cy}%` })
  }, [])

  const textProps = {
    x: '50%' as const,
    y: '50%' as const,
    textAnchor: 'middle' as const,
    dominantBaseline: 'middle' as const,
    fontSize: 88,
    fontWeight: 700,
    letterSpacing: 3,
  }

  return (
    <div className="w-full overflow-hidden py-2" aria-hidden>
      <svg
        ref={svgRef}
        width="100%"
        viewBox="0 0 1100 130"
        xmlns="http://www.w3.org/2000/svg"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={handleMouseMove}
        className="select-none cursor-default block"
      >
        <defs>
          <radialGradient
            id="fbm-reveal-mask"
            gradientUnits="userSpaceOnUse"
            cx={maskPos.cx}
            cy={maskPos.cy}
            r="22%"
          >
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>

          <mask id="fbm-text-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="url(#fbm-reveal-mask)" />
          </mask>
        </defs>

        {/* Base: very dim outline, always visible */}
        <text
          {...textProps}
          fill="transparent"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.6"
          style={{ transition: 'opacity 0.4s', opacity: hovered ? 0.4 : 1 }}
        >
          INJECTORS.WORLD
        </text>

        {/* Draw-on stroke animation: mint, triggers on mount */}
        <text
          {...textProps}
          fill="transparent"
          stroke="#3FA68A"
          strokeWidth="0.6"
          strokeOpacity="0.9"
          strokeDasharray="4000"
          strokeDashoffset="4000"
          className="footer-brandmark-draw"
        >
          INJECTORS.WORLD
        </text>

        {/* Hover reveal: mint gradient following cursor */}
        <text
          {...textProps}
          fill="transparent"
          stroke="#3FA68A"
          strokeWidth="0.8"
          mask="url(#fbm-text-mask)"
          style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}
        >
          INJECTORS.WORLD
        </text>
      </svg>
    </div>
  )
}
