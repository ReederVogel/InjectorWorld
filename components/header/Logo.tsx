import Link from 'next/link'
import Image from 'next/image'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center flex-shrink-0 ${className}`} aria-label="injector.world home">
      {/* object-contain: on phones the centred header only leaves half its
          width for the logo, which squeezed it out of shape (QA IW-QRYP,
          2026-10-14). It now scales down at its real proportions. */}
      <Image src="/wordmark.png" alt="injector.world" width={205} height={28} className="h-[28px] w-auto object-contain" priority />
    </Link>
  )
}
