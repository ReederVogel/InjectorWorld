import Link from 'next/link'
import Image from 'next/image'
import type { MegaMenu } from '@/lib/site-nav'

export function MegaPanel({ menu }: { menu: MegaMenu }) {
  return (
    <div className="max-canvas grid grid-cols-4 gap-10 py-10">
      {menu.sections.map((section) => (
        <div key={section.heading}>
          <div className="overline text-brand-accent mb-4">{section.heading}</div>
          <ul className="space-y-2.5 text-body-sm">
            {section.links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-secondary hover:text-brand-accent transition">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {menu.feature && (
        <div className="bg-surface-warm rounded-xl p-5">
          <div className="relative w-full h-32 mb-4 rounded-md overflow-hidden">
            <Image
              src={menu.feature.imageUrl}
              alt={menu.feature.title}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 320px, 100vw"
            />
          </div>
          <div className="overline text-brand-accent mb-2">{menu.feature.overline}</div>
          <div className="font-serif text-[18px] font-medium leading-tight mb-2 text-ink-primary">
            {menu.feature.title}
          </div>
          <Link
            href={menu.feature.cta.href}
            className="text-body-sm text-brand-accent font-medium hover:underline"
          >
            {menu.feature.cta.label} &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
