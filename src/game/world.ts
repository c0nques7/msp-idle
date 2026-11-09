// Stage 4: the global MSP. Your stage 3 region is home; you expand into world
// regions, each run by local offices, and handle global events.
import { addFeed, addToast, clampRep, type GameState } from './engine'
import { siteName, type RegionEvent } from './region'
import type { Outcome } from './regionContent'
import {
  OFFICE_CAPACITY,
  OFFICE_WAGE,
  WORLD_EVENTS,
  WORLD_REVENUE_PER_CLIENT,
  WORLD_SLOTS,
  type WorldEventKind,
} from './worldContent'

export interface WorldRegion {
  id: number
  slot: number
  offices: number
  clients: number
  health: number
  officeBuys: number
  marketing: number
}

export interface WorldEvent extends Omit<RegionEvent, 'kind' | 'siteId'> {
  kind: WorldEventKind
  regionId: number
}

export type GlobalId = 'gdpr' | 'currency' | 'leadership' | 'channel' | 'sun' | 'gsoc' | 'aiDesk' | 'ipo'

export interface WorldState {
  regions: WorldRegion[]
  services: Partial<Record<GlobalId, boolean>>
  events: WorldEvent[]
  eventTimer: number
  nextEventId: number
  introPlayed: boolean
  complete: boolean
  showComplete: boolean
}

const EVENT_MS = 60_000
const SLOW_PENALTY = 8_000
const RISKY_PENALTY = 15_000
const MAX_EVENTS = 2

const w = (s: GameState) => s.world!
const withWorld = (s: GameState, patch: Partial<WorldState>): GameState => ({ ...s, world: { ...w(s), ...patch } })
const withRegion = (s: GameState, id: number, patch: Partial<WorldRegion>): GameState =>
  withWorld(s, { regions: w(s).regions.map((x) => (x.id === id ? { ...x, ...patch } : x)) })

export const regionName = (r: WorldRegion) => WORLD_SLOTS[r.slot].name
export const hasG = (s: GameState, id: GlobalId) => !!s.world?.services[id]

/** Moves a finished stage 3 game onto the world map. */
export function enterWorld(s: GameState): GameState {
  if (!s.region) return s
  s = {
    ...s,
    stage: 4,
    region: { ...s.region, showComplete: false },
    world: { regions: [], services: {}, events: [], eventTimer: 30_000, nextEventId: 1, introPlayed: false, complete: false, showComplete: false },
  }
  s = addToast(s, 'good', 'You are now CEO. Time to go global.')
  return addFeed(s, 'info', 'The private equity deal closed. Your home region keeps running while you expand worldwide.')
}

/** A ready-made stage 4 save, for trying the world map without replaying earlier stages. */
export function previewWorld(s: GameState): GameState {
  if (!s.region) return s
  const hq = s.region.sites[0]
  const extra = [1, 2, 3, 4].map((slot) => ({ ...hq, id: slot + 1, slot, hq: false, name: siteName(s, slot), techs: 6, clients: 28, hires: 3, marketing: 2 }))
  s = {
    ...s,
    region: {
      ...s.region,
      sites: [{ ...hq, techs: 14, clients: 66 }, ...extra],
      services: { noc: true, soc: true, stack: true, vcio: true, training: true },
      acquired: true,
      opened: 3,
      complete: true,
      introPlayed: true,
    },
  }
  s = enterWorld(s)
  return { ...s, money: 110_000, totalEarned: 900_000 }
}

// ----- Economy -----

