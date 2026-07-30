import Link from 'next/link'
import Image from 'next/image'
import {
  InstagramLogo,
  TiktokLogo,
  YoutubeLogo,
  LinkedinLogo,
  FacebookLogo,
  XLogo,
  ArrowUpRight,
} from '@phosphor-icons/react/dist/ssr'
import { footerLinks } from '@/lib/site-nav'
import { BackToTop } from './BackToTop'
import { NewsletterSignup } from '@/components/shared/NewsletterSignup'

const socialLinks = [
  { icon: InstagramLogo, href: 'https://instagram.com/injectorworld', label: 'Instagram' },
  { icon: TiktokLogo,    href: 'https://tiktok.com/@injectorworld',   label: 'TikTok' },
  { icon: FacebookLogo,  href: null,                                  label: 'Facebook' },
  { icon: XLogo,         href: null,                                  label: 'X' },
  { icon: YoutubeLogo,   href: null,                                  label: 'YouTube' },
  { icon: LinkedinLogo,  href: null,                                  label: 'LinkedIn' },
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
            <Link href="/" className="flex items-center gap-2.5 mb-4 hover:opacity-80 transition-opacity" aria-label="injector.world home">
              <Image src="/footer-mark.png" alt="" width={40} height={40} className="w-10 h-10" priority />
              <Image src="/footer-wordmark.png" alt="injector.world" width={256} height={30} className="h-[30px] w-auto" priority />
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

            <div className="flex items-center flex-wrap gap-2.5">
              {/* Social links. Facebook, X, YouTube and LinkedIn render as disabled
                  placeholders until the accounts exist. Swap `href: null` for the
                  real URL in `socialLinks` above to activate one.
                  Icons use weight="fill": at 16px on the navy background the outline
                  weight was too thin to read (client feedback 2026-07-30). */}
              {socialLinks.map(({ icon: Icon, href, label }) => {
                const cls = 'w-9 h-9 rounded-full border flex items-center justify-center transition-colors duration-200'
                if (!href) {
                  return (
                    <span
                      key={label}
                      aria-label={`${label} (coming soon)`}
                      title={`${label}: coming soon`}
                      className={`${cls} border-white/15 text-white/40 cursor-not-allowed`}
                    >
                      <Icon size={16} weight="fill" />
                    </span>
                  )
                }
                return (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cls} border-white/25 text-white/85 hover:bg-white/5 hover:text-[#3FA68A] hover:border-[#3FA68A]`}
                  >
                    <Icon size={16} weight="fill" />
                  </a>
                )
              })}
            </div>
          </div>

          <FooterColumn heading="Services"    links={footerLinks.services} />
          <FooterColumn heading="Top States"  links={footerLinks.topStates} />
          <FooterColumn heading="Top Cities"  links={footerLinks.cities} />
          <FooterColumn heading="Guides"      links={footerLinks.guides} />
          <FooterColumn heading="Company"     links={footerLinks.company} />
          <FooterColumn heading="Legal"       links={footerLinks.legal} />
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-body-sm text-white/50 border-t border-white/[0.06] pt-8">
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
