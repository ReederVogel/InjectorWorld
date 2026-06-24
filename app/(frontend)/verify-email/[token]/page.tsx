import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { VerifyEmailClient } from './VerifyEmailClient'

export const metadata: Metadata = {
  title: { absolute: 'Verify your email | injector.world' },
  robots: 'noindex',
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <>
      <Header />

      <main className="min-h-[60vh] bg-surface-canvas section-pad">
        <div className="max-canvas max-w-md">
          <div className="rounded-2xl border border-border bg-surface p-6 md:p-8">
            <VerifyEmailClient token={token} />
          </div>
        </div>
      </main>

      <Footer />
    </>
  )
}
