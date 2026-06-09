import { withPayload } from '@payloadcms/next/withPayload'

// CSP: covers Next.js inline scripts (nonces not used), Google Fonts, Carto tiles,
// Leaflet, Unsplash/Pravatar images, DO Spaces CDN, and Payload admin.
//
// DEV NOTE: Next.js dev mode (React Fast Refresh / HMR) requires 'unsafe-eval' and
// a websocket connection. Without them a strict browser blocks eval and hydration
// silently dies (cards stay invisible, theme toggle never mounts, nothing is
// interactive). Production does NOT use eval, so prod keeps the tight policy.
const isDev = process.env.NODE_ENV !== 'production'

const csp = [
  "default-src 'self'",
  // Inline scripts needed for JSON-LD schema blocks and Next.js hydration.
  // 'unsafe-eval' is dev-only (Fast Refresh); never shipped to production.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  [
    "img-src 'self' data: blob:",
    'https://picsum.photos',
    'https://i.pravatar.cc',
    'https://images.unsplash.com',
    'https://*.tile.openstreetmap.org',
    'https://*.basemaps.cartocdn.com',
    'https://*.digitaloceanspaces.com',
  ].join(' '),
  [
    "connect-src 'self'",
    // Dev-only HMR websocket + dev server.
    ...(isDev ? ['ws://localhost:*', 'http://localhost:*'] : []),
    'https://*.basemaps.cartocdn.com',
    'https://*.digitaloceanspaces.com',
  ].join(' '),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.pravatar.cc' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.tile.openstreetmap.org' },
      { protocol: 'https', hostname: '*.digitaloceanspaces.com' },
    ],
  },
  experimental: {
    reactCompiler: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
