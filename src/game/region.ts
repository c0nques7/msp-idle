// Stage 3: the regional map. Sites run themselves; the player makes decisions
// that affect whole sites and buys company-wide services.
import { addFeed, addToast, clampRep, type Feedback, type GameState } from './engine'
import { mulberry32, pick } from './names'
import { EVENTS, REVENUE_PER_CLIENT, SITE_SLOTS, TECH_WAGE, type EventKind, type Outcome } from './regionContent'

export interface Site {
  id: number
  slot: number
  name: string
  hq: boolean
  techs: number
  clients: number
  /** 0 to 100. */
  health: number
  hires: number
  marketing: number
}

export interface RegionEvent {
  id: number
  kind: EventKind
  siteId: number
  stepIndex: number
  tried: number[]
  mistakes: number
  deadline: number
  feedback?: Feedback
}

export type ServiceId = 'noc' | 'stack' | 'soc' | 'vcio' | 'training' | 'recruiting' | 'baas' | 'comanaged' | 'automation' | 'referral'

export interface RegionState {
  sites: Site[]
  services: Partial<Record<ServiceId, boolean>>
  acquired: boolean
  opened: number
  events: RegionEvent[]
  eventTimer: number
  nextEventId: number
  introPlayed: boolean
  complete: boolean
  showComplete: boolean
}

export const EVENT_MS = 60_000
const SLOW_PENALTY = 8_000
const RISKY_PENALTY = 15_000
const MAX_EVENTS = 2

const TOWN_A = ['North', 'South', 'East', 'West', 'Upper', 'Lower', 'New', 'Old']
const TOWN_B = ['Ridge', 'Harbor', 'Falls', 'Crossing', 'Valley', 'Junction', 'Mill', 'Park', 'Bend', 'Fields']

function townNames(seed: number): string[] {
  const rng = mulberry32(seed ^ 0x5eed)
  const names = new Set<string>()
  while (names.size < SITE_SLOTS) names.add(`${pick(rng, TOWN_A)} ${pick(rng, TOWN_B)}`)
  return [...names]
}

const r = (s: GameState) => s.region!
const withRegion = (s: GameState, patch: Partial<RegionState>): GameState => ({ ...s, region: { ...r(s), ...patch } })
const withSite = (s: GameState, id: number, patch: Partial<Site>): GameState =>
  withRegion(s, { sites: r(s).sites.map((x) => (x.id === id ? { ...x, ...patch } : x)) })

export function siteName(s: GameState, slot: number): string {
  return townNames(s.seed)[slot]
}

/** Moves a finished stage 2 game onto the map. */
export function enterRegion(s: GameState): GameState {
  if (!s.office) return s
  const hq: Site = { id: 1, slot: 0, name: `${siteName(s, 0)} (HQ)`, hq: true, techs: 6, clients: 24, health: 100, hires: 0, marketing: 0 }
  s = {
    ...s,
    stage: 3,
    office: { ...s.office, showComplete: false },
    region: {
      sites: [hq],
      services: {},
      acquired: false,
      opened: 0,
      events: [],
      eventTimer: 25_000,
      nextEventId: 1,
      introPlayed: false,
      complete: false,
      showComplete: false,
    },
  }
  s = addToast(s, 'good', 'You are now Director of Operations.')
  return addFeed(s, 'info', 'Moved up to the regional map. HQ keeps running the help desk while you grow new sites.')
}

/** A ready-made stage 3 save, for trying the map without replaying stages 1 and 2. */
export function previewRegion(s: GameState): GameState {
  if (!s.office) return s
  s = { ...s, office: { ...s.office, built: { ...s.office.built, closet: true, expansion: true }, complete: true, introPlayed: true } }
  s = enterRegion(s)
  return { ...s, money: 8000, totalEarned: 120_000, reputation: 4.5 }
}

// ----- Economy -----

