import { OFFICE_ITEMS } from '../game/office'
import { money } from './format'
import type { Props } from './types'

const GROUPS = ['Staff', 'Space', 'Equipment'] as const

export function OfficeShop({ state, dispatch }: Props) {
  const o = state.office!
  const roles = o.staff.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.role]: (acc[x.role] ?? 0) + 1 }), {})
  return (
    <section className="panel shop">
      <div className="panel-head">
        <h2>Office</h2>
        <span className="muted small">
          {o.staff.length} staff · {o.desks} desks
        </span>
      </div>
      <div className="staff-summary small muted">
        {roles.tier1 ?? 0} Tier 1 · {roles.tier2 ?? 0} Tier 2{roles.dispatcher ? ' · dispatcher' : ''}
        {roles.internalIt ? ' · internal IT' : ''}
      </div>
      {GROUPS.map((group) => {
        const items = OFFICE_ITEMS.filter((it) => it.group === group && !it.done(state))
        if (items.length === 0) return null
        return (
          <div key={group}>
            <div className="shop-group">{group}</div>
            <ul className="upgrades">
              {items.map((it) => {
                const blocked = it.blocked(state)
                const cost = it.cost(state)
                return (
                  <li key={it.id} className={`upgrade${blocked ? ' locked' : ''}`}>
                    <div className="upgrade-text">
                      <div className="upgrade-name">{it.name}</div>
                      <div className="upgrade-effect">{blocked ? `Needs: ${blocked}` : it.effect}</div>
                    </div>
                    <button
                      className="buy"
                      disabled={!!blocked || state.money < cost}
                      onClick={() => dispatch({ type: 'buyOffice', id: it.id })}
                    >
                      {money(cost)}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
