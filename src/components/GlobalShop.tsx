import { GLOBAL_ITEMS, hasG, regionEntryBlocked } from '../game/world'
import { WORLD_SLOTS } from '../game/worldContent'
import { money } from './format'
import type { Props } from './types'

export function GlobalShop({ state, dispatch }: Props) {
  const world = state.world!
  const offices = world.regions.reduce((n, r) => n + r.offices, 0)
  const clients = world.regions.reduce((n, r) => n + r.clients, 0)
  const closed = WORLD_SLOTS.map((slot, i) => ({ slot, i })).filter(({ i }) => i > 0 && !world.regions.some((r) => r.slot === i))
  const items = GLOBAL_ITEMS.filter((it) => !hasG(state, it.id))
  const owned = GLOBAL_ITEMS.filter((it) => hasG(state, it.id))
  return (
    <section className="panel shop">
      <div className="panel-head">
        <h2>Global</h2>
        <span className="muted small">
          {world.regions.length} abroad · {offices} offices · {clients} clients
        </span>
      </div>
      <p className="small muted staff-summary">Click a region on the map to open offices or run campaigns there.</p>
      {closed.length > 0 && (
        <>
          <div className="shop-group">Expand</div>
          <ul className="upgrades">
            {closed.map(({ slot, i }) => {
              const blocked = regionEntryBlocked(state, i)
              return (
                <li key={i} className={`upgrade${blocked ? ' locked' : ''}`}>
                  <div className="upgrade-text">
                    <div className="upgrade-name">Enter {slot.name}</div>
                    <div className="upgrade-effect">{blocked ?? 'A first office and 20 launch clients.'}</div>
                  </div>
                  <button className="buy" disabled={!!blocked || state.money < slot.cost} onClick={() => dispatch({ type: 'enterWorldRegion', slot: i })}>
                    {money(slot.cost)}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {items.length > 0 && <div className="shop-group">Global services</div>}
      <ul className="upgrades">
        {items.map((it) => {
          const blocked = it.blocked(state)
          return (
            <li key={it.id} className={`upgrade${blocked ? ' locked' : ''}`}>
              <div className="upgrade-text">
                <div className="upgrade-name">{it.name}</div>
                <div className="upgrade-effect">{blocked ? `Needs: ${blocked}` : it.effect}</div>
              </div>
              <button className="buy" disabled={!!blocked || state.money < it.cost} onClick={() => dispatch({ type: 'buyGlobal', id: it.id })}>
                {money(it.cost)}
              </button>
            </li>
          )
        })}
      </ul>
      {owned.length > 0 && (
        <div className="owned-list">
          {owned.map((it) => (
            <span key={it.id} className="owned-chip" title={it.effect}>
              {it.name}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
