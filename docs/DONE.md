# Ship Gate — run this before finishing any phase

Nothing ships unless every box passes. This is the anti-fuck-up gate.

## Code health
- [ ] `npx tsc --noEmit` is clean (zero type errors).
- [ ] `npm run build` succeeds.
- [ ] If a collection schema changed: `npm run db:push` then `npm run generate:types` were run.

## Runtime
- [ ] `npm run dev` boots with no console errors.
- [ ] Every nav link and every changed page returns 200 (no dead links, no 500s).
- [ ] The specific feature built this phase works when clicked through by hand.

## Data safety (only if the phase touched data or schema)
- [ ] `npm run db:backup` was taken BEFORE the work.
- [ ] `npm run scan:alerts` is clean (no new unresolved DataAlerts).

## Design
- [ ] Works in BOTH light and dark mode (toggle and check).
- [ ] Mobile-first: looks correct at 390px width, not just desktop.
- [ ] Token-only colors. No `text-white` on `bg-brand-primary`. No flat `bg-white` that should flip.

## Copy
- [ ] No em dashes. No lorem ipsum. No emojis (unless explicitly asked).

## Record
- [ ] Any new decision appended to `docs/DECISIONS.md`.
- [ ] `docs/ROADMAP.md` status table updated for this phase.
- [ ] Git: work is on a branch, committed in small chunks.