export const officeCapacity = (s: GameState) => (hasG(s, 'aiDesk') ? 40 : OFFICE_CAPACITY)
export function worldRevenuePerClient(s: GameState): number {
  const bonus = (id: GlobalId, n: number) => (hasG(s, id) ? n : 0)
  return WORLD_REVENUE_PER_CLIENT * (1 + bonus('sun', 0.1) + bonus('gsoc', 0.1) + bonus('gdpr', 0.05) + bonus('currency', 0.05))
}
export function worldRegionIncome(s: GameState, r: WorldRegion): number {
  return r.clients * worldRevenuePerClient(s) * (r.health / 100) - r.offices * OFFICE_WAGE
}
export function worldIncome(s: GameState): number {
  return s.world ? s.world.regions.reduce((sum, x) => sum + worldRegionIncome(s, x), 0) : 0
}
export function worldHealthDrift(s: GameState, r: WorldRegion): number {
  const capacity = r.offices * officeCapacity(s)
  if (r.clients <= capacity) return 1.5
  const over = (r.clients - capacity) / r.clients
  return -over * 6 * (hasG(s, 'sun') ? 0.5 : 1)
}

// ----- Tick -----

export function worldTick(s: GameState, dt: number): GameState {
  if (!s.world) return s
  const sec = dt / 1000
  const income = worldIncome(s) * sec
  s = { ...s, money: Math.max(0, s.money + income), totalEarned: s.totalEarned + Math.max(0, income) }
  s = withWorld(s, {
    regions: w(s).regions.map((x) => ({ ...x, health: Math.max(0, Math.min(100, x.health + worldHealthDrift(s, x) * sec)) })),
  })
  for (const ev of w(s).events) {
    if (s.time > ev.deadline) s = resolveEvent(s, ev, 'timeout')
  }
  let timer = w(s).eventTimer - dt
  if (timer <= 0) {
    timer = 40_000 + Math.random() * 30_000
    if (w(s).events.length < MAX_EVENTS) s = spawnEvent(s)
  }
  return withWorld(s, { eventTimer: timer })
}

function spawnEvent(s: GameState): GameState {
  const busy = new Set(w(s).events.map((e) => e.regionId))
  const regions = w(s).regions.filter((x) => !busy.has(x.id))
  if (regions.length === 0) return s
  const region = regions[Math.floor(Math.random() * regions.length)]
  const active = new Set(w(s).events.map((e) => e.kind))
  const kinds = (Object.keys(WORLD_EVENTS) as WorldEventKind[]).filter((k) => !active.has(k))
  const kind = kinds[Math.floor(Math.random() * kinds.length)]
  const ev: WorldEvent = { id: w(s).nextEventId, kind, regionId: region.id, stepIndex: 0, tried: [], mistakes: 0, deadline: s.time + EVENT_MS }
  s = withWorld(s, { events: [...w(s).events, ev], nextEventId: w(s).nextEventId + 1 })
  s = addToast(s, 'info', `${regionName(region)}: ${WORLD_EVENTS[kind].label}`)
  return addFeed(s, 'info', `New event in ${regionName(region)}: ${WORLD_EVENTS[kind].label}.`)
}

function applyOutcome(s: GameState, r: WorldRegion, o: Outcome, scale: number): GameState {
  const round = (n: number | undefined) => Math.round((n ?? 0) * scale)
  s = withRegion(s, r.id, {
    health: Math.max(0, Math.min(100, r.health + round(o.health))),
    clients: Math.max(1, r.clients + round(o.clients)),
    offices: Math.max(1, r.offices + round(o.techs)),
  })
  if (o.money) s = { ...s, money: Math.max(0, s.money + round(o.money)) }
  return s
}

export function worldOutcomeText(o: Outcome): string {
  const parts: string[] = []
  if (o.clients) parts.push(`${o.clients > 0 ? '+' : ''}${o.clients} clients`)
  if (o.techs) parts.push(`${o.techs > 0 ? '+' : ''}${o.techs} office`)
  if (o.health) parts.push(`${o.health > 0 ? '+' : ''}${o.health}% health`)
  if (o.money) parts.push(`${o.money > 0 ? '+' : '-'}$${Math.abs(o.money).toLocaleString()}`)
  return parts.join(', ') || 'no change'
}

/** Global services that guarantee a good outcome for an event. */
export function eventCovered(s: GameState, kind: WorldEventKind): boolean {
  const info = WORLD_EVENTS[kind]
  return (!!info.security && hasG(s, 'gsoc')) || (!!info.privacy && hasG(s, 'gdpr')) || (!!info.currency && hasG(s, 'currency'))
}

