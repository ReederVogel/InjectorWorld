import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export default function NotFound() {
  return (
    <>
      <Header />

      <section className="bg-surface-canvas min-h-[60vh] flex items-center">
        <div className="max-canvas py-20 md:py-28 text-center max-w-xl mx-auto">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            Error 404
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            We could not find that page
          </h1>
          <p className="text-body-lg text-ink-secondary mb-8">
            The page you are looking for may have moved or no longer exists. Try one of these instead.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-pill bg-brand-primary text-surface-canvas text-body-sm font-semibold hover:opacity-90 transition"
            >
              Back to homepage
            </Link>
            <Link
              href="/clinics"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:text-brand-accent transition"
            >
              Browse clinics
            </Link>
            <Link
              href="/guides"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-pill border border-border text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-ink-primary transition"
            >
              Read the guides
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
