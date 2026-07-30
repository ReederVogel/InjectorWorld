export function CountPill({ count, label }: { count: number; label: string }) {
  return (
    <span className="px-3 py-1.5 rounded-control bg-brand-accent-soft text-brand-accent text-body-sm font-medium">
      {count.toLocaleString()} {label}
    </span>
  )
}
