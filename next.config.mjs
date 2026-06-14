import { withPayload } from '@payloadcms/next/withPayload'

// CSP: covers Next.js inline scripts (nonces not used), Google Fonts, Carto tiles,
// Leaflet, Unsplash/Pravatar images, DO Spaces CDN, and Payload admin.
//
// DEV NOTE: Next.js dev mode (React Fast Refresh / HMR) requires 'unsafe-eval' and
// a websocket connection. Without them a strict browser blocks eval and hydration
// silently dies (cards stay invisible, theme toggle never mounts, nothing is
// interactive). Production does NOT use eval, so prod keeps the tight policy.
const isDev = process.env.NODE_ENV !== 'production'

// Public origin that serves uploaded media (Cloudflare R2 today). The managed
// pub-xxxx.r2.dev domain is covered by the *.r2.dev wildcard; a custom domain
// (e.g. media.injector.world) is picked up from R2_PUBLIC_URL with no code
// change. Returns the bare https origin, or null when unset.
const r2PublicUrl = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null
  } catch {
    return null
  }
})()
const r2PublicOrigin = r2PublicUrl ? r2PublicUrl.origin : null
const r2PublicHostname = r2PublicUrl ? r2PublicUrl.hostname : null

const csp = [
  "default-src 'self'",
  // Inline scripts needed for JSON-LD schema blocks and Next.js hydration.
  // 'unsafe-eval' is dev-only (Fast Refresh); never shipped to production.
  // Cloudflare Turnstile CAPTCHA widget is loaded from challenges.cloudflare.com.
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ''}`,
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
    // Uploaded media (Cloudflare R2): managed r2.dev domain + any custom domain.
    'https://*.r2.dev',
    ...(r2PublicOrigin ? [r2PublicOrigin] : []),
  ].join(' '),
  [
    "connect-src 'self'",
    // Dev-only HMR websocket + dev server.
    ...(isDev ? ['ws://localhost:*', 'http://localhost:*'] : []),
    'https://*.basemaps.cartocdn.com',
    'https://*.digitaloceanspaces.com',
    'https://*.r2.dev',
    // Cloudflare Turnstile CAPTCHA makes verification requests to challenges.cloudflare.com.
    'https://challenges.cloudflare.com',
    ...(r2PublicOrigin ? [r2PublicOrigin] : []),
  ].join(' '),
  // Cloudflare Turnstile renders its challenge in a sandboxed iframe.
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
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
      // Uploaded media on Cloudflare R2: managed r2.dev domain...
      { protocol: 'https', hostname: '**.r2.dev' },
      // ...plus a custom public domain if R2_PUBLIC_URL points at one.
      ...(r2PublicHostname ? [{ protocol: 'https', hostname: r2PublicHostname }] : []),
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
