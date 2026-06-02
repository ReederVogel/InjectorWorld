import { bodyAreas } from '@/lib/body-areas-data'
import { BodyAreasCarousel } from './BodyAreasCarousel'

export function BodyAreas() {
  return (
    <section className="bg-surface-canvas py-16 md:py-24">
      <div className="max-canvas">
        <BodyAreasCarousel areas={bodyAreas} />
      </div>
    </section>
  )
}
