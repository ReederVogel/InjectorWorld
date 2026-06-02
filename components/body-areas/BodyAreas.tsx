import { bodyAreas } from '@/lib/body-areas-data'
import { BodyAreasCarousel } from './BodyAreasCarousel'

export function BodyAreas() {
  return (
    <section className="bg-surface pt-8 pb-16 md:pt-12 md:pb-24">
      <div className="max-canvas">
        <BodyAreasCarousel areas={bodyAreas} />
      </div>
    </section>
  )
}
