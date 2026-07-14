import Link from 'next/link'
import Image from 'next/image'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center flex-shrink-0 ${className}`} aria-label="injector.world home">
      <Image src="/wordmark.png" alt="injector.world" width={205} height={28} className="h-[28px] w-auto" priority />
    </Link>
  )
}
