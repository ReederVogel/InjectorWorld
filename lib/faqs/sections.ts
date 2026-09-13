/**
 * Sections group the questions inside one FAQ category page (/faq/<slug>).
 *
 * Pure module, no Payload or DB imports: collections/FAQs.ts reads the option
 * list, the save hook and the backfill read `guessFaqSection`, and the public
 * page reads the labels. Order here is the order on the page.
 */

export const FAQ_SECTIONS = [
  { value: 'basics', label: 'The basics' },
  { value: 'treatment', label: 'Treatment and recovery' },
  { value: 'results', label: 'Results' },
  { value: 'safety', label: 'Safety and side effects' },
  { value: 'cost', label: 'Cost' },
] as const

export type FaqSection = (typeof FAQ_SECTIONS)[number]['value']

const LABELS = new Map<string, string>(FAQ_SECTIONS.map((s) => [s.value, s.label]))

export function faqSectionLabel(value: string | null | undefined): string {
  return (value && LABELS.get(value)) || 'The basics'
}

export function isFaqSection(value: unknown): value is FaqSection {
  return typeof value === 'string' && LABELS.has(value)
}

/**
 * First matching rule wins, so order matters:
 *   safety first ("is cheap lip filler safe" is a safety question, not cost),
 *   cost next ("is it worth it" is a cost question),
 *   treatment before results ("how long does swelling last after filler" is
 *   recovery, not how long results last).
 * Anything unmatched is a basics question. This is only a first guess for rows
 * with no section, tuned by reading all 621 staging questions on 2026-09-13.
 * The admin sets the real value and can change any of them.
 */
const RULES: Array<[FaqSection, RegExp]> = [
  ['safety', /\b(safe|safety|unsafe|risk|risks|risky|side effects?|complications?|danger|dangerous|allerg\w*|pregnan\w*|breastfeed\w*|nursing|occlusion|blindness|necrosis|infection|droop\w*|ptosis|migrat\w*|lumps?|tyndall|go wrong|goes wrong|gone wrong|botched|reactions?|fda|contraindicat\w*|emergency|warning signs?|who should not|not a good candidate|toxic|jowls (from|after)|(botox|filler|fillers) cause)\b/i],
  ['cost', /\b(cost|costs|price|prices|pricing|priced|how much is|expensive|cheap|afford|insurance|insured|covered by|financing|payment|pay for|per unit|per syringe|per vial|worth (it|the))\b|\$/i],
  // Before treatment so "what do 100 units look like before and after" stays a
  // results question instead of matching the dosing words below.
  ['results', /before[- ]and[- ]after|\bresults? (can|should) (i|you) (realistically )?expect\b/i],
  ['treatment', /\b(hurt|hurts|painful|numb\w*|anesthe\w*|recovery|recover|downtime|aftercare|after care|prepare|preparation|appointment|procedure take|treatment take|what happens during|injection (points|sites)|injections placed|injected for|sessions?|consultation|exercise|work ?out|gym|makeup|lipstick|alcohol|sleep|lie down|bruis\w*|swell\w*|ice|what should i avoid|how many (units|syringes|vials)|\d+(\.\d+)? ?(ml|syringes?|vials?|units?)|one syringe|(filler|units|syringes|vials) do i need|who can inject|injector|nurse|np|rn|md|qualified|licensed)\b/i],
  ['results', /\b(last|lasts|lasting|how long|results?|difference does|actually change|change (the|your)|kick in|start working|take effect|take to work|permanent|wear off|wears off|maintenance|touch-?ups?|how often|natural[- ]looking|look natural|frozen|look like|looks? so|before[- ]and[- ]after|reversible|reversed|stop getting)\b/i],
]

export function guessFaqSection(question: string | null | undefined): FaqSection {
  const q = String(question ?? '')
  for (const [section, re] of RULES) {
    if (re.test(q)) return section
  }
  return 'basics'
}
