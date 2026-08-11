/** Encodes an inline SVG string as a data: URL usable as a classic Marker icon. */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
