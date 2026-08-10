/**
 * Shared look for the clinic hero action row: social links, Save and Share all
 * render as the same 40px circle with the label sitting underneath (Google
 * business panel pattern, client request 2026-08-10).
 *
 * Lives in its own module because the row mixes a server component (the social
 * links, rendered in the clinic page) with two client components (Save and
 * Share), and all three have to be pixel-identical.
 *
 * Every item in the row carries a label, social links included (client request
 * 2026-08-11, reversing the labels-on-Save-and-Share-only call from the day
 * before).
 */

/**
 * Carries both hover: and group-hover: because the circle is sometimes the
 * hovered element itself (social links) and sometimes a span inside a button
 * that also holds the label (Save, Share). Both need to light up together.
 */
export const ACTION_CIRCLE =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-canvas text-ink-secondary transition hover:border-brand-accent hover:text-brand-accent group-hover:border-brand-accent group-hover:text-brand-accent'

/** Save, once the visitor has saved the clinic. */
export const ACTION_CIRCLE_ON =
  'flex h-10 w-10 items-center justify-center rounded-full border border-brand-accent bg-brand-accent-soft text-brand-accent transition'

/**
 * Fixed width keeps "Share" and "Copied" from shifting their circle sideways;
 * the longest label in the row, "Instagram", sets it.
 *
 * 56px below sm so a full row (3 socials + Save + Share) still fits one line on
 * a 360px phone: 5 x 56 + 4 x 6 of gap = 304, inside the ~320px the page gutter
 * leaves. At 64px it wrapped, stranding Share alone on a second line.
 */
export const ACTION_STACK = 'flex w-14 flex-col items-center gap-1.5 sm:w-16'

/** 11px on mobile so "Instagram" clears the narrower stack without wrapping. */
export const ACTION_LABEL =
  'whitespace-nowrap text-center text-[11px] leading-[14px] text-ink-secondary sm:text-caption'
