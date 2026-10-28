import Link from 'next/link'
import Image from 'next/image'
import {
  InstagramLogo,
  YoutubeLogo,
  LinkedinLogo,
  FacebookLogo,
  XLogo,
  PinterestLogo,
  ArrowUpRight,
} from '@phosphor-icons/react/dist/ssr'
import { footerLinks } from '@/lib/site-nav'
import { BackToTop } from './BackToTop'
import { NewsletterSignup } from '@/components/shared/NewsletterSignup'

// Our own profiles. The homepage Organization schema reads its sameAs from
// this list, so the two cannot drift apart.
export const socialLinks = [
  { icon: InstagramLogo, href: 'https://www.instagram.com/injector.world/',              label: 'Instagram' },
  { icon: FacebookLogo,  href: 'https://www.facebook.com/profile.php?id=61594366058553', label: 'Facebook' },
  { icon: XLogo,         href: 'https://x.com/Injectorworld',                            label: 'X' },
  { icon: PinterestLogo, href: 'https://www.pinterest.com/injectorworlds/',              label: 'Pinterest' },
  { icon: YoutubeLogo,   href: 'https://www.youtube.com/@Injector.World_us',             label: 'YouTube' },
  { icon: LinkedinLogo,  href: 'https://www.linkedin.com/company/injectorworld/',        label: 'LinkedIn' },
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
              {/* No `priority`: the footer is never above the fold, and a
                  priority image is preloaded in <head> ahead of the page's real
                  LCP image (2026-09-24, docs/PAGE-SPEED-PLAN-2026-09-24.md). */}
              {/* The wordmark scales down with its column instead of keeping a
                  fixed 256px: at 1024 and 1280px the brand column is narrower
                  than mark + wordmark (306px), so it ran into the "Services"
                  heading, and at 320px it pushed the page sideways (QA
                  IW-M9UA, 2026-10-14). Full size from 1440px up, as before. */}
              <Image src="/footer-mark.png" alt="" width={40} height={40} className="w-10 h-10 shrink-0" />
              <Image src="/footer-wordmark.png" alt="injector.world" width={256} height={30} className="h-auto w-full max-w-[256px] min-w-0" />
            </Link>

            {/* Brand line mirrors the hero copy (client request 2026-07-30), so the
                footer closes on the same promise the page opens with.
                The breaks are explicit <br /> (client request 2026-07-31): this was
                one paragraph left to wrap inside a 300px column, so the line breaks
                landed wherever the column happened to run out. Now they are fixed
                and read the same at every width. max-w removed for the same
                reason: nothing should re-wrap these lines. */}
            <p className="font-serif text-[22px] leading-[1.2] text-white mb-2">
              Find Your Injector.
            </p>
            <p className="text-body-sm text-white/70 leading-[1.6] mb-5">
              Every Treatment.<br />
              Every Brand.<br />
              Every Injectable.<br />
              Right Here. Right Now.
            </p>

            <Link
              href="/list-your-clinic"
              className="inline-flex items-center gap-1 text-body-sm font-semibold text-[#3FA68A] hover:text-[#3FA68A]/80 transition-colors mb-5"
            >
              <ArrowUpRight size={14} weight="bold" />
              List your clinic
            </Link>

            <div className="flex items-center flex-wrap gap-2.5">
              {/* All six icons render identically (client request 2026-07-31:
                  "not bright, make them all common, icons should be clear").
                  weight="fill" because the outline weight is too thin to read
                  at this size on navy. Every profile is live since 2026-10-28,
                  so the old non-clickable "coming soon" chip is gone. */}
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200 bg-white/10 text-white hover:bg-[#3FA68A] hover:text-[#0B1B34]"
                >
                  <Icon size={18} weight="fill" />
                </a>
              ))}
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

        <p className="text-body-sm text-white/60 mt-3 md:hidden">
          Information here is editorial and not medical advice.
        </p>
      </div>
    </footer>
  )
}

function FooterColumn({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      {/* Rule sits under the heading, not above it (client request 2026-08-06).
          The line that used to appear above was not ours at all: the class was
          named `overline`, which collides with Tailwind's text-decoration
          utility. Renamed to `eyebrow` in globals.css.
          12px on phones, where 11px uppercase was hard to read (QA IW-IZBE,
          2026-10-14); desktop keeps the 11px overline. */}
      <div className="eyebrow mb-4 border-b border-white/10 pb-3 text-white/60 max-md:text-[12px]">{heading}</div>
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
