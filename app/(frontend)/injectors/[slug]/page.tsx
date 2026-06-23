import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { getProviderBySlug } from '@/lib/provider-queries'

export const revalidate = 300

export default async function ProviderRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const provider = await getProviderBySlug(slug)
  if (!provider) notFound()
  redirect(`/injectors/${provider.clinic.citySlug}/${slug}`)
}
