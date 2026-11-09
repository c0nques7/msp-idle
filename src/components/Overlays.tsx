import { money } from './format'
import type { Props } from './types'

function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export function Overlays({ state, dispatch, onEnterOffice, onEnterMap, onEnterWorld }: Props & { onEnterOffice: () => void; onEnterMap: () => void; onEnterWorld: () => void }) {
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
              A second floor, a full team and an office that runs itself. A competitor is retiring, the phones keep ringing from
              nearby towns, and it is time to think regionally. You are now Director of Operations.
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => dispatch({ type: 'dismissOfficeComplete' })}>
                Stay in the office for now
              </button>
              <button
                className="primary"
                onClick={() => {
                  dispatch({ type: 'enterRegion' })
                  onEnterMap()
                }}
              >
                Open the map
              </button>
            </div>
          </div>
        </div>
      )}

      {state.region?.showComplete && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="region-done-title">
            <p className="eyebrow">Stage 3 complete</p>
            <h2 id="region-done-title">{state.mspName} is the region's MSP</h2>
            <p>
              Five sites, a central NOC and a security operations team. A private equity firm has offered to fund your expansion
              overseas. You are now CEO.
            </p>
            <div className="modal-actions">
              <button className="secondary" onClick={() => dispatch({ type: 'dismissRegionComplete' })}>
                Stay regional for now
              </button>
              <button
                className="primary"
                onClick={() => {
                  dispatch({ type: 'enterWorld' })
                  onEnterWorld()
                }}
              >
                Go global
              </button>
            </div>
          </div>
        </div>
      )}

      {state.world?.showComplete && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="world-done-title">
            <p className="eyebrow">Stage 4 complete</p>
            <h2 id="world-done-title">{state.mspName} rang the opening bell</h2>
            <p>
              Six regions, support that follows the sun, a global SOC and audited books. You went from closing password resets to running a
              public, global MSP. Thanks for playing. Your company keeps running if you want to keep growing it.
            </p>
            <button className="primary" onClick={() => dispatch({ type: 'dismissWorldComplete' })}>
              Keep playing
            </button>
          </div>
        </div>
      )}
    </>
  )
}
