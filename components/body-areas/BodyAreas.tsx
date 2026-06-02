import { bodyAreas } from '@/lib/body-areas-data'
import { BodyAreasCarousel } from './BodyAreasCarousel'

export function BodyAreas() {
  return (
    <section className="bg-surface-canvas py-16 md:py-24">
      <div className="max-canvas">
        <div className="max-w-[720px] mb-10 md:mb-12">
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">Browse by area.</h2>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">Ten treatment zones. Find injectors who specialize in exactly what you need.</p>
        </div>

        <BodyAreasCarousel areas={bodyAreas} />
      </div>
    </section>
  )
}
