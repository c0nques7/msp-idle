import {
  ALERT_WORK,
  FALSE_ALERTS,
  FALSE_POSITIVE_PAYOUT,
  KINDS,
  OUTAGE_ALERT,
  OUTAGE_TEMPLATES,
  PRINTER_TEMPLATES,
  REAL_ALERTS,
  RESET_TEMPLATES,
  SOFTWARE_TEMPLATES,
  pickApp,
  type AlertTemplate,
  type ChoiceStep,
  type ChoiceTemplate,
  type OptionKind,
  type Priority,
  type TicketKind,
} from './content'
import { generateClients, generateHost, generateMspName, generateUser, mulberry32, pick, type Client } from './names'
import { UPGRADES, maxedOut, upgradeCost, type UpgradeId } from './upgrades'
import {
  buyOfficeItem,
  chooseProblemStep,
  enterOffice,
  officeIdleRate,
  officeSpawnInterval,
  officeTick,
  previewOffice,
  type OfficeItemId,
  type OfficeState,
} from './office'

export interface Feedback {
  kind: OptionKind | 'info'
  text: string
}

export interface Ticket {
  id: number
  kind: TicketKind
  clientIndex: number
  user: string
  subject: string
  body: string
  priority: Priority
  createdAt: number
  deadline: number
  slaMs: number
  breached: boolean
  active: boolean
  // Alerts
  falsePositive?: boolean
  work?: number
  workNeeded?: number
  // Choice tickets
  steps?: ChoiceStep[]
  stepIndex?: number
  tried?: number[]
  feedback?: Feedback
}

export interface FeedItem {
  id: number
  time: number
  tone: 'good' | 'bad' | 'info'
  text: string
  detail?: string
}

export interface Toast {
  id: number
  expires: number
  tone: 'good' | 'bad' | 'info'
  text: string
}

export interface WelcomeBack {
  seconds: number
  paidSeconds: number
  earned: number
  fullPay: boolean
}

export interface GameState {
  version: 3
  stage: 1 | 2
  office: OfficeState | null
  started: boolean
  seed: number
  mspName: string
  clients: Client[]
  time: number
  money: number
  totalEarned: number
  reputation: number
  ticketsClosed: number
  closedByKind: Record<TicketKind, number>
  alertsSeen: number
  breaches: number
  nextId: number
  spawnTimer: number
  tickets: Ticket[]
  upgrades: Partial<Record<UpgradeId, boolean>>
  juniors: number
  juniorTimer: number
  seniorTimer: number
  hintsSeen: TicketKind[]
  announced: UpgradeId[]
  feed: FeedItem[]
  toasts: Toast[]
  promoted: boolean
  showPromotion: boolean
  welcomeBack: WelcomeBack | null
  savedAt: number
}

export const QUEUE_LIMIT = 14
export const JUNIOR_INTERVAL = 4000
export const JUNIOR_WAGE = 2
export const SENIOR_INTERVAL = 3000
export const SENIOR_WAGE = 6
const SLOW_PENALTY = 10_000
const RISKY_PENALTY = 20_000
const TOAST_MS = 5000
const RMM_CHANCE = 0.6
const RMM_PAYOUT = 3
const PORTAL_PAYOUT = 4

export function newGame(seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  const rng = mulberry32(seed)
  return {
    version: 3,
    stage: 1,
    office: null,
    started: false,
    seed,
    mspName: generateMspName(rng),
    clients: generateClients(rng, 6),
    time: 0,
    money: 0,
    totalEarned: 0,
    reputation: 1,
    ticketsClosed: 0,
    closedByKind: { alert: 0, reset: 0, software: 0, printer: 0, outage: 0 },
    alertsSeen: 0,
    breaches: 0,
    nextId: 1,
    spawnTimer: 1500,
    tickets: [],
    upgrades: {},
    juniors: 0,
    juniorTimer: 0,
    seniorTimer: 0,
    hintsSeen: [],
    announced: ['secondMonitor', 'shortcuts'],
    feed: [],
    toasts: [],
    promoted: false,
    showPromotion: false,
    welcomeBack: null,
    savedAt: Date.now(),
  }
}