function resolveEvent(s: GameState, ev: WorldEvent, how: 'done' | 'timeout'): GameState {
  const info = WORLD_EVENTS[ev.kind]
  const region = w(s).regions.find((x) => x.id === ev.regionId)
  s = withWorld(s, { events: w(s).events.filter((x) => x.id !== ev.id) })
  if (!region) return s
  const name = regionName(region)
  const covered = eventCovered(s, ev.kind)
  if (covered || (how === 'done' && ev.mistakes === 0)) {
    s = applyOutcome(s, region, info.success, 1)
    s = { ...s, reputation: clampRep(s.reputation + 0.05) }
    s = addToast(s, 'good', `${name}: ${info.successText}`)
    return addFeed(s, 'good', `${name}: ${info.label} handled well (${worldOutcomeText(info.success)}).`, covered && how === 'timeout' ? 'Your global services handled it.' : info.successText)
  }
  const scale = (how === 'timeout' ? 1 : 0.5) * (hasG(s, 'leadership') ? 0.5 : 1)
  s = applyOutcome(s, region, info.fail, scale)
  s = { ...s, reputation: clampRep(s.reputation - 0.1) }
  s = addToast(s, 'bad', `${name}: ${info.failText}`)
  return addFeed(s, 'bad', `${name}: ${info.label} went badly.`, how === 'timeout' ? 'Nobody made the call in time.' : 'A risky call made it worse.')
}

