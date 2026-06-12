import Link from 'next/link'
import {
  InstagramLogo,
  TiktokLogo,
  YoutubeLogo,
  LinkedinLogo,
  ArrowUpRight,
} from '@phosphor-icons/react/dist/ssr'
import { footerLinks } from '@/lib/site-nav'
import { FooterBrandmark } from './FooterBrandmark'
import { BackToTop } from './BackToTop'
import { NewsletterSignup } from '@/components/shared/NewsletterSignup'

const socialLinks = [
  { icon: InstagramLogo, href: '#', label: 'Instagram' },
  { icon: TiktokLogo,   href: '#', label: 'TikTok' },
  { icon: YoutubeLogo,  href: '#', label: 'YouTube' },
  { icon: LinkedinLogo, href: '#', label: 'LinkedIn' },
]

export function Footer() {
  return (
    <footer className="bg-[#0B1B34] text-white border-t border-white/10 pt-20 pb-10 px-5 md:px-10">
      <div className="max-w-canvas mx-auto">

        {/* Newsletter strip */}
        <div className="border border-white/10 rounded-xl px-6 py-7 mb-12 bg-white/[0.03]">
          <div className="grid md:grid-cols-2 gap-6 md:gap-10 items-start">
            <div>
              <p className="text-[15px] font-semibold text-white mb-1">Stay in the loop.</p>
              <p className="text-[13px] text-white/60 leading-relaxed">
                Treatment guides, verified injector spotlights, and industry news. No spam.
              </p>
            </div>
            <NewsletterSignup source="footer" darkBg heading="" subtext="" />
          </div>
        </div>

        {/* Main link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-8 md:gap-6 mb-16">

          {/* Brand block */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-1.5 mb-4">
              <span className="text-[20px] font-semibold tracking-tight">injector</span>
              <span className="w-1.5 h-1.5 rounded-pill bg-[#3FA68A] inline-block" />
              <span className="text-[20px] font-semibold tracking-tight text-white/60">world</span>
            </Link>

            <p className="text-body-sm text-white/70 leading-[1.6] mb-4 max-w-[280px]">
              The trusted guide to verified aesthetic injectors in the United States.
            </p>

            <Link
              href="/list-your-practice"
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-[#3FA68A] hover:text-[#3FA68A]/80 transition-colors mb-5"
            >
              <ArrowUpRight size={14} weight="bold" />
              List your practice
            </Link>

            <div className="flex items-center gap-3">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-pill border border-white/15 flex items-center justify-center text-white/60 hover:text-[#3FA68A] hover:border-[#3FA68A] transition-colors duration-200"
                >
                  <Icon size={15} weight="regular" />
                </a>
              ))}
            </div>
          </div>

          <FooterColumn heading="Treatments"  links={footerLinks.treatments} />
          <FooterColumn heading="Top States"  links={footerLinks.topStates} />
          <FooterColumn heading="Top Cities"  links={footerLinks.cities} />
          <FooterColumn heading="Guides"      links={footerLinks.guides} />
          <FooterColumn heading="Company"     links={footerLinks.company} />
          <FooterColumn heading="Legal"       links={footerLinks.legal} />
        </div>

        {/* Large animated brandmark */}
        <div className="border-t border-white/[0.06] pt-8 mb-2">
          <FooterBrandmark />
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-body-sm text-white/50 pt-4">
          <div>&copy; {new Date().getFullYear()} injector.world. All rights reserved.</div>
          <div className="text-center hidden md:block">
            Information here is editorial and not medical advice.
          </div>
          <BackToTop />
        </div>

        <p className="text-body-sm text-white/40 mt-3 md:hidden">
          Information here is editorial and not medical advice.
        </p>
      </div>
    </footer>
  )
}

function FooterColumn({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="overline text-white/40 mb-4">{heading}</div>
      <ul className="space-y-2.5 text-body-sm text-white/75">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-[#3FA68A] transition-colors duration-150">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
