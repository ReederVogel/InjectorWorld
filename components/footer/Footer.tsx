import Link from 'next/link'
import { footerLinks } from '@/lib/site-nav'

export function Footer() {
  return (
    <footer className="bg-[#0B1B34] text-white pt-20 pb-10 px-5 md:px-10">
      <div className="max-w-canvas mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-8 md:gap-6 mb-16">
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-1.5 mb-4">
              <span className="text-[20px] font-semibold tracking-tight">injector</span>
              <span className="w-1.5 h-1.5 rounded-pill bg-[#3FA68A] inline-block" />
              <span className="text-[20px] font-semibold tracking-tight text-white/60">world</span>
            </Link>
            <p className="text-body-sm text-white/70 leading-[1.6] mb-5 max-w-[300px]">
              The trusted guide to verified aesthetic injectors in the United States.
            </p>
            <div className="flex items-center gap-3">
              {['instagram','tiktok','youtube','linkedin'].map((p) => (
                <a key={p} href="#" aria-label={p} className="w-9 h-9 rounded-pill border border-white/15 flex items-center justify-center text-white/70 hover:text-[#3FA68A] hover:border-[#3FA68A] transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>
                </a>
              ))}
            </div>
          </div>

          <FooterColumn heading="Treatments" links={footerLinks.treatments} />
          <FooterColumn heading="Top Cities" links={footerLinks.cities} />
          <FooterColumn heading="Company" links={footerLinks.company} />
          <FooterColumn heading="Legal" links={footerLinks.legal} />
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-body-sm text-white/60">
          <div>&copy; {new Date().getFullYear()} injector.world. All rights reserved.</div>
          <div>Information here is editorial and not medical advice.</div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="overline text-white/45 mb-4">{heading}</div>
      <ul className="space-y-2.5 text-body-sm text-white/80">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="hover:text-[#3FA68A] transition">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  )
}