export function chooseWorldEventStep(s: GameState, id: number, option: number): GameState {
  if (!s.world) return s
  const ev = w(s).events.find((x) => x.id === id)
  if (!ev) return s
  const opt = WORLD_EVENTS[ev.kind].steps[ev.stepIndex]?.options[option]
  if (!opt || ev.tried.includes(option)) return s
  const update = (patch: Partial<WorldEvent>) => withWorld(s, { events: w(s).events.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  if (opt.kind === 'right') {
    const next = ev.stepIndex + 1
    if (next >= WORLD_EVENTS[ev.kind].steps.length) return resolveEvent(s, ev, 'done')
    return update({ stepIndex: next, tried: [], feedback: { kind: 'right', text: opt.why } })
  }
  const penalty = (opt.kind === 'risky' ? RISKY_PENALTY : SLOW_PENALTY) * (hasG(s, 'leadership') ? 0.5 : 1)
  return update({
    tried: [...ev.tried, option],
    deadline: ev.deadline - penalty,
    mistakes: ev.mistakes + (opt.kind === 'risky' ? 1 : 0),
    feedback: { kind: opt.kind, text: opt.why },
  })
}

// ----- Purchases -----

export type WorldRegionItemId = 'office' | 'campaign'
export const officeCost = (r: WorldRegion) => Math.round(15_000 * Math.pow(1.15, r.officeBuys))
export const campaignCost = (r: WorldRegion) => Math.round(20_000 * Math.pow(1.3, r.marketing))
export const campaignClients = (s: GameState) => (hasG(s, 'channel') ? 25 : 15)

export interface GlobalItem {
  id: GlobalId
  name: string
  cost: number
  effect: string
  blocked: (s: GameState) => string | null
}

const openCount = (s: GameState) => s.world?.regions.length ?? 0

export const GLOBAL_ITEMS: GlobalItem[] = [
  { id: 'gdpr', name: 'GDPR and data residency program', cost: 80_000, effect: 'Required to enter Europe. Privacy events always end well. +5% revenue.', blocked: () => null },
  { id: 'currency', name: 'Multi-currency billing', cost: 60_000, effect: 'Required to enter Asia Pacific. Currency events always end well. +5% revenue.', blocked: () => null },
  { id: 'leadership', name: 'Regional leadership team', cost: 90_000, effect: 'Wrong calls in global events cost half as much.', blocked: () => null },
  { id: 'channel', name: 'Global partner channel', cost: 120_000, effect: 'Marketing campaigns bring 25 clients instead of 15.', blocked: () => null },
  {
    id: 'sun',
    name: 'Follow-the-sun support',
    cost: 200_000,
    effect: 'Three time zones hand work around the clock: health falls half as fast. +10% revenue.',
    blocked: (s) => (openCount(s) < 2 ? 'Open 2 world regions' : null),
  },
  { id: 'gsoc', name: 'Global SOC', cost: 250_000, effect: 'Security events always end well. +10% revenue.', blocked: () => null },
  { id: 'aiDesk', name: 'AI-assisted service desk', cost: 300_000, effect: 'Each office supports 40 clients instead of 25.', blocked: () => null },
  {
    id: 'ipo',
    name: 'IPO readiness',
    cost: 600_000,
    effect: 'Audited financials, SOC 2 and a board. Needed to go public.',
    blocked: (s) => (openCount(s) < WORLD_SLOTS.length - 1 ? 'Operate in every region' : null),
  },
]

export function regionEntryBlocked(s: GameState, slot: number): string | null {
  const need = WORLD_SLOTS[slot].needs
  if (need && !hasG(s, need)) return `Needs ${GLOBAL_ITEMS.find((x) => x.id === need)!.name}`
  return null
}

export function enterWorldRegion(s: GameState, slot: number): GameState {
  if (!s.world || slot <= 0 || slot >= WORLD_SLOTS.length) return s
  if (w(s).regions.some((x) => x.slot === slot) || regionEntryBlocked(s, slot)) return s
  const cost = WORLD_SLOTS[slot].cost
  if (s.money < cost) return s
  const id = (w(s).regions.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1
  s = { ...s, money: s.money - cost }
  s = withWorld(s, { regions: [...w(s).regions, { id, slot, offices: 1, clients: 20, health: 100, officeBuys: 0, marketing: 0 }] })
  s = addFeed(s, 'good', `Opened an office in ${WORLD_SLOTS[slot].name}.`)
  return checkComplete(s)
}

export function buyWorldRegionItem(s: GameState, regionId: number, id: WorldRegionItemId): GameState {
  if (!s.world) return s
  const r = w(s).regions.find((x) => x.id === regionId)
  if (!r) return s
  const cost = id === 'office' ? officeCost(r) : campaignCost(r)
  if (s.money < cost) return s
  s = { ...s, money: s.money - cost }
  if (id === 'office') {
    s = withRegion(s, r.id, { offices: r.offices + 1, officeBuys: r.officeBuys + 1 })
    return addFeed(s, 'info', `Opened another office in ${regionName(r)}.`)
  }
  const n = campaignClients(s)
  s = withRegion(s, r.id, { clients: r.clients + n, marketing: r.marketing + 1 })
  return addFeed(s, 'info', `A campaign in ${regionName(r)} brought in ${n} clients.`)
}

export function buyGlobal(s: GameState, id: GlobalId): GameState {
  if (!s.world || hasG(s, id)) return s
  const item = GLOBAL_ITEMS.find((x) => x.id === id)
  if (!item || item.blocked(s) || s.money < item.cost) return s
  s = { ...s, money: s.money - item.cost }
  s = withWorld(s, { services: { ...w(s).services, [id]: true } })
  s = addFeed(s, 'info', `Launched ${item.name}.`)
  return checkComplete(s)
}

export const worldProgress = (s: GameState) => ({
  regions: 1 + openCount(s),
  total: WORLD_SLOTS.length,
  sun: hasG(s, 'sun'),
  gsoc: hasG(s, 'gsoc'),
  ipo: hasG(s, 'ipo'),
})

function checkComplete(s: GameState): GameState {
  const p = worldProgress(s)
  if (w(s).complete || p.regions < p.total || !p.sun || !p.gsoc || !p.ipo) return s
  s = withWorld(s, { complete: true, showComplete: true })
  return addFeed(s, 'good', 'Every region, follow-the-sun, a global SOC and audited books. You rang the bell. Stage 4 complete!')
}
