/**
 * Assistant tools: the bridge between Claude and injector.world's real data.
 *
 * Each tool wraps an already-built, production-proven query — no new "search
 * brain". The model decides which to call; the executor runs the real query and
 * returns (a) compact text for the model to ground its answer on, and (b)
 * structured cards/links for the chat UI to render.
 */
import type Anthropic from '@anthropic-ai/sdk'
import { searchDirectory, type SearchClinic } from '../search-queries'
import { searchKnowledge, type KnowledgeDoc } from './knowledge'

export type AssistantContext = {
  /** The visitor's approximate coordinates, if the client sent them (IP/geo). */
  userLocation: { lat: number; lng: number } | null
}

export type ToolOutcome = {
  /** Grounding text handed back to the model as the tool result. */
  llmText: string
  /** Clinic cards for the UI (already in DirectoryClinic shape). */
  clinics?: SearchClinic[]
  /** Guide / news / site links for the UI. */
  links?: { title: string; href: string; type: string }[]
}

// ── Tool definitions (JSON schema the model sees) ─────────────────────────────

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_directory',
    description:
      'Find verified clinics and injectors. Use for any request about who/where — a treatment in a place, "near me", "best/top-rated clinics", a city or ZIP. Returns real, ranked listings.',
    input_schema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Treatment or service, e.g. "botox", "lip filler", "juvederm". Omit if the user only gave a location.',
        },
        location: {
          type: 'string',
          description: 'City, state, or ZIP, e.g. "Houston, TX" or "77098". Omit if using the visitor\'s own location.',
        },
        use_my_location: {
          type: 'boolean',
          description: 'Set true when the user says "near me" / "close to me" and gave no explicit place.',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_knowledge',
    description:
      'Look up injector.world\'s reviewed treatment guides and news to answer general, educational questions ("what is X", "how does X work", "botox vs filler", general safety/recovery). Answer only from what this returns.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The treatment or topic to look up, e.g. "botox recovery" or "lip filler".' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_site_help',
    description:
      'Answer questions about using injector.world itself — claiming a profile, listing a practice, pricing for providers, how verification works, contact, or what the site is.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: ['claim_profile', 'list_practice', 'provider_pricing', 'how_we_verify', 'contact', 'about'],
          description: 'Which help topic the user is asking about.',
        },
      },
      required: ['topic'],
    },
  },
]

// ── Executor ──────────────────────────────────────────────────────────────────

const SITE_HELP: Record<string, { text: string; title: string; href: string }> = {
  claim_profile: {
    text: 'Providers can claim their existing profile to manage their listing, add photos, and respond to patients. Claiming is free and starts on the claim page.',
    title: 'Claim your profile',
    href: '/claim',
  },
  list_practice: {
    text: 'Practices not yet listed can add themselves from the "List your practice" page. Listings are reviewed before going live.',
    title: 'List your practice',
    href: '/list-your-practice',
  },
  provider_pricing: {
    text: 'injector.world is free for patients. Providers have a free tier plus paid plans with more features. Details are on the pricing page.',
    title: 'Pricing for providers',
    href: '/pricing',
  },
  how_we_verify: {
    text: 'Every injector is license-verified against the state board, credential-reviewed, and reviews are moderated. The full process is on the How we verify page.',
    title: 'How we verify',
    href: '/how-we-verify',
  },
  contact: {
    text: 'You can reach the injector.world team through the contact page.',
    title: 'Contact us',
    href: '/contact',
  },
  about: {
    text: 'injector.world is a content-led, independent directory that helps people find verified aesthetic injectors and learn what is right for them.',
    title: 'About injector.world',
    href: '/about',
  },
}

function summarizeClinics(clinics: SearchClinic[], label: string): string {
  if (clinics.length === 0) return `No clinics found for ${label}.`
  const lines = clinics.map((c, i) => {
    const where = [c.neighborhood, c.city, c.state].filter(Boolean).join(', ')
    const rating = c.aggregateRating
      ? ` rated ${c.aggregateRating.toFixed(1)}${c.aggregateRatingCount ? ` (${c.aggregateRatingCount})` : ''}`
      : ''
    const dist = typeof c.distanceMiles === 'number' ? ` about ${c.distanceMiles.toFixed(1)} mi away` : ''
    return `${i + 1}. ${c.clinicName} — ${where}${rating}${dist}`
  })
  return `Found ${clinics.length} clinic(s) for ${label} (the UI is showing these as cards):\n${lines.join('\n')}`
}

function knowledgeToText(docs: KnowledgeDoc[]): string {
  if (docs.length === 0) return 'No matching guide or article was found. Do not invent an answer; tell the user we do not have a guide on this yet.'
  const blocks = docs.map((d) => {
    const parts: string[] = [`SOURCE (${d.kind}): ${d.title}`]
    if (d.answerSnippet) parts.push(`Summary: ${d.answerSnippet}`)
    if (d.atAGlance?.length) parts.push(`At a glance: ${d.atAGlance.join('; ')}`)
    if (d.faq?.length) parts.push(`FAQ: ${d.faq.map((f) => `Q: ${f.question} A: ${f.answer}`).join(' | ')}`)
    if (!d.answerSnippet && !d.atAGlance?.length && !d.faq?.length && d.excerpt) parts.push(`Excerpt: ${d.excerpt}`)
    return parts.join('\n')
  })
  return `Use only the following reviewed content to answer. Cite the guide(s) by pointing the user to them (the UI links them).\n\n${blocks.join('\n\n')}`
}

export async function runAssistantTool(
  name: string,
  input: any,
  ctx: AssistantContext,
): Promise<ToolOutcome> {
  try {
    if (name === 'search_directory') {
      const service: string | undefined = typeof input?.service === 'string' ? input.service : undefined
      const location: string | undefined = typeof input?.location === 'string' ? input.location : undefined
      const useMine = input?.use_my_location === true

      const label = [service, useMine ? 'near you' : location].filter(Boolean).join(' ') || 'your search'

      // Mirror the two-field Hero search exactly (lib/search-client.ts
      // searchHrefTwoField): service as free-text `q`, location as its own
      // field. The strict `treatment` param filters on a structured
      // servicesOffered tag most clinics don't have populated (only Juvederm
      // brand is tagged today) and silently returns zero real results; `q`
      // full-text-matches the clinic record the same way a typed search does.
      const params: any = { type: 'clinics', limit: 6, allowGeocode: true }
      if (service) params.q = service
      if (useMine && ctx.userLocation) {
        params.lat = ctx.userLocation.lat
        params.lng = ctx.userLocation.lng
      } else if (location) {
        params.location = location
      }

      const res = await searchDirectory(params)
      const clinics = res.clinics.slice(0, 6)
      return { llmText: summarizeClinics(clinics, label), clinics }
    }

    if (name === 'search_knowledge') {
      const query: string = typeof input?.query === 'string' ? input.query : ''
      const docs = await searchKnowledge(query, 3)
      return {
        llmText: knowledgeToText(docs),
        links: docs.map((d) => ({ title: d.title, href: d.href, type: d.kind })),
      }
    }

    if (name === 'get_site_help') {
      const topic: string = typeof input?.topic === 'string' ? input.topic : ''
      const help = SITE_HELP[topic]
      if (!help) return { llmText: 'Unknown help topic. Ask the user to rephrase.' }
      return { llmText: help.text, links: [{ title: help.title, href: help.href, type: 'page' }] }
    }

    return { llmText: `Unknown tool: ${name}` }
  } catch {
    return { llmText: 'That lookup failed. Tell the user something went wrong and suggest using the search bar.' }
  }
}