export const has3 = (s: GameState, id: ServiceId) => !!s.region?.services[id]
export const clientsPerTech = (s: GameState) => 4 + (has3(s, 'stack') ? 1 : 0) + (has3(s, 'automation') ? 1 : 0)
export function revenuePerClient(s: GameState): number {
  const bonus = (id: ServiceId, n: number) => (has3(s, id) ? n : 0)
  return REVENUE_PER_CLIENT * (1 + bonus('vcio', 0.25) + bonus('soc', 0.1) + bonus('baas', 0.1) + bonus('comanaged', 0.15))
}
export function siteIncome(s: GameState, site: Site): number {
  return site.clients * revenuePerClient(s) * (site.health / 100) - site.techs * TECH_WAGE
}
export function regionIncome(s: GameState): number {
  return s.region ? s.region.sites.reduce((sum, x) => sum + siteIncome(s, x), 0) : 0
}
/** Health change per second: down when understaffed, up when there is room. */
export function healthDrift(s: GameState, site: Site): number {
  const capacity = site.techs * clientsPerTech(s)
  if (site.clients <= capacity) return 1.5
  const over = (site.clients - capacity) / site.clients
  return -over * 6 * (has3(s, 'noc') ? 0.5 : 1)
}

// ----- Tick -----

export function regionTick(s: GameState, dt: number): GameState {
  if (!s.region) return s
  const sec = dt / 1000
  const income = regionIncome(s) * sec
  s = { ...s, money: Math.max(0, s.money + income), totalEarned: s.totalEarned + Math.max(0, income) }
  s = withRegion(s, {
    sites: r(s).sites.map((x) => ({ ...x, health: Math.max(0, Math.min(100, x.health + healthDrift(s, x) * sec)) })),
  })

  for (const ev of r(s).events) {
    if (s.time > ev.deadline) s = resolveEvent(s, ev, 'timeout')
  }

  let timer = r(s).eventTimer - dt
  if (timer <= 0) {
    // Once you go global, your home region needs you less often.
    timer = s.stage === 4 ? 90_000 + Math.random() * 50_000 : 40_000 + Math.random() * 30_000
    if (r(s).events.length < MAX_EVENTS) s = spawnEvent(s)
  }
  return withRegion(s, { eventTimer: timer })
}

function spawnEvent(s: GameState): GameState {
  const reg = r(s)
  const busy = new Set(reg.events.map((e) => e.siteId))
  const sites = reg.sites.filter((x) => !busy.has(x.id))
  if (sites.length === 0) return s
  const site = sites[Math.floor(Math.random() * sites.length)]
  const active = new Set(reg.events.map((e) => e.kind))
  const kinds = (Object.keys(EVENTS) as EventKind[]).filter((k) => !active.has(k))
  const kind = kinds[Math.floor(Math.random() * kinds.length)]
  const ev: RegionEvent = { id: reg.nextEventId, kind, siteId: site.id, stepIndex: 0, tried: [], mistakes: 0, deadline: s.time + EVENT_MS }
  s = withRegion(s, { events: [...reg.events, ev], nextEventId: reg.nextEventId + 1 })
  s = addToast(s, 'info', `${site.name}: ${EVENTS[kind].label}`)
  return addFeed(s, 'info', `New event at ${site.name}: ${EVENTS[kind].label}.`)
}

function applyOutcome(s: GameState, site: Site, o: Outcome, scale: number): GameState {
  const round = (n: number | undefined) => Math.round((n ?? 0) * scale)
  const patch: Partial<Site> = {
    health: Math.max(0, Math.min(100, site.health + round(o.health))),
    clients: Math.max(1, site.clients + round(o.clients)),
    techs: Math.max(1, site.techs + round(o.techs)),
  }
  s = withSite(s, site.id, patch)
  if (o.money) s = { ...s, money: Math.max(0, s.money + round(o.money)) }
  return s
}

export function outcomeText(o: Outcome): string {
  const parts: string[] = []
  if (o.clients) parts.push(`${o.clients > 0 ? '+' : ''}${o.clients} clients`)
  if (o.health) parts.push(`${o.health > 0 ? '+' : ''}${o.health}% health`)
  if (o.techs) parts.push(`${o.techs} tech`)
  if (o.money) parts.push(`${o.money > 0 ? '+' : '-'}$${Math.abs(o.money).toLocaleString()}`)
  return parts.join(', ') || 'no change'
}

