/**
 * Pre-hydration switch for the near-me listings (2026-09-19, founder
 * decision D3).
 *
 * Without this the visitor sees three states: the server-rendered national
 * list, then the skeleton once hydration runs, then the ZIP list. The served
 * HTML has to keep the national list for crawlers (hard rule 6), so the list
 * cannot be removed. It can be hidden before it is ever painted, which is what
 * this does, and it is the only way to satisfy both rules at once.
 *
 * Runs during HTML parse, before the listing markup below it is parsed, so the
 * national list is never painted. Idempotent: setting the attribute twice and
 * registering the timeout twice are both harmless.
 *
 * The timeout is a hard safety net that does not depend on React. If hydration
 * never happens (a bundle 404, a JS error, an old browser) the attribute is
 * removed and the real list appears.
 */
export function NearMeBoot() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html:
          "try{var d=document.documentElement;d.setAttribute('data-near-me','pending');" +
          "setTimeout(function(){d.removeAttribute('data-near-me')},2500)}catch(e){}",
      }}
    />
  )
}
