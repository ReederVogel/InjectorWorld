import Link from 'next/link'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-1.5 flex-shrink-0 ${className}`} aria-label="injector.world home">
      <span className="text-[18px] font-semibold tracking-tight text-ink-primary">injector</span>
      <span className="w-1.5 h-1.5 rounded-pill bg-brand-accent inline-block" aria-hidden />
      <span className="text-[18px] font-semibold tracking-tight text-ink-secondary">world</span>
    </Link>
  )
}
