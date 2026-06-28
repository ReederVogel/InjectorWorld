export type WorthItResult = {
  score: number
  sampleSize: number
  hasData: boolean
}

export async function getWorthItScore(_treatmentName: string): Promise<WorthItResult> {
  return { score: 0, sampleSize: 0, hasData: false }
}

export async function getWorthItScores(
  treatmentNames: string[],
): Promise<Map<string, WorthItResult>> {
  const results = new Map<string, WorthItResult>()
  for (const name of treatmentNames) {
    results.set(name, { score: 0, sampleSize: 0, hasData: false })
  }
  return results
}