function resolveEvent(s: GameState, ev: RegionEvent, how: 'done' | 'timeout'): GameState {
  const info = EVENTS[ev.kind]
  const site = r(s).sites.find((x) => x.id === ev.siteId)
  s = withRegion(s, { events: r(s).events.filter((x) => x.id !== ev.id) })
  if (!site) return s
  const socSaves = (info.security && has3(s, 'soc')) || ((ev.kind === 'storm' || ev.kind === 'ransomware') && has3(s, 'baas'))
  if (socSaves || (how === 'done' && ev.mistakes === 0)) {
    s = applyOutcome(s, site, has3(s, 'referral') ? { ...info.success, clients: (info.success.clients ?? 0) + 2 } : info.success, 1)
    s = { ...s, reputation: clampRep(s.reputation + 0.05) }
    s = addToast(s, 'good', `${site.name}: ${info.successText}`)
    return addFeed(s, 'good', `${site.name}: ${info.label} handled well (${outcomeText(info.success)}).`, socSaves && how === 'timeout' ? 'Your services handled it.' : info.successText)
  }
  // Risky calls or no answer at all: the bad outcome lands, softened by training.
  const scale = (how === 'timeout' ? 1 : 0.5) * (has3(s, 'training') ? 0.5 : 1)
  s = applyOutcome(s, site, info.fail, scale)
  s = { ...s, reputation: clampRep(s.reputation - 0.1) }
  s = addToast(s, 'bad', `${site.name}: ${info.failText}`)
  const detail = how === 'timeout' ? 'Nobody made the call in time.' : 'A risky call made it worse.'
  return addFeed(s, 'bad', `${site.name}: ${info.label} went badly.`, detail)
}

export function chooseEventStep(s: GameState, id: number, option: number): GameState {
  if (!s.region) return s
  const ev = r(s).events.find((x) => x.id === id)
  if (!ev) return s
  const step = EVENTS[ev.kind].steps[ev.stepIndex]
  const opt = step?.options[option]
  if (!opt || ev.tried.includes(option)) return s
  const update = (patch: Partial<RegionEvent>) => withRegion(s, { events: r(s).events.map((x) => (x.id === id ? { ...x, ...patch } : x)) })
  if (opt.kind === 'right') {
    const next = ev.stepIndex + 1
    if (next >= EVENTS[ev.kind].steps.length) return resolveEvent(s, ev, 'done')
    return update({ stepIndex: next, tried: [], feedback: { kind: 'right', text: opt.why } })
  }
  const halve = has3(s, 'training') ? 0.5 : 1
  const penalty = (opt.kind === 'risky' ? RISKY_PENALTY : SLOW_PENALTY) * halve
  return update({
    tried: [...ev.tried, option],
    deadline: ev.deadline - penalty,
    mistakes: ev.mistakes + (opt.kind === 'risky' ? 1 : 0),
    feedback: { kind: opt.kind, text: opt.why },
  })
}

// ----- Purchases -----

export type SiteItemId = 'hireTech' | 'marketing'
export type RegionItemId = 'openSite' | 'acquire' | ServiceId

export const hireCost = (s: GameState, site: Site) => Math.round(2500 * Math.pow(1.12, site.hires) * (has3(s, 'recruiting') ? 0.75 : 1))
export const marketingCost = (site: Site) => Math.round(5000 * Math.pow(1.3, site.marketing))

export interface RegionItem {
  id: RegionItemId
  name: string
  effect: string
  cost: (s: GameState) => number
  done: (s: GameState) => boolean
  blocked: (s: GameState) => string | null
}

const slotsFull = (s: GameState) => r(s).sites.length >= SITE_SLOTS
const service = (id: ServiceId, name: string, cost: number, effect: string): RegionItem => ({
  id,
  name,
  effect,
  cost: () => cost,
  done: (s) => has3(s, id),
  blocked: () => null,
})

