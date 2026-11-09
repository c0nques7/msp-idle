import { money } from './format'
import type { Props } from './types'

function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export function Overlays({ state, dispatch, onEnterOffice }: Props & { onEnterOffice: () => void }) {
  return (
    <>
      <div className="toasts" aria-live="polite">
        {state.toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>

      {state.welcomeBack && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <p className="eyebrow">Welcome back</p>
            <h2 id="welcome-title">Your team kept the lights on</h2>
            <p>
              You were away for {duration(state.welcomeBack.seconds)}. Your staff and automation earned{' '}
              <strong>{money(state.welcomeBack.earned)}</strong>
              {state.welcomeBack.fullPay ? '' : ' at half pay'}
              {state.welcomeBack.paidSeconds < state.welcomeBack.seconds ? ` for the first ${duration(state.welcomeBack.paidSeconds)}` : ''}.
            </p>
            {!state.welcomeBack.fullPay && (
              <p className="muted small">The On-call rotation upgrade pays full rate for up to 8 hours away.</p>
            )}
            <button className="primary" onClick={() => dispatch({ type: 'dismissWelcome' })}>
              Back to the queue
            </button>
          </div>
        </div>
      )}

      {state.showPromotion && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="promo-title">
            <p className="eyebrow">Stage 1 complete</p>
            <h2 id="promo-title">Promoted to Service Desk Lead</h2>
            <p>
              With three techs on the queue and a 4-star reputation, {state.mspName} has made you the lead. Your team is moving into the
              office, and you now run the room as well as the queue.
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => dispatch({ type: 'dismissPromotion' })}>
                Stay on the CRM for now
              </button>
              <button
                className="primary"
                onClick={() => {
                  dispatch({ type: 'enterOffice' })
                  onEnterOffice()
                }}
              >
                Move into the office
              </button>
            </div>
          </div>
        </div>
      )}

      {state.office?.showComplete && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="done-title">
            <p className="eyebrow">Stage 2 complete</p>
            <h2 id="done-title">{state.mspName} is outgrowing one office</h2>
            <p>
              A second floor, a full team and an office that runs itself. In the full game, a competitor now offers to sell you their
              second site, and the view pulls back to a map. Stage 3 is next on the plan. For now, keep playing.
            </p>
            <button className="primary" onClick={() => dispatch({ type: 'dismissOfficeComplete' })}>
              Keep playing
            </button>
          </div>
        </div>
      )}
    </>
  )
}