export const has = (s: GameState, id: UpgradeId) => !!s.upgrades[id]
export const slots = (s: GameState) => (has(s, 'thirdMonitor') ? 3 : has(s, 'secondMonitor') ? 2 : 1)
export const repMultiplier = (s: GameState) => 1 + s.reputation / 5
export const clickPower = (s: GameState) => (has(s, 'shortcuts') ? 2 : 1)
/** Tickets per second your hired techs can close in stage 1. */
export const techCapacity = (s: GameState) => (s.juniors * 1000) / JUNIOR_INTERVAL + (has(s, 'senior') ? 1000 / SENIOR_INTERVAL : 0)
/** New clients come with each hire, so techs always have paid work waiting. */
export const spawnInterval = (s: GameState) =>
  s.stage === 2 ? officeSpawnInterval(s) : 1000 / (1000 / Math.max(1500, 3500 - s.ticketsClosed * 8) + 0.85 * techCapacity(s))
export const wagesPerSec = (s: GameState) => s.juniors * JUNIOR_WAGE + (has(s, 'senior') ? SENIOR_WAGE : 0)

export function unlockedKinds(s: GameState): TicketKind[] {
  const kinds: TicketKind[] = ['alert', 'reset']
  if (s.totalEarned >= 100) kinds.push('software')
  if (s.ticketsClosed >= 25) kinds.push('printer')
  if (s.reputation >= 3 || s.closedByKind.outage > 0) kinds.push('outage')
  return kinds
}

export const WEIGHTS: Record<TicketKind, number> = { alert: 45, reset: 35, software: 20, printer: 15, outage: 5 }

/** Base pay for a ticket kind, before reputation and breach adjustments. */
export function basePayout(s: GameState, kind: TicketKind): number {
  const pay = KINDS[kind].payout
  if (has(s, 'remoteTool') && (kind === 'software' || kind === 'printer' || kind === 'outage')) return pay * 1.25
  return pay
}

export const clampRep = (r: number) => Math.max(0, Math.min(5, r))

export function addFeed(s: GameState, tone: FeedItem['tone'], text: string, detail?: string): GameState {
  const item: FeedItem = { id: s.nextId, time: s.time, tone, text, detail }
  return { ...s, nextId: s.nextId + 1, feed: [item, ...s.feed].slice(0, 8) }
}

export function addToast(s: GameState, tone: Toast['tone'], text: string): GameState {
  const toast: Toast = { id: s.nextId, expires: s.time + TOAST_MS, tone, text }
  return { ...s, nextId: s.nextId + 1, toasts: [...s.toasts, toast].slice(-4) }
}

export function earn(s: GameState, amount: number): GameState {
  return { ...s, money: s.money + amount, totalEarned: s.totalEarned + amount }
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}

export function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function buildChoiceSteps(template: ChoiceTemplate, vars: Record<string, string>): ChoiceStep[] {
  return template.steps.map((step) => ({
    prompt: step.prompt,
    options: shuffle(step.options.map((o) => ({ ...o, text: fill(o.text, vars) }))),
  }))
}

function rollKind(s: GameState): TicketKind {
  const kinds = unlockedKinds(s)
  const total = kinds.reduce((sum, k) => sum + WEIGHTS[k], 0)
  let roll = Math.random() * total
  for (const k of kinds) {
    roll -= WEIGHTS[k]
    if (roll <= 0) return k
  }
  return kinds[0]
}

function ticketBase(s: GameState, kind: TicketKind, clientIndex: number): Ticket {
  const info = KINDS[kind]
  const slaMs = info.slaMs * (has(s, 'slaDashboard') ? 1.25 : 1)
  return {
    id: s.nextId,
    kind,
    clientIndex,
    user: generateUser(Math.random),
    subject: '',
    body: '',
    priority: info.priority,
    createdAt: s.time,
    deadline: s.time + slaMs,
    slaMs,
    breached: false,
    active: false,
  }
}

