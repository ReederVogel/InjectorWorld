'use client'

export function AiSearchTeaser() {
  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent('open-assistant'))
  }

  return (
    <div className="max-w-[720px] mx-auto mb-8 md:mb-10">
      <button
        type="button"
        onClick={openAssistant}
        aria-label="Ask the AI assistant"
        className="group w-full flex items-center gap-3 rounded-pill border border-border bg-surface px-5 py-4 md:py-3.5 shadow-[0_4px_16px_rgba(11,27,52,0.06)] hover:border-brand-accent transition text-left"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-brand-accent flex-shrink-0"
        >
          <path
            d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
            strokeLinecap="round"
          />
        </svg>
        <span className="flex-1 text-body text-ink-tertiary min-w-0 truncate">
          Ask anything — &quot;best injector for lip filler near me&quot;
        </span>
        <span className="flex-shrink-0 rounded-pill bg-brand-primary text-surface-canvas text-caption font-semibold px-3.5 py-1.5">
          Ask AI
        </span>
      </button>
    </div>
  )
}
