import { REGION_ITEMS } from '../game/region'
import { money } from './format'
import type { Props } from './types'

export function RegionShop({ state, dispatch }: Props) {
  const reg = state.region!
  const techs = reg.sites.reduce((sum, x) => sum + x.techs, 0)
  const clients = reg.sites.reduce((sum, x) => sum + x.clients, 0)
  const groups = [
    { name: 'Growth', items: REGION_ITEMS.filter((x) => x.id === 'openSite' || x.id === 'acquire') },
    { name: 'Company-wide services', items: REGION_ITEMS.filter((x) => x.id !== 'openSite' && x.id !== 'acquire') },
  ]
  return (
    <section className="panel shop">
      <div className="panel-head">
        <h2>Region</h2>
        <span className="muted small">
          {reg.sites.length} sites · {techs} techs · {clients} clients
        </span>
      </div>
      <p className="small muted staff-summary">Click a site on the map to hire techs or run local marketing there.</p>
      {groups.map((g) => {
        const items = g.items.filter((it) => !it.done(state))
        const owned = g.items.filter((it) => it.done(state) && it.id !== 'openSite' && it.id !== 'acquire')
        if (items.length === 0 && owned.length === 0) return null
        return (
          <div key={g.name}>
            <div className="shop-group">{g.name}</div>
            <ul className="upgrades">
              {items.map((it) => {
                const cost = it.cost(state)
                return (
                  <li key={it.id} className="upgrade">
                    <div className="upgrade-text">
                      <div className="upgrade-name">{it.name}</div>
                      <div className="upgrade-effect">{it.effect}</div>
                    </div>
                    <button className="buy" disabled={state.money < cost} onClick={() => dispatch({ type: 'buyRegion', id: it.id })}>
                      {money(cost)}
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
          </div>
        )
      })}
    </section>
  )
}
