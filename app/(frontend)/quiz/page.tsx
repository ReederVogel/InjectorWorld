import type { Metadata } from 'next'
import { QuizClient } from './QuizClient'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export const metadata: Metadata = {
  title: { absolute: 'Am I a Candidate? Find Your Treatment | injector.world' },
  description:
    'Answer 3 quick questions to get an educational recommendation on which injectable treatment might be right for your concern. Not medical advice.',
  alternates: { canonical: 'https://injector.world/quiz' },
  robots: { index: true, follow: true },
}

export default function QuizPage() {
  return (
    <>
      <Header />
      <QuizClient />
      <Footer />
    </>
  )
}
