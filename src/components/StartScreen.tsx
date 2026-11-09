import type { Props } from './types'

export function StartScreen({ state, dispatch }: Props) {
  return (
    <div className="start">
      <div className="start-card">
        <p className="eyebrow">Your first day on the service desk</p>
        <h1>{state.mspName}</h1>
        <p className="muted">
          You're the newest Tier 1 tech. Alerts and tickets from your clients are about to start landing on the board.
          Work them, stay inside your SLAs, and spend what you earn on tools that take the busywork off your plate.
        </p>
        <h2>Your clients</h2>
        <ul className="client-list">
          {state.clients.map((c) => (
            <li key={c.code}>
              <span className="code">{c.code}</span> {c.name}
            </li>
          ))}
        </ul>
        <div className="start-actions">
          <button className="secondary" onClick={() => dispatch({ type: 'reroll' })}>
            Generate another MSP
          </button>
          <button className="primary" onClick={() => dispatch({ type: 'start' })}>
            Start the shift
          </button>
        </div>
        <p className="preview-line small muted">
          Want to see stage 2?{' '}
          <button className="link" onClick={() => dispatch({ type: 'previewOffice' })}>
            Skip ahead to the office
          </button>{' '}
          with a ready-made team. You can also skip to{' '}
          <button className="link" onClick={() => dispatch({ type: 'previewRegion' })}>
            the regional map
          </button>{' '}
          (stage 3), or{' '}
          <button className="link" onClick={() => dispatch({ type: 'previewWorld' })}>
            the world map
          </button>{' '}
          (stage 4).
        </p>
      </div>
    </div>
  )
}
