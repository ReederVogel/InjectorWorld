---
description: Run the ship gate (tsc + build) and walk the DONE.md checklist before finishing a phase
allowed-tools: Bash(npx tsc:*), Bash(npm run build), Read
---

Run the ship gate from `docs/DONE.md`. Report a clear PASS or FAIL for each step.

1. Run `npx tsc --noEmit`. Report whether it is clean (zero type errors).
2. Run `npm run build`. Report whether it succeeds.
3. Remind me to verify by hand (you cannot check these automatically):
   - Every nav link and every changed page returns 200.
   - The feature built this phase works when clicked through.
   - Works in BOTH light and dark mode.
   - Mobile-first: correct at 390px width.
   - Token-only colors. No `text-white` on `bg-brand-primary`.
   - Copy: no em dashes, no lorem ipsum, no emojis.
   - If data/schema changed: `npm run db:backup` was taken and `npm run scan:alerts` is clean.
4. Remind me to update `docs/ROADMAP.md` status and append any new decision to `docs/DECISIONS.md`.

End with an overall PASS or FAIL summary line.