function makeAlert(s: GameState, clientIndex: number, template?: AlertTemplate): Ticket {
  const rng = Math.random
  const client = s.clients[clientIndex]
  const vars = { host: generateHost(rng, client) }
  const falsePositive = template ? false : rng() < 0.3
  const t = template ?? pick(rng, falsePositive ? FALSE_ALERTS : REAL_ALERTS)
  return {
    ...ticketBase(s, 'alert', clientIndex),
    user: 'RMM agent',
    subject: fill(t.subject, vars),
    body: fill(t.body, vars),
    falsePositive,
    work: 0,
    workNeeded: ALERT_WORK,
  }
}

function makeTicket(s: GameState, kind: TicketKind): Ticket {
  const rng = Math.random
  const clientIndex = Math.floor(rng() * s.clients.length)
  if (kind === 'alert') return makeAlert(s, clientIndex)
  const base = ticketBase(s, kind, clientIndex)
  const client = s.clients[clientIndex]
  const vars: Record<string, string> = {
    user: base.user.split(' ')[0],
    client: client.name,
    host: generateHost(rng, client),
    app: pickApp(rng),
  }
  const templates =
    kind === 'reset' ? RESET_TEMPLATES : kind === 'software' ? SOFTWARE_TEMPLATES : kind === 'printer' ? PRINTER_TEMPLATES : OUTAGE_TEMPLATES
  const t = pick(rng, templates)
  let steps = buildChoiceSteps(t, vars)
  // Canned responses handle the final step of a password reset.
  if (kind === 'reset' && has(s, 'canned')) steps = steps.slice(0, 1)
  return { ...base, subject: fill(t.subject, vars), body: fill(t.body, vars), steps, stepIndex: 0, tried: [] }
}

const queueFull = (s: GameState) => s.tickets.filter((t) => !t.active).length >= QUEUE_LIMIT

/** Adds an alert to the queue, unless automation handles it first. */
function receiveAlert(s: GameState, alert: Ticket): GameState {
  s = { ...s, nextId: Math.max(s.nextId, alert.id + 1), alertsSeen: s.alertsSeen + 1 }
  if (alert.falsePositive && has(s, 'autoTriage')) {
    return addFeed(earn(s, FALSE_POSITIVE_PAYOUT), 'info', `Auto-triage closed a false positive: ${alert.subject}. +$${FALSE_POSITIVE_PAYOUT}`)
  }
  if (!alert.falsePositive && has(s, 'rmm') && Math.random() < RMM_CHANCE) {
    return addFeed(earn(s, RMM_PAYOUT), 'info', `RMM fixed it automatically: ${alert.subject}. +$${RMM_PAYOUT}`)
  }
  if (queueFull(s)) return s
  return { ...s, tickets: [...s.tickets, alert] }
}

function spawn(s: GameState): GameState {
  const kind = rollKind(s)
  if (kind === 'reset' && has(s, 'portal') && Math.random() < 0.5) {
    return addFeed(earn(s, PORTAL_PAYOUT), 'info', `Self-service portal handled a password reset. +$${PORTAL_PAYOUT}`)
  }
  if (kind === 'alert') return receiveAlert(s, makeAlert(s, Math.floor(Math.random() * s.clients.length)))
  const ticket = makeTicket(s, kind)
  s = { ...s, nextId: s.nextId + 1 }
  if (!queueFull(s)) s = { ...s, tickets: [...s.tickets, ticket] }
  if (kind === 'outage') {
    s = addToast(s, 'bad', `Outage at ${s.clients[ticket.clientIndex].name}!`)
    // An outage sets off a burst of related alerts from the same client.
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) s = receiveAlert(s, makeAlert(s, ticket.clientIndex, OUTAGE_ALERT))
  }
  return s
}

interface CloseOpts {
  payout: number
  repGain?: number
  text: string
  by?: string
}

export function closeTicket(s: GameState, t: Ticket, opts: CloseOpts): GameState {
  const pay = Math.round(opts.payout * (t.breached ? 0.5 : 1) * repMultiplier(s))
  s = earn(s, pay)
  const repGain = t.breached ? 0 : (opts.repGain ?? (t.kind === 'outage' ? 0.25 : 0.05))
  s = {
    ...s,
    tickets: s.tickets.filter((x) => x.id !== t.id),
    reputation: clampRep(s.reputation + repGain),
    ticketsClosed: s.ticketsClosed + 1,
    closedByKind: { ...s.closedByKind, [t.kind]: s.closedByKind[t.kind] + 1 },
  }
  const client = s.clients[t.clientIndex]?.name ?? ''
  return addFeed(
    s,
    t.breached ? 'bad' : 'good',
    `${opts.by ?? 'Closed'}: ${t.subject} (${client}). +$${pay}${t.breached ? ' (SLA breached, half pay)' : ''}`,
    opts.text || undefined,
  )
}

