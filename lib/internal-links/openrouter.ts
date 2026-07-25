/**
 * Thin OpenRouter client for the internal-linking agent. OpenRouter's API is
 * OpenAI-compatible (chat completions), so this is just a fetch call -- no SDK.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function callOpenRouter(
  messages: ChatMessage[],
  opts: { temperature?: number; jsonMode?: boolean } = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set.')
  const model = process.env.OPENROUTER_MODEL || 'moonshotai/kimi-k3'

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://injector.world',
      'X-Title': 'injector.world internal-linking agent',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter request failed: ${res.status} ${text.slice(0, 400)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenRouter response had no content.')
  }
  return content
}

/** Extracts the first {...} or [...] JSON block from a model response -- guards against stray prose or markdown fences around the JSON. */
export function extractJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(candidate) as T
}
