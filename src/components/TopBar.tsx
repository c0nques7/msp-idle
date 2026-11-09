import { useState, type Dispatch } from 'react'
import { has, idleRatePerSec, repMultiplier, type Action, type GameState } from '../game/engine'
import { money, Stars } from './format'

interface TopBarProps {
  state: GameState
  dispatch: Dispatch<Action>
  onReset: () => void
  view: 'office' | 'crm' | null
  onView: (v: 'office' | 'crm') => void
}

export function TopBar({ state, dispatch, onReset, view, onView }: TopBarProps) {
  const [confirming, setConfirming] = useState(false)
  const queued = state.tickets.filter((t) => !t.active).length
  const idle = idleRatePerSec(state)
  const staff = state.office ? state.office.staff.length : state.juniors + (has(state, 'senior') ? 1 : 0)
  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo" aria-hidden>
          {state.mspName[0]}
        </span>
        <div>
          <div className="brand-name">{state.mspName}</div>
          <div className="brand-sub">{state.stage === 2 ? 'Service Desk Lead' : 'Service Desk'}</div>
        </div>
      </div>
      {view && (
        <div className="view-tabs" role="tablist" aria-label="View">
          <button role="tab" aria-selected={view === 'office'} className={view === 'office' ? 'active' : ''} onClick={() => onView('office')}>
            Office
          </button>
          <button role="tab" aria-selected={view === 'crm'} className={view === 'crm' ? 'active' : ''} onClick={() => onView('crm')}>
            CRM
          </button>
        </div>
      )}
      <div className="stats">
        <div className="stat">
          <span className="label">Money</span>
          <span className="value">
            {money(state.money)}
            {idle > 0 && <span className="idle-rate"> +{money(idle)}/s idle</span>}
          </span>
        </div>
        {staff > 0 && (
          <div className="stat">
            <span className="label">Staff</span>
            <span className="value">{staff}</span>
          </div>
        )}
        <div className="stat">
          <span className="label">Reputation</span>
          <span className="value">
            <Stars value={state.reputation} /> <span className="mult">x{repMultiplier(state).toFixed(2)} pay</span>
          </span>
        </div>
        <div className="stat">
          <span className="label">Closed</span>
          <span className="value">{state.ticketsClosed}</span>
        </div>
        <div className="stat">
          <span className="label">In queue</span>
          <span className="value">{queued}</span>
        </div>
      </div>
      {state.stage === 1 && state.promoted && (
        <button
          className="primary office-cta"
          onClick={() => {
            dispatch({ type: 'enterOffice' })
            onView('office')
          }}
        >
          Move into the office
        </button>
      )}
      {confirming ? (
        <div className="confirm">
          <span>Start over? Progress will be lost.</span>
          <button className="link" onClick={onReset}>
            Start over
          </button>
          <button className="link" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="link new-game" onClick={() => setConfirming(true)}>
          New game
        </button>
      )}
    </header>
  )
}
