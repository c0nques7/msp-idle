export const money = (n: number) => `$${Math.floor(n).toLocaleString()}`

export function Stars({ value }: { value: number }) {
  const pct = (value / 5) * 100
  return (
    <span className="stars" title={`${value.toFixed(2)} of 5 stars`} aria-label={`${value.toFixed(1)} of 5 stars`}>
      <span className="stars-empty">{'★'.repeat(5)}</span>
      <span className="stars-full" style={{ width: `${pct}%` }}>
        {'★'.repeat(5)}
      </span>
    </span>
  )
}

export function SlaBar({ remaining, total, breached }: { remaining: number; total: number; breached: boolean }) {
  const frac = Math.max(0, Math.min(1, remaining / total))
  const tone = breached ? 'breached' : frac > 0.5 ? 'ok' : frac > 0.2 ? 'warn' : 'crit'
  return (
    <div className={`sla sla-${tone}`}>
      <div className="sla-track">
        <div className="sla-fill" style={{ width: `${breached ? 100 : frac * 100}%` }} />
      </div>
      <span className="sla-text">{breached ? 'Breached' : `${Math.ceil(remaining / 1000)}s`}</span>
    </div>
  )
}
