type IconName =
  | 'wheelchair'
  | 'parking'
  | 'restroom'
  | 'wifi'
  | 'clock'
  | 'treatment'
  | 'credit-card'
  | 'debit-card'
  | 'cash'
  | 'financing'
  | 'insurance'
  | 'check'

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (name) {
    case 'wheelchair':
      return (
        <svg {...common}>
          <circle cx="17" cy="19" r="3" />
          <circle cx="9" cy="4.5" r="1.5" />
          <path d="M9 6.5v6l3 3h6" />
          <path d="M9 10h6" />
          <path d="M6 12.5 4.5 19H8" />
        </svg>
      )
    case 'parking':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9" />
        </svg>
      )
    case 'restroom':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1.5" />
          <circle cx="15.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <path d="M4 3v18" />
        </svg>
      )
    case 'wifi':
      return (
        <svg {...common}>
          <path d="M3 8.5a16 16 0 0 1 18 0" />
          <path d="M6.5 12.5a11 11 0 0 1 11 0" />
          <path d="M10 16.5a5.5 5.5 0 0 1 4 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.5 2" />
        </svg>
      )
    case 'treatment':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
        </svg>
      )
    case 'credit-card':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      )
    case 'debit-card':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 15h4" />
        </svg>
      )
    case 'cash':
      return (
        <svg {...common}>
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M6 9v.01M18 15v.01" />
        </svg>
      )
    case 'financing':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="2" />
          <path d="M3 9.5h18" />
          <path d="M8 14h2M8 17h5" />
        </svg>
      )
    case 'insurance':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      )
    case 'check':
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.5 2.5L16 9.5" />
        </svg>
      )
  }
}

function iconForItem(text: string): IconName {
  const t = text.toLowerCase()
  if (t.includes('wheelchair')) return 'wheelchair'
  if (t.includes('parking')) return 'parking'
  if (t.includes('restroom')) return 'restroom'
  if (t.includes('wifi')) return 'wifi'
  if (t.includes('hour') || t.includes('extended')) return 'clock'
  if (t.includes('treatment')) return 'treatment'
  if (t.includes('credit')) return 'credit-card'
  if (t.includes('debit')) return 'debit-card'
  if (t.includes('cash')) return 'cash'
  if (t.includes('payment plan') || t.includes('financing')) return 'financing'
  if (t.includes('insurance')) return 'insurance'
  return 'check'
}

function splitItems(value: string): string[] {
  return value
    .split(';')
    .map((v) => v.trim())
    .filter(Boolean)
}

function NoteRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex-shrink-0 text-ink-tertiary">
        <Icon name={iconForItem(text)} />
      </span>
      <span className="text-body-sm text-ink-secondary">{text}</span>
    </div>
  )
}

function NoteGroup({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="text-overline uppercase tracking-widest font-semibold text-ink-tertiary">{label}</div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <NoteRow key={i} text={item} />
        ))}
      </div>
    </div>
  )
}

export function PracticeNotes({
  amenities,
  paymentMethods,
  acceptsInsurance,
}: {
  amenities?: string | null
  paymentMethods?: string | null
  acceptsInsurance?: boolean | null
}) {
  const amenityItems = amenities ? splitItems(amenities) : []
  const paymentItems = paymentMethods ? splitItems(paymentMethods) : []

  return (
    <div className="space-y-4">
      {acceptsInsurance && <NoteGroup label="Insurance" items={['Accepts insurance']} />}
      <NoteGroup label="Amenities" items={amenityItems} />
      <NoteGroup label="Payment" items={paymentItems} />
    </div>
  )
}
