'use client'

import { useState } from 'react'
import type { CityPricing } from '@/lib/location-queries'

type Props = {
  treatmentName: string
  treatmentSlug: string
  priceUnit?: string
  avgPriceFromUsd?: number
  avgPriceToUsd?: number
  cityPricing?: CityPricing | null
  cityName?: string
}

const NEUROTOXINS = new Set(['botox', 'dysport', 'xeomin', 'jeuveau', 'daxxify', 'masseter-botox'])

export function CostEstimator({
  treatmentName,
  treatmentSlug,
  priceUnit,
  avgPriceFromUsd,
  avgPriceToUsd,
  cityPricing,
  cityName,
}: Props) {
  const isNeurotoxin = NEUROTOXINS.has(treatmentSlug)
  const [units, setUnits] = useState(30)

  const perUnit = cityPricing?.avgBotoxPerUnit ?? null
  const perSyringe = cityPricing?.avgFillerPerSyringe ?? null

  const hasLocalData = isNeurotoxin
    ? perUnit != null
    : perSyringe != null

  if (!avgPriceFromUsd && !avgPriceToUsd && !hasLocalData) return null

  const totalLow = isNeurotoxin && perUnit ? Math.round(perUnit * units * 0.85) : avgPriceFromUsd
  const totalHigh = isNeurotoxin && perUnit ? Math.round(perUnit * units * 1.15) : avgPriceToUsd

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-h4 text-ink-primary">
            {cityName ? `${treatmentName} cost in ${cityName}` : `${treatmentName} cost`}
          </h3>
          {cityPricing && cityPricing.sampleSize > 0 && (
            <p className="text-caption text-ink-tertiary mt-0.5">
              Based on {cityPricing.sampleSize} local {cityPricing.sampleSize === 1 ? 'provider' : 'providers'}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {totalLow && totalHigh ? (
            <>
              <div className="font-bold text-ink-primary text-[22px] leading-none">
                ${totalLow.toLocaleString()}
                {totalLow !== totalHigh && ` to $${totalHigh.toLocaleString()}`}
              </div>
              {isNeurotoxin && perUnit && (
                <div className="text-caption text-ink-tertiary mt-0.5">
                  for {units} units at ${perUnit}/unit
                </div>
              )}
              {!isNeurotoxin && priceUnit && (
                <div className="text-caption text-ink-tertiary mt-0.5">
                  {priceUnit.replace(/_/g, ' ')}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Units slider for neurotoxins */}
      {isNeurotoxin && perUnit && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="units-slider" className="text-body-sm text-ink-secondary">
              Units: <span className="font-semibold text-ink-primary">{units}</span>
            </label>
            <span className="text-caption text-ink-tertiary">Typical range: 20 to 50 units</span>
          </div>
          <input
            id="units-slider"
            type="range"
            min={10}
            max={60}
            step={5}
            value={units}
            onChange={(e) => setUnits(Number(e.target.value))}
            className="w-full h-1.5 rounded-full bg-border appearance-none cursor-pointer accent-brand-accent"
            aria-valuemin={10}
            aria-valuemax={60}
            aria-valuenow={units}
          />
          <div className="flex justify-between text-caption text-ink-tertiary mt-1">
            <span>10</span><span>60</span>
          </div>
        </div>
      )}

      {/* Price range fallback (non-neurotoxin or no local data) */}
      {!isNeurotoxin && !hasLocalData && avgPriceFromUsd && avgPriceToUsd && (
        <div className="text-body-sm text-ink-secondary">
          National average: ${avgPriceFromUsd.toLocaleString()} to ${avgPriceToUsd.toLocaleString()}
          {priceUnit && ` ${priceUnit.replace(/_/g, ' ')}`}
        </div>
      )}

      <p className="text-caption text-ink-tertiary mt-4 leading-relaxed border-t border-border-subtle pt-3">
        Estimates are for educational purposes only. Actual pricing varies by provider, geography, and treatment area. Consult a verified provider for a personalized quote.
      </p>
    </div>
  )
}
