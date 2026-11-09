// Balance check: a simulated player works the queue and buys upgrades greedily.
// Run: npx esbuild scripts/sim.ts --bundle --platform=node --outfile=/tmp/sim.cjs && node /tmp/sim.cjs
import { newGame, reducer, has, idleRatePerSec, slots, type GameState } from '../src/game/engine'
import { UPGRADES, maxedOut, upgradeCost } from '../src/game/upgrades'

const SKILL = Number(process.env.SKILL ?? 0.75) // chance of picking the right step
const MINUTES = Number(process.env.MINUTES ?? 75)
const DT = 100

let s: GameState = reducer(newGame(1), { type: 'start' })
s = { ...s, hintsSeen: ['alert', 'reset', 'software', 'printer', 'outage'] }
let busyUntil = 0
const firsts: Record<string, number> = {}
const mark = (key: string) => {
  if (!(key in firsts)) firsts[key] = s.time
}

for (let t = 0; t < MINUTES * 60_000; t += DT) {
  s = reducer(s, { type: 'tick', dt: DT })
  if (s.showPromotion) {
    mark('promoted')
    s = reducer(s, { type: 'dismissPromotion' })
  }
  if (s.time < busyUntil) continue

  // Buy the cheapest affordable upgrade.
  const buyable = UPGRADES.filter((u) => u.unlocked(s) && !maxedOut(s, u) && upgradeCost(s, u) <= s.money).sort(
    (a, b) => upgradeCost(s, a) - upgradeCost(s, b),
  )
  if (buyable.length) {
    const u = buyable[0]
    s = reducer(s, { type: 'buy', id: u.id })
    mark(u.id === 'junior' ? `junior${s.juniors}` : u.id)
    busyUntil = s.time + 500
    continue
  }

  // Fill free screens, outages first.
  const queue = s.tickets.filter((x) => !x.active)
  if (s.tickets.filter((x) => x.active).length < slots(s) && queue.length) {
    const next = queue.find((x) => x.kind === 'outage') ?? queue[0]
    s = reducer(s, { type: 'pick', id: next.id })
    busyUntil = s.time + 600
    continue
  }

  const active = s.tickets.find((x) => x.active)
  if (!active) continue
  if (active.kind === 'alert') {
    if (active.falsePositive && Math.random() < 0.85) {
      s = reducer(s, { type: 'falsePositive', id: active.id })
      busyUntil = s.time + 1500
    } else {
      s = reducer(s, { type: 'work', id: active.id })
      busyUntil = s.time + 250
    }
  } else {
    const step = active.steps![active.stepIndex!]
    const right = step.options.findIndex((o) => o.kind === 'right')
    const wrong = step.options.map((_, i) => i).filter((i) => i !== right && !active.tried!.includes(i))
    const choice = Math.random() < SKILL || wrong.length === 0 ? right : wrong[0]
    s = reducer(s, { type: 'choose', id: active.id, option: choice })
    busyUntil = s.time + 3000
  }
  if (s.reputation >= 3) mark('rep3')
  if (s.reputation >= 4) mark('rep4')
}

const fmt = (ms: number) => `${Math.floor(ms / 60000)}m${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}s`
console.log(`skill ${SKILL}, ${MINUTES} min`)
for (const [k, v] of Object.entries(firsts).sort((a, b) => a[1] - b[1])) console.log(`${fmt(v).padStart(7)}  ${k}`)
console.log(
  `end: money $${Math.floor(s.money)}, earned $${Math.floor(s.totalEarned)}, rep ${s.reputation.toFixed(2)}, closed ${s.ticketsClosed}, breaches ${s.breaches}, juniors ${s.juniors}, senior ${has(s, 'senior')}, queue ${s.tickets.length}, idle $${idleRatePerSec(s).toFixed(2)}/s`,
)
