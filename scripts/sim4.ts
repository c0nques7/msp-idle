// Stage 4 balance bot: answers events with a short delay, keeps regions staffed,
// and buys growth in a simple greedy order.
// Build: npx esbuild scripts/sim4.ts --bundle --platform=node --outfile=<out>.cjs && node <out>.cjs
import { reducer, newGame, idleRatePerSec, type GameState } from '../src/game/engine'
import { EVENTS } from '../src/game/regionContent'
import { WORLD_EVENTS, WORLD_SLOTS } from '../src/game/worldContent'
import { GLOBAL_ITEMS, campaignCost, officeCapacity, officeCost, regionEntryBlocked, worldIncome } from '../src/game/world'

const DT = 100
let s: GameState = reducer(newGame(11), { type: 'previewWorld' })
const log = (t: string) => console.log(`${String(Math.floor(s.time / 60000)).padStart(3)}m${String(Math.floor((s.time / 1000) % 60)).padStart(2, '0')}s  ${t}`)
const seen = new Map<string, number>()
const WRONG = 0.2

type Step = { region: number } | { global: (typeof GLOBAL_ITEMS)[number]['id'] }
const ORDER: Step[] = [
  { region: 1 },
  { global: 'leadership' },
  { global: 'gdpr' },
  { region: 2 },
  { global: 'channel' },
  { region: 3 },
  { global: 'sun' },
  { global: 'currency' },
  { region: 4 },
  { global: 'gsoc' },
  { global: 'aiDesk' },
  { region: 5 },
  { global: 'ipo' },
]
let idx = 0

function answer(key: string, steps: { options: { kind: string }[] }[], ev: { id: number; stepIndex: number; tried: number[] }, act: (option: number) => void) {
  if (!seen.has(key)) seen.set(key, s.time)
  if (s.time - seen.get(key)! < 8000) return false
  const step = steps[ev.stepIndex]
  const wrong = step.options.findIndex((o, i) => o.kind !== 'right' && !ev.tried.includes(i))
  const right = step.options.findIndex((o) => o.kind === 'right')
  act(Math.random() < WRONG && wrong >= 0 ? wrong : right)
  seen.set(key, s.time - 6000)
  return true
}

while (s.time < 150 * 60_000 && !s.world!.complete) {
  s = reducer(s, { type: 'tick', dt: DT })
  for (const ev of s.world!.events) {
    if (answer('w' + ev.id, WORLD_EVENTS[ev.kind].steps, ev, (option) => (s = reducer(s, { type: 'chooseWorldEvent', id: ev.id, option })))) break
  }
  for (const ev of s.region!.events) {
    if (answer('r' + ev.id, EVENTS[ev.kind].steps, ev, (option) => (s = reducer(s, { type: 'chooseEvent', id: ev.id, option })))) break
  }
  for (const r of s.world!.regions) {
    if (r.clients > r.offices * officeCapacity(s) && s.money >= officeCost(r)) s = reducer(s, { type: 'buyWorldRegion', regionId: r.id, id: 'office' })
  }
  const step = ORDER[idx]
  if (step) {
    const cost = 'region' in step ? WORLD_SLOTS[step.region].cost : GLOBAL_ITEMS.find((x) => x.id === step.global)!.cost
    const blocked = 'region' in step ? regionEntryBlocked(s, step.region) : GLOBAL_ITEMS.find((x) => x.id === step.global)!.blocked(s)
    if (blocked) {
      log(`blocked: ${blocked}`)
      idx++
    } else if (s.money >= cost) {
      s = 'region' in step ? reducer(s, { type: 'enterWorldRegion', slot: step.region }) : reducer(s, { type: 'buyGlobal', id: step.global })
      log(`${'region' in step ? WORLD_SLOTS[step.region].name : step.global} (world $${worldIncome(s).toFixed(0)}/s, total $${idleRatePerSec(s).toFixed(0)}/s)`)
      idx++
    } else {
      const r = s.world!.regions.find((x) => x.offices * officeCapacity(s) - x.clients >= 10 && s.money >= campaignCost(x) + cost * 0.3)
      if (r && campaignCost(r) < 120_000) s = reducer(s, { type: 'buyWorldRegion', regionId: r.id, id: 'campaign' })
    }
  }
  if (s.time % 300_000 < DT) log(`money $${Math.floor(s.money)}, world $${worldIncome(s).toFixed(0)}/s, total $${idleRatePerSec(s).toFixed(0)}/s`)
}
log(s.world!.complete ? 'COMPLETE' : 'not complete')
console.log(s.world!.regions.map((r) => `${WORLD_SLOTS[r.slot].name}: ${r.offices}o ${r.clients}c ${Math.round(r.health)}%`).join(' | '))