export const REGION_ITEMS: RegionItem[] = [
  {
    id: 'openSite',
    name: 'Open a new site',
    effect: 'A new branch with 2 techs and 8 clients.',
    cost: (s) => Math.round(20_000 * Math.pow(1.6, r(s).opened)),
    done: slotsFull,
    blocked: () => null,
  },
  {
    id: 'acquire',
    name: 'Acquire a competitor',
    effect: 'Their site joins you: 6 techs, 25 clients, 60% health.',
    cost: () => 80_000,
    done: (s) => r(s).acquired || slotsFull(s),
    blocked: () => null,
  },
  service('noc', 'Central NOC', 35_000, 'One team watches every site: health falls half as fast.'),
  service('stack', 'Standard tech stack', 35_000, 'Same tools everywhere: each tech supports 5 clients, not 4.'),
  service('soc', 'Security operations (SOC)', 50_000, 'Security events always end well. +10% revenue per client.'),
  service('vcio', 'Account managers (vCIO)', 45_000, 'Quarterly planning with every client: +25% revenue per client.'),
  service('training', 'Training program', 25_000, 'Wrong calls in events cost half as much.'),
  service('referral', 'Client referral program', 15_000, 'Every event you handle well also brings 2 referred clients.'),
  service('recruiting', 'Recruiting pipeline', 20_000, 'A steady bench of candidates: hiring techs costs 25% less.'),
  service('baas', 'Backup as a service', 30_000, 'Storms and ransomware always end well. +10% revenue per client.'),
  service('comanaged', 'Co-managed IT offering', 55_000, "Support clients' own IT teams: +15% revenue per client."),
  service('automation', 'Automation platform', 70_000, 'Scripts and RMM policies do the routine work: each tech supports 1 more client.'),
]

function addSite(s: GameState, site: Omit<Site, 'id' | 'slot' | 'name' | 'hq' | 'hires' | 'marketing'>, label: string): GameState {
  const used = new Set(r(s).sites.map((x) => x.slot))
  const slot = [...Array(SITE_SLOTS).keys()].find((i) => !used.has(i))!
  const id = Math.max(...r(s).sites.map((x) => x.id)) + 1
  const name = siteName(s, slot)
  s = withRegion(s, { sites: [...r(s).sites, { ...site, id, slot, name, hq: false, hires: 0, marketing: 0 }] })
  return addFeed(s, 'good', `${label} ${name}.`)
}

export function buyRegionItem(s: GameState, id: RegionItemId): GameState {
  if (!s.region) return s
  const item = REGION_ITEMS.find((x) => x.id === id)
  if (!item || item.done(s) || item.blocked(s)) return s
  const cost = item.cost(s)
  if (s.money < cost) return s
  s = { ...s, money: s.money - cost }
  if (id === 'openSite') {
    s = withRegion(s, { opened: r(s).opened + 1 })
    s = addSite(s, { techs: 2, clients: 8, health: 100 }, 'Opened a new site in')
  } else if (id === 'acquire') {
    s = withRegion(s, { acquired: true })
    s = addSite(s, { techs: 6, clients: 25, health: 60 }, 'Acquired a competitor in')
  } else {
    s = withRegion(s, { services: { ...r(s).services, [id]: true } })
    s = addFeed(s, 'info', `Launched ${item.name}.`)
  }
  return checkComplete(s)
}

export function buySiteItem(s: GameState, siteId: number, id: SiteItemId): GameState {
  if (!s.region) return s
  const site = r(s).sites.find((x) => x.id === siteId)
  if (!site) return s
  const cost = id === 'hireTech' ? hireCost(s, site) : marketingCost(site)
  if (s.money < cost) return s
  s = { ...s, money: s.money - cost }
  if (id === 'hireTech') {
    s = withSite(s, site.id, { techs: site.techs + 1, hires: site.hires + 1 })
    return addFeed(s, 'info', `Hired a tech at ${site.name}.`)
  }
  s = withSite(s, site.id, { clients: site.clients + 5, marketing: site.marketing + 1 })
  return addFeed(s, 'info', `Marketing at ${site.name} brought in 5 clients.`)
}

export const exitProgress = (s: GameState) => ({
  sites: s.region?.sites.length ?? 0,
  noc: has3(s, 'noc'),
  soc: has3(s, 'soc'),
})

function checkComplete(s: GameState): GameState {
  const p = exitProgress(s)
  if (r(s).complete || p.sites < SITE_SLOTS || !p.noc || !p.soc) return s
  s = withRegion(s, { complete: true, showComplete: true })
  return addFeed(s, 'good', 'Five sites, a NOC and a SOC. Stage 3 complete!')
}
