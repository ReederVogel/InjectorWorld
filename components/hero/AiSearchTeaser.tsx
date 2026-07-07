export function AiSearchTeaser() {
  return (
    <div className="max-w-[720px] mx-auto mb-8 md:mb-10">
      <div className="flex items-center gap-3 rounded-pill border border-border bg-surface px-5 py-4 md:py-3.5 shadow-[0_4px_16px_rgba(11,27,52,0.06)]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-ink-tertiary flex-shrink-0"
        >
          <path
            d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"
            strokeLinecap="round"
          />
        </svg>
        <input
          type="text"
          disabled
          placeholder={`Ask anything — "best injector for lip filler near me"`}
          className="flex-1 bg-transparent outline-none text-body text-ink-primary placeholder:text-ink-tertiary min-w-0 cursor-not-allowed"
          aria-label="Ask AI (coming soon)"
        />
        <span className="flex-shrink-0 rounded-pill bg-brand-accent-soft text-brand-accent text-caption font-semibold px-3 py-1 uppercase tracking-wider">
          Coming soon
        </span>
      </div>
    </div>
  )
}
