// Stage 2 balance check: a simulated lead fixes office problems and buys the cheapest office item.
// Run: npx esbuild scripts/sim2.ts --bundle --platform=node --outfile=/tmp/sim2.cjs && node /tmp/sim2.cjs
import { newGame, reducer, type GameState } from '../src/game/engine'
import { OFFICE_ITEMS } from '../src/game/office'

const MINUTES = Number(process.env.MINUTES ?? 100)
const SKILL = Number(process.env.SKILL ?? 0.75)
const DT = 100
let s: GameState = reducer(newGame(2), { type: 'previewOffice' })
s = reducer(s, { type: 'introPlayed' })
let busyUntil = 0
const log: [number, string][] = []

for (let t = 0; t < MINUTES * 60_000; t += DT) {
  s = reducer(s, { type: 'tick', dt: DT })
  if (s.office!.showComplete) {
    log.push([s.time, 'COMPLETE'])
    break
  }
  if (s.time < busyUntil) continue
  const p = s.office!.problems[0]
  if (p) {
    const step = p.steps[p.stepIndex]
    const right = step.options.findIndex((o) => o.kind === 'right')
    const wrong = step.options.map((_, i) => i).filter((i) => i !== right && !p.tried.includes(i))
    s = reducer(s, { type: 'chooseProblem', id: p.id, option: Math.random() < SKILL || !wrong.length ? right : wrong[0] })
    busyUntil = s.time + 3500
    continue
  }
  // A sensible player's priorities; they save up for the first one they can't afford yet.
  const ORDER = ['hireTier1', 'trainTier2', 'closet', 'dispatcher', 'breakRoom', 'meshWifi', 'offsiteBackup', 'managedSwitch', 'internalIt', 'emailFilter', 'desk', 'expansion']
  const tier2Count = s.office!.staff.filter((x) => x.role === 'tier2').length
  const pick = ORDER.map((id) => OFFICE_ITEMS.find((it) => it.id === id)!).find(
    (it) => !it.done(s) && !it.blocked(s) && !(it.id === 'trainTier2' && tier2Count >= 3),
  )
  if (pick && pick.cost(s) <= s.money) {
    s = reducer(s, { type: 'buyOffice', id: pick.id })
    log.push([s.time, `${pick.id} (staff ${s.office!.staff.length}, $${Math.floor(s.money)})`])
    busyUntil = s.time + 800
  }
}
const fmt = (ms: number) => `${Math.floor(ms / 60000)}m${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}s`
for (const [t, k] of log) console.log(fmt(t).padStart(7), k)
console.log(`end ${fmt(s.time)}: staff ${s.office!.staff.length}, money $${Math.floor(s.money)}, rep ${s.reputation.toFixed(2)}, queue ${s.tickets.length}`)
