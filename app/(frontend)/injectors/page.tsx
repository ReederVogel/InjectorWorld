import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const revalidate = 300

// Parked: the individual-injector directory is not live yet (no verified provider
// data). The page stays reachable but empty + noindex; the live directory is the
// clinic directory (/clinics) and the state directory (/states).
export const metadata: Metadata = {
  title: { absolute: 'Injector directory — coming soon | injector.world' },
  description: 'Our verified individual-injector directory is coming soon. In the meantime, browse verified clinics and providers by state.',
  robots: { index: false, follow: true },
}

export default function InjectorsPage() {
  return (
    <>
      <Header />

      <section className="bg-[#0B1B34] text-white pt-32 pb-16 md:pt-36 md:pb-20">
        <div className="max-canvas">
          <p className="overline text-brand-accent mb-4 tracking-widest">Directory</p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-5 max-w-[680px]">
            The injector directory is coming soon.
          </h1>
          <p className="text-lede-m md:text-lede text-white/70 max-w-[600px] font-serif">
            We are verifying individual injectors one license at a time. While that is underway,
            browse verified clinics and explore providers by state.
          </p>

          <div className="flex flex-wrap gap-3 mt-10">
            <Link
              href="/clinics"
              className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-pill px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition"
            >
              Browse verified clinics
            </Link>
            <Link
              href="/states"
              className="inline-flex items-center gap-2 border border-white/25 text-white rounded-pill px-6 py-3 text-body-sm font-medium hover:bg-white/10 transition"
            >
              Find by state
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
