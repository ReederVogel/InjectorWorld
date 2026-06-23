import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { getClinicBySlug } from '@/lib/clinic-queries'

export const revalidate = 300

export default async function ClinicRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clinic = await getClinicBySlug(slug)
  if (!clinic) notFound()
  redirect(`/clinics/${clinic.citySlug}/${slug}`)
}
