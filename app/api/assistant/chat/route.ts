import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import {
  ASSISTANT_MODEL,
  ASSISTANT_MAX_TOKENS,
  ASSISTANT_MAX_TURNS,
  ASSISTANT_RATE_LIMIT,
  ASSISTANT_RATE_WINDOW_MS,
  ASSISTANT_MAX_HISTORY,
  ASSISTANT_MAX_MESSAGE_CHARS,
  ASSISTANT_MAX_USER_TURNS,
  ASSISTANT_SYSTEM_PROMPT,
  ASSISTANT_REFUSAL_TEXT,
  isAssistantEnabled,
} from '@/lib/assistant/config'
import { ASSISTANT_TOOLS, runAssistantTool, type AssistantContext } from '@/lib/assistant/tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const limiter = new RateLimiter(ASSISTANT_RATE_LIMIT, ASSISTANT_RATE_WINDOW_MS)

type ClientMessage = { role: 'user' | 'assistant'; content: string }

function sanitizeHistory(raw: any): ClientMessage[] {
  if (!Array.isArray(raw)) return []
  const msgs: ClientMessage[] = []
  for (const m of raw) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user'
    const content = typeof m?.content === 'string' ? m.content.slice(0, ASSISTANT_MAX_MESSAGE_CHARS).trim() : ''
    if (content) msgs.push({ role, content })
  }
  // Keep the most recent slice, and ensure the first message is a user turn.
  const trimmed = msgs.slice(-ASSISTANT_MAX_HISTORY)
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift()
  return trimmed
}

export async function POST(req: NextRequest) {
  // Same-origin only (no cross-site abuse of a paid endpoint).
  if (!checkOrigin(req)) {
    return NextResponse.json({ type: 'error', message: 'Bad origin' }, { status: 403 })
  }

  // Kill switch / not configured -> graceful "unavailable" so the widget can
  // fall back to the normal search bar. Never a crash.
  if (!isAssistantEnabled()) {
    return NextResponse.json({ type: 'unavailable' }, { status: 200 })
  }

  // Rate limit per IP.
  if (!limiter.check(getIp(req))) {
    return NextResponse.json({ type: 'error', message: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ type: 'error', message: 'Invalid request' }, { status: 400 })
  }

  const history = sanitizeHistory(body?.messages)
  if (history.length === 0) {
    return NextResponse.json({ type: 'error', message: 'No message' }, { status: 400 })
  }

  // Per-session cost cap: one long conversation shouldn't run up unbounded spend.
  const userTurns = history.filter((m) => m.role === 'user').length
  if (userTurns > ASSISTANT_MAX_USER_TURNS) {
    return NextResponse.json(
      { type: 'error', message: 'This chat has gotten long. Tap "New chat" to keep going.' },
      { status: 200 },
    )
  }

  const ctx: AssistantContext = {
    userLocation:
      body?.userLocation &&
      Number.isFinite(body.userLocation.lat) &&
      Number.isFinite(body.userLocation.lng)
        ? { lat: Number(body.userLocation.lat), lng: Number(body.userLocation.lng) }
        : null,
  }

  const client = new Anthropic()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))

      const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }))
      const toolsUsed: string[] = []

      try {
        for (let turn = 0; turn < ASSISTANT_MAX_TURNS; turn++) {
          // Client disconnected (tab closed / navigated away) — stop calling
          // Anthropic. Without this check the agent loop keeps running (and
          // billing) with nobody left to read the stream.
          if (req.signal.aborted) break

          const ms = client.messages.stream(
            {
              model: ASSISTANT_MODEL,
              max_tokens: ASSISTANT_MAX_TOKENS,
              system: ASSISTANT_SYSTEM_PROMPT,
              tools: ASSISTANT_TOOLS,
              thinking: { type: 'disabled' },
              messages,
            },
            { signal: req.signal },
          )

          ms.on('text', (delta) => emit({ type: 'text', delta }))

          const final = await ms.finalMessage()
          messages.push({ role: 'assistant', content: final.content })

          if (final.stop_reason === 'refusal') {
            emit({ type: 'text', delta: ASSISTANT_REFUSAL_TEXT })
            break
          }

          if (final.stop_reason !== 'tool_use') break // end_turn / max_tokens — done

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of final.content) {
            if (block.type !== 'tool_use') continue
            toolsUsed.push(block.name)
            const outcome = await runAssistantTool(block.name, block.input, ctx)
            if (outcome.clinics?.length) emit({ type: 'clinics', items: outcome.clinics })
            if (outcome.links?.length) emit({ type: 'links', items: outcome.links })
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: outcome.llmText })
          }
          messages.push({ role: 'user', content: toolResults })
        }
        // PII-safe analytics: what people ask + which tools fired. Feeds content
        // strategy (which guide to write next). No IP, no name — just the public
        // question the visitor typed, truncated.
        const lastQ = history[history.length - 1]?.content ?? ''
        console.log('[assistant]', JSON.stringify({ q: lastQ.slice(0, 200), tools: toolsUsed, turns: userTurns }))
        emit({ type: 'done' })
      } catch {
        emit({ type: 'error', message: 'The assistant hit a problem. Please try the search bar for now.' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}