export function techPayout(s: GameState, t: Ticket): number {
  return t.kind === 'alert' && t.falsePositive ? FALSE_POSITIVE_PAYOUT : basePayout(s, t.kind)
}

function updateTicket(s: GameState, id: number, patch: Partial<Ticket>): GameState {
  return { ...s, tickets: s.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
}

export type Action =
  | { type: 'tick'; dt: number }
  | { type: 'start' }
  | { type: 'reroll' }
  | { type: 'pick'; id: number }
  | { type: 'release'; id: number }
  | { type: 'work'; id: number }
  | { type: 'falsePositive'; id: number }
  | { type: 'choose'; id: number; option: number }
  | { type: 'escalate'; id: number }
  | { type: 'buy'; id: UpgradeId }
  | { type: 'dismissHint'; kind: TicketKind }
  | { type: 'dismissWelcome' }
  | { type: 'dismissPromotion' }
  | { type: 'reset' }
  | { type: 'enterOffice' }
  | { type: 'previewOffice' }
  | { type: 'buyOffice'; id: OfficeItemId }
  | { type: 'chooseProblem'; id: number; option: number }
  | { type: 'introPlayed' }
  | { type: 'dismissOfficeComplete' }

function runTechs(s: GameState, dt: number): GameState {
  const wages = (wagesPerSec(s) * dt) / 1000
  if (wages === 0 || s.money < wages) return s
  s = { ...s, money: s.money - wages }

  if (s.juniors > 0) {
    let timer = s.juniorTimer + dt * s.juniors
    while (timer >= JUNIOR_INTERVAL) {
      timer -= JUNIOR_INTERVAL
      const target = s.tickets.find((t) => !t.active && t.priority !== 'Critical')
      if (!target) {
        timer = 0
        break
      }
      s = closeTicket(s, target, { payout: techPayout(s, target), text: '', by: 'Junior tech closed' })
    }
    s = { ...s, juniorTimer: timer }
  }

  if (has(s, 'senior')) {
    let timer = s.seniorTimer + dt
    if (timer >= SENIOR_INTERVAL) {
      timer = 0
      const queue = s.tickets.filter((t) => !t.active)
      const target = queue.find((t) => t.kind === 'outage') ?? queue[0]
      if (target) s = closeTicket(s, target, { payout: techPayout(s, target), text: '', by: 'Senior tech closed' })
    }
    s = { ...s, seniorTimer: timer }
  }
  return s
}

function checkMilestones(s: GameState): GameState {
  for (const u of UPGRADES) {
    if (!s.announced.includes(u.id) && u.unlocked(s)) {
      s = { ...s, announced: [...s.announced, u.id] }
      s = addToast(s, 'info', `New upgrade available: ${u.name}`)
    }
  }
  if (!s.promoted && s.juniors >= 3 && s.reputation >= 4) {
    s = { ...s, promoted: true, showPromotion: true }
  }
  return s
}

function tick(s: GameState, dt: number): GameState {
  s = { ...s, time: s.time + dt }

  for (const t of s.tickets) {
    if (!t.breached && s.time > t.deadline) {
      s = updateTicket(s, t.id, { breached: true })
      s = { ...s, reputation: clampRep(s.reputation - 0.15), breaches: s.breaches + 1 }
      s = addFeed(s, 'bad', `SLA breached: ${t.subject}. Reputation down.`)
    } else if (t.breached && !t.active && s.time > t.deadline + t.slaMs) {
      // Left far too long: the client gives up and calls someone else.
      s = { ...s, tickets: s.tickets.filter((x) => x.id !== t.id), reputation: clampRep(s.reputation - 0.1) }
      s = addFeed(s, 'bad', `${s.clients[t.clientIndex]?.name} gave up waiting on: ${t.subject}.`)
    }
  }

  let spawnTimer = s.spawnTimer - dt
  s = { ...s, spawnTimer }
  while (spawnTimer <= 0) {
    s = spawn(s)
    spawnTimer += spawnInterval(s)
    s = { ...s, spawnTimer }
  }

  if (s.stage === 2) {
    s = officeTick(s, dt)
  } else {
    s = runTechs(s, dt)
    s = checkMilestones(s)
  }
  if (s.toasts.some((t) => t.expires <= s.time)) s = { ...s, toasts: s.toasts.filter((t) => t.expires > s.time) }
  return s
}

/**
 * Money per second the player's automation and staff make without them.
 * Used for earnings while the game is closed.
 */
export function idleRatePerSec(s: GameState): number {
  const spawnsPerSec = 1000 / spawnInterval(s)
  const kinds = unlockedKinds(s)
  const totalWeight = kinds.reduce((sum, k) => sum + WEIGHTS[k], 0)
  const rate = (k: TicketKind) => (kinds.includes(k) ? (spawnsPerSec * WEIGHTS[k]) / totalWeight : 0)
  const mult = repMultiplier(s)

  let income = 0
  let alertsLeft = rate('alert')
  if (has(s, 'autoTriage')) {
    income += alertsLeft * 0.3 * FALSE_POSITIVE_PAYOUT
    alertsLeft *= 0.7
  }
  if (has(s, 'rmm')) {
    income += alertsLeft * RMM_CHANCE * RMM_PAYOUT
    alertsLeft *= 1 - RMM_CHANCE
  }
  let resetsLeft = rate('reset')
  if (has(s, 'portal')) {
    income += resetsLeft * 0.5 * PORTAL_PAYOUT
    resetsLeft *= 0.5
  }

  // Staff work through whatever automation leaves behind.
  const manual: [number, number][] = [
    [alertsLeft, basePayout(s, 'alert')],
    [resetsLeft, basePayout(s, 'reset')],
    [rate('software'), basePayout(s, 'software')],
    [rate('printer'), basePayout(s, 'printer')],
  ]
  const manualRate = manual.reduce((sum, [r]) => sum + r, 0)
  const avgPay = manualRate > 0 ? manual.reduce((sum, [r, p]) => sum + r * p, 0) / manualRate : 0
  if (s.stage === 2 && s.office) return income + officeIdleRate(s, avgPay * mult)
  const juniorCapacity = (s.juniors * 1000) / JUNIOR_INTERVAL
  const seniorCapacity = has(s, 'senior') ? 1000 / SENIOR_INTERVAL : 0
  const outages = Math.min(rate('outage'), seniorCapacity)
  const worked = Math.min(manualRate, juniorCapacity + seniorCapacity - outages)
  income += (worked * avgPay + outages * basePayout(s, 'outage')) * mult

  return income - wagesPerSec(s)
}

/** Away time that pays out: 2 hours, or 8 with the On-call rotation. */
export const maxAwaySeconds = (s: GameState) => (has(s, 'onCall') ? 8 : 2) * 60 * 60

/** Applies earnings for time spent away from the game. */
export function applyAwayTime(s: GameState, now: number): GameState {
  if (!s.started) return { ...s, savedAt: now }
  const away = Math.max(0, (now - s.savedAt) / 1000)
  const seconds = Math.min(maxAwaySeconds(s), away)
  s = { ...s, savedAt: now }
  if (seconds < 60) return s
  const fullPay = has(s, 'onCall')
  const earned = Math.floor(Math.max(0, idleRatePerSec(s)) * seconds * (fullPay ? 1 : 0.5))
  if (earned <= 0) return s
  return { ...earn(s, earned), welcomeBack: { seconds: away, paidSeconds: seconds, earned, fullPay } }
}

export function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'tick':
      return s.started && !s.welcomeBack && !s.showPromotion && !s.office?.showComplete ? tick(s, a.dt) : s
    case 'enterOffice':
      return s.stage === 1 && s.promoted ? enterOffice(s) : s
    case 'previewOffice':
      return previewOffice(newGame())
    case 'buyOffice':
      return buyOfficeItem(s, a.id)
    case 'chooseProblem':
      return chooseProblemStep(s, a.id, a.option)
    case 'introPlayed':
      return s.office ? { ...s, office: { ...s.office, introPlayed: true } } : s
    case 'dismissOfficeComplete':
      return s.office ? { ...s, office: { ...s.office, showComplete: false } } : s
    case 'start':
      return { ...s, started: true }
    case 'reroll':
    case 'reset':
      return newGame()
    case 'dismissHint':
      return s.hintsSeen.includes(a.kind) ? s : { ...s, hintsSeen: [...s.hintsSeen, a.kind] }
    case 'dismissWelcome':
      return { ...s, welcomeBack: null }
    case 'dismissPromotion':
      return { ...s, showPromotion: false }
    case 'pick': {
      const active = s.tickets.filter((t) => t.active).length
      if (active >= slots(s)) return s
      return updateTicket(s, a.id, { active: true })
    }
    case 'release':
      return updateTicket(s, a.id, { active: false })
    case 'work': {
      const t = s.tickets.find((x) => x.id === a.id)
      if (!t || t.kind !== 'alert') return s
      const work = (t.work ?? 0) + clickPower(s)
      if (work < (t.workNeeded ?? ALERT_WORK)) return updateTicket(s, t.id, { work })
      if (t.falsePositive) {
        return closeTicket(s, t, { payout: FALSE_POSITIVE_PAYOUT, repGain: 0, text: 'That was a false positive. It could have been closed in one click.' })
      }
      return closeTicket(s, t, { payout: basePayout(s, 'alert'), text: '' })
    }
    case 'falsePositive': {
      const t = s.tickets.find((x) => x.id === a.id)
      if (!t || t.kind !== 'alert') return s
      if (t.falsePositive) return closeTicket(s, t, { payout: FALSE_POSITIVE_PAYOUT, repGain: 0.02, text: 'Good call, that was noise.' })
      // A real alert closed as noise comes back, and the client notices.
      s = updateTicket(s, t.id, {
        active: false,
        feedback: { kind: 'risky', text: 'This alert was real. It came back, and the client noticed.' },
      })
      s = { ...s, reputation: clampRep(s.reputation - 0.15) }
      return addFeed(s, 'bad', `That alert was real: ${t.subject}. It's back in the queue.`)
    }
    case 'choose': {
      const t = s.tickets.find((x) => x.id === a.id)
      if (!t || !t.steps || t.stepIndex === undefined) return s
      const step = t.steps[t.stepIndex]
      const option = step?.options[a.option]
      if (!option || t.tried?.includes(a.option)) return s
      const halve = has(s, 'knowledgeBase') ? 0.5 : 1
      if (option.kind === 'right') {
        const next = t.stepIndex + 1
        if (next >= t.steps.length) return closeTicket(s, t, { payout: basePayout(s, t.kind), text: option.why })
        return updateTicket(s, t.id, { stepIndex: next, tried: [], feedback: { kind: 'right', text: option.why } })
      }
      const penalty = (option.kind === 'risky' ? RISKY_PENALTY : SLOW_PENALTY) * halve
      s = updateTicket(s, t.id, {
        deadline: t.deadline - penalty,
        tried: [...(t.tried ?? []), a.option],
        feedback: { kind: option.kind, text: option.why },
      })
      if (option.kind === 'risky') s = { ...s, reputation: clampRep(s.reputation - 0.1) }
      return s
    }
    case 'escalate': {
      const t = s.tickets.find((x) => x.id === a.id)
      if (!t) return s
      return closeTicket(s, t, { payout: techPayout(s, t) / 2, repGain: 0, text: 'A senior tech took it.', by: 'Escalated' })
    }
    case 'buy': {
      const u = UPGRADES.find((x) => x.id === a.id)
      if (!u || maxedOut(s, u) || !u.unlocked(s)) return s
      const cost = upgradeCost(s, u)
      if (s.money < cost) return s
      s = { ...s, money: s.money - cost }
      if (u.id === 'junior') s = { ...s, juniors: s.juniors + 1 }
      else s = { ...s, upgrades: { ...s.upgrades, [u.id]: true } }
      return addFeed(s, 'info', u.id === 'junior' ? `Hired junior tech #${s.juniors}.` : `Bought ${u.name}.`)
    }
  }
}
