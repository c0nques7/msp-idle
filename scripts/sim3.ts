// Stage 3 balance bot: answers events with a short delay, keeps sites staffed,
// and buys growth in a simple greedy order.
// Build: npx esbuild scripts/sim3.ts --bundle --platform=node --outfile=<out>.cjs && node <out>.cjs
import { reducer, newGame, type GameState } from '../src/game/engine'
import { EVENTS } from '../src/game/regionContent'
import { REGION_ITEMS, clientsPerTech, hireCost, marketingCost, regionIncome } from '../src/game/region'

const DT = 100
let s: GameState = reducer(newGame(7), { type: 'previewRegion' })
s = { ...s, money: 1000 }
const log = (t: string) => console.log(`${String(Math.floor(s.time / 60000)).padStart(3)}m${String(Math.floor((s.time / 1000) % 60)).padStart(2, '0')}s  ${t}`)
const seen = new Map<number, number>()
let wrongChance = 0.2

const ORDER = ['openSite', 'training', 'stack', 'openSite', 'acquire', 'vcio', 'noc', 'openSite', 'soc', 'openSite'] as const
let orderIdx = 0

while (s.time < 120 * 60_000 && !s.region!.complete) {
  s = reducer(s, { type: 'tick', dt: DT })
  const reg = s.region!

  // Events: think for 8 s, then answer; sometimes pick a wrong option first.
  for (const ev of reg.events) {
    if (!seen.has(ev.id)) seen.set(ev.id, s.time)
    if (s.time - seen.get(ev.id)! < 8000) continue
    const step = EVENTS[ev.kind].steps[ev.stepIndex]
    const wrong = step.options.findIndex((o, i) => o.kind !== 'right' && !ev.tried.includes(i))
    const right = step.options.findIndex((o) => o.kind === 'right')
    const choice = Math.random() < wrongChance && wrong >= 0 ? wrong : right
    s = reducer(s, { type: 'chooseEvent', id: ev.id, option: choice })
    seen.set(ev.id, s.time - 6000)
    break
  }

  // Staff any site that is over capacity.
  for (const site of s.region!.sites) {
    if (site.clients > site.techs * clientsPerTech(s) && s.money >= hireCost(site)) {
      s = reducer(s, { type: 'buySite', siteId: site.id, id: 'hireTech' })
    }
  }

  // Next growth purchase in order; marketing when a site has room.
  const next = ORDER[orderIdx]
  const item = next && REGION_ITEMS.find((x) => x.id === next)
  if (item && item.done(s)) orderIdx++
  else if (item && s.money >= item.cost(s)) {
    s = reducer(s, { type: 'buyRegion', id: item.id })
    log(`${item.id} (sites ${s.region!.sites.length}, income $${regionIncome(s).toFixed(0)}/s)`)
    orderIdx++
  } else if (item) {
    const site = s.region!.sites.find((x) => x.techs * clientsPerTech(s) - x.clients >= 5 && s.money >= marketingCost(x) + item.cost(s) * 0.3)
    if (site && marketingCost(site) < 15_000) s = reducer(s, { type: 'buySite', siteId: site.id, id: 'marketing' })
  }
  if (s.time % 300_000 < DT) log(`money $${Math.floor(s.money)}, region $${regionIncome(s).toFixed(0)}/s, health ${s.region!.sites.map((x) => Math.round(x.health)).join('/')}`)
}
log(s.region!.complete ? 'COMPLETE' : 'not complete')
console.log('sites', s.region!.sites.map((x) => `${x.name}: ${x.techs}t ${x.clients}c ${Math.round(x.health)}%`).join(' | '))
void wrongChance
