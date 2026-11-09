import { UPGRADES, maxedOut, upgradeCost, upgradeLevel } from '../game/upgrades'
import { money } from './format'
import type { Props } from './types'

const LOCKED_SHOWN = 3

export function Shop({ state, dispatch }: Props) {
  const available = UPGRADES.filter((u) => u.unlocked(state) && !maxedOut(state, u))
  const locked = UPGRADES.filter((u) => !u.unlocked(state) && upgradeLevel(state, u) === 0)
  const owned = UPGRADES.filter((u) => upgradeLevel(state, u) > 0)

  return (
    <section className="panel shop">
      <div className="panel-head">
        <h2>Upgrades</h2>
        <span className="muted small">{owned.length} owned</span>
      </div>
      <ul className="upgrades">
        {available.map((u) => {
          const cost = upgradeCost(state, u)
          const level = upgradeLevel(state, u)
          return (
            <li key={u.id} className="upgrade">
              <div className="upgrade-text">
                <div className="upgrade-name">
                  {u.name}
                  {u.max && u.max > 1 ? <span className="level"> {level}/{u.max}</span> : null}
                </div>
                <div className="upgrade-effect">{u.effect}</div>
              </div>
              <button className="buy" disabled={state.money < cost} onClick={() => dispatch({ type: 'buy', id: u.id })}>
                {money(cost)}
              </button>
            </li>
          )
        })}
        {locked.slice(0, LOCKED_SHOWN).map((u) => (
          <li key={u.id} className="upgrade locked">
            <div className="upgrade-text">
              <div className="upgrade-name">{u.name}</div>
              <div className="upgrade-effect">Unlocks: {u.unlockText}</div>
            </div>
            <span className="lock-cost">{money(u.baseCost)}</span>
          </li>
        ))}
        {locked.length > LOCKED_SHOWN && (
          <li className="upgrade more">{locked.length - LOCKED_SHOWN} more upgrades to discover</li>
        )}
      </ul>
      {owned.length > 0 && (
        <div className="owned-list">
          {owned.map((u) => (
            <span key={u.id} className="owned-chip" title={u.effect}>
              {u.name}
              {u.id === 'junior' ? ` x${state.juniors}` : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
