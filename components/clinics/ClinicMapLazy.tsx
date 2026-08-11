'use client'

import dynamic from 'next/dynamic'

/**
 * Code-splitting wrapper for ClinicMap.
 *
 * ClinicMap was imported statically by the clinic detail server component,
 * which put @vis.gl/react-google-maps (the Google Maps JS API loader + React
 * bindings) into that route's first-load JS on every clinic page. The map
 * sits well below the fold and most visitors never scroll to it.
 *
 * ClinicMap already uses LazyMapMount internally, but that only defers when the
 * map MOUNTS. The bundle was still downloaded and parsed up front. This wrapper
 * defers the download itself.
 *
 * `dynamic(..., { ssr: false })` cannot be called from a Server Component in the
 * App Router, which is why this thin client boundary exists rather than the
 * page calling dynamic() directly. Skipping SSR is correct here regardless:
 * the Google Maps JS API needs a real browser `window`/DOM and renders nothing server-side.
 *
 * Props are forwarded unchanged, so this is a drop-in replacement for ClinicMap.
 */
const ClinicMapInner = dynamic(
  () => import('./ClinicMap').then((m) => m.ClinicMap),
  {
    ssr: false,
    // Matches the map's own height so swapping in the real map does not shift
    // layout. A CLS regression here would undo the performance win.
    loading: () => (
      <div className="h-[400px] w-full rounded-2xl border border-border bg-surface animate-pulse" />
    ),
  },
)

export function ClinicMapLazy(props: {
  clinicName: string
  latitude: number
  longitude: number
  directionsUrl?: string
}) {
  return <ClinicMapInner {...props} />
}
