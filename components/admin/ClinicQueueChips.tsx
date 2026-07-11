const chips: Array<{ label: string; href: string }> = [
  { label: 'In review', href: '/admin/collections/clinics?where[or][0][and][0][status][equals]=review' },
  { label: 'Missing services', href: '/admin/collections/clinics?where[or][0][and][0][servicesOffered][exists]=false' },
  { label: 'Missing photos', href: '/admin/collections/clinics?where[or][0][and][0][clinicPhotoUrls][exists]=false' },
  {
    label: 'Flagged by import',
    href: '/admin/collections/data-alerts?where[or][0][and][0][collectionSlug][equals]=clinics&where[or][0][and][1][status][equals]=open',
  },
]

export function ClinicQueueChips() {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 16px' }}>
      {chips.map((chip) => (
        <a
          key={chip.label}
          href={chip.href}
          style={{
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            padding: '7px 14px',
            borderRadius: 999,
            border: '1px solid var(--theme-elevation-150, #e2e8f0)',
            background: 'var(--theme-elevation-50, #fff)',
            color: 'inherit',
          }}
        >
          {chip.label}
        </a>
      ))}
    </div>
  )
}
