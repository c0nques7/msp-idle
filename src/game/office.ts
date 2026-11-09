// Stage 2: the isometric office. Staff work the client queue on their own,
// and the player keeps the office's own IT running.
import type { ChoiceStep } from './content'
import {
  addFeed,
  addToast,
  clampRep,
  closeTicket,
  shuffle,
  techPayout,
  type Feedback,
  type GameState,
} from './engine'
import { generateUser } from './names'
import { DESK_SLOTS, PROBLEMS, ROLES, START_DESKS, type ProblemKind, type Role } from './officeContent'

export interface Staff {
  id: number
  name: string
  role: Role
  desk: number
  /** False until their laptop setup problem is solved. */
  ready: boolean
  timer: number
}

export interface Problem {
  id: number
  kind: ProblemKind
  /** For laptop and phishing problems: the staff member it sits with. */
  staffId?: number
  createdAt: number
  deadline?: number
  steps: ChoiceStep[]
  stepIndex: number
  tried: number[]
  feedback?: Feedback
}

export type BuildId = 'closet' | 'breakRoom' | 'expansion'
export type EquipmentId = 'managedSwitch' | 'meshWifi' | 'emailFilter' | 'offsiteBackup'

export interface OfficeState {
  staff: Staff[]
  desks: number
  built: Partial<Record<BuildId, boolean>>
  equipment: Partial<Record<EquipmentId, boolean>>
  problems: Problem[]
  problemTimer: number
  internalTimer: number
  introPlayed: boolean
  complete: boolean
  showComplete: boolean
}

const INTERNAL_IT_INTERVAL = 20_000
const MAX_OPEN_PROBLEMS = 3
const SLOW_PENALTY = 8_000
const RISKY_PENALTY = 15_000

const nextProblemDelay = () => 30_000 + Math.random() * 15_000

function makeSteps(kind: ProblemKind): ChoiceStep[] {
  return PROBLEMS[kind].steps.map((step) => ({ prompt: step.prompt, options: shuffle(step.options) }))
}

function makeProblem(s: GameState, kind: ProblemKind, staffId?: number): Problem {
  const info = PROBLEMS[kind]
  let deadline = info.deadlineMs ? s.time + info.deadlineMs : undefined
  if (kind === 'backup' && s.office?.equipment.offsiteBackup) deadline = undefined
  return { id: s.nextId, kind, staffId, createdAt: s.time, deadline, steps: makeSteps(kind), stepIndex: 0, tried: [] }
}

function withOffice(s: GameState, patch: Partial<OfficeState>): GameState {
  return { ...s, office: { ...s.office!, ...patch } }
}

function addProblem(s: GameState, kind: ProblemKind, staffId?: number): GameState {
  const p = makeProblem(s, kind, staffId)
  s = { ...s, nextId: s.nextId + 1 }
  s = withOffice(s, { problems: [...s.office!.problems, p] })
  return addToast(s, kind === 'phishing' || kind === 'switch' ? 'bad' : 'info', `Office problem: ${PROBLEMS[kind].label}`)
}

function freeDesk(o: OfficeState): number {
  const used = new Set(o.staff.map((x) => x.desk))
  for (let i = 0; i < o.desks; i++) if (!used.has(i)) return i
  return -1
}

function newStaff(s: GameState, role: Role, desk: number, ready: boolean): Staff {
  return { id: s.nextId, name: generateUser(Math.random), role, desk, ready, timer: 0 }
}

/** Moves a promoted stage 1 game into the office. */
export function enterOffice(s: GameState): GameState {
  const staff: Staff[] = []
  let id = s.nextId
  const desks = Math.max(START_DESKS, s.juniors + 1)
  for (let i = 0; i < s.juniors; i++) {
    staff.push({ id: id++, name: generateUser(Math.random), role: 'tier1', desk: i, ready: true, timer: 0 })
  }
  if (s.upgrades.senior) {
    staff.push({ id: id++, name: generateUser(Math.random), role: 'tier2', desk: staff.length, ready: true, timer: 0 })
  }
  s = {
    ...s,
    stage: 2,
    nextId: id,
    showPromotion: false,
    tickets: s.tickets.map((t) => ({ ...t, active: false })),
    office: {
      staff,
      desks,
      built: {},
      equipment: {},
      problems: [],
      problemTimer: nextProblemDelay(),
      internalTimer: 0,
      introPlayed: false,
      complete: false,
      showComplete: false,
    },
  }
  // The first internal ticket arrives right away to teach the new mechanic.
  s = addProblem(s, 'printer')
  return addFeed(s, 'info', `Welcome to the office. ${staff.length} techs moved in with you.`)
}

/** A ready-made stage 2 save, for trying the office without replaying stage 1. */
export function previewOffice(s: GameState): GameState {
  s = {
    ...s,
    started: true,
    money: 4000,
    totalEarned: 25000,
    reputation: 4.2,
    ticketsClosed: 400,
    closedByKind: { alert: 150, reset: 120, software: 60, printer: 50, outage: 20 },
    alertsSeen: 300,
    juniors: 2,
    promoted: true,
    upgrades: { secondMonitor: true, shortcuts: true, runbook: true, canned: true, autoTriage: true },
    announced: ['secondMonitor', 'shortcuts', 'runbook', 'canned', 'autoTriage', 'slaDashboard', 'portal', 'remoteTool', 'knowledgeBase', 'junior', 'rmm', 'thirdMonitor', 'onCall', 'senior'],
  }
  return enterOffice(s)
}

export const workingStaff = (s: GameState) => (s.office ? s.office.staff.filter((x) => x.ready && ROLES[x.role].interval > 0).length : 0)

export function officeWages(s: GameState): number {
  return s.office ? s.office.staff.reduce((sum, x) => sum + ROLES[x.role].wage, 0) : 0
}

/** Team speed from open problems and office perks. */
export function teamSpeed(s: GameState): number {
  const o = s.office
  if (!o) return 1
  let speed = 1
  for (const p of o.problems) speed *= PROBLEMS[p.kind].speed
  if (o.staff.some((x) => x.role === 'dispatcher' && x.ready)) speed *= 1.15
  if (o.built.breakRoom) speed *= 1.1
  return speed
}

/** Tickets per second the team can close, including speed perks and problems. */
export function staffCapacity(s: GameState): number {
  if (!s.office) return 0
  const base = s.office.staff.reduce((sum, x) => {
    const r = ROLES[x.role]
    return x.ready && r.interval > 0 ? sum + 1000 / r.interval : sum
  }, 0)
  return base * teamSpeed(s)
}

/**
 * Client tickets arrive faster as the team gets more capable, so every hire,
 * promotion and speed perk brings in more paid work than it costs.
 */
export const officeSpawnInterval = (s: GameState) => 1000 / (0.6 + 0.85 * staffCapacity(s))

function unlockedProblems(s: GameState): [ProblemKind, number][] {
  const o = s.office!
  const list: [ProblemKind, number][] = [['printer', 3]]
  if (o.staff.length >= 4 && !o.equipment.meshWifi) list.push(['wifi', 3])
  if (s.reputation >= 4) list.push(['phishing', o.equipment.emailFilter ? 1 : 2])
  if (o.built.closet) {
    list.push(['switch', o.equipment.managedSwitch ? 1 : 2])
    list.push(['backup', 2])
  }
  return list
}

function rollProblem(s: GameState): GameState {
  const o = s.office!
  const open = new Set(o.problems.map((p) => p.kind))
  const options = unlockedProblems(s).filter(([k]) => !open.has(k))
  if (options.length === 0) return s
  const total = options.reduce((sum, [, w]) => sum + w, 0)
  let roll = Math.random() * total
  let kind = options[0][0]
  for (const [k, w] of options) {
    roll -= w
    if (roll <= 0) {
      kind = k
      break
    }
  }
  const staffId = kind === 'phishing' ? o.staff[Math.floor(Math.random() * o.staff.length)]?.id : undefined
  return addProblem(s, kind, staffId)
}

function resolveProblem(s: GameState, p: Problem, by: string, why?: string): GameState {
  const o = s.office!
  let staff = o.staff
  if (p.kind === 'laptop' && p.staffId !== undefined) staff = staff.map((x) => (x.id === p.staffId ? { ...x, ready: true } : x))
  s = withOffice(s, { problems: o.problems.filter((x) => x.id !== p.id), staff })
  s = { ...s, reputation: clampRep(s.reputation + 0.03) }
  return addFeed(s, 'good', `${by}: ${PROBLEMS[p.kind].label}.`, why)
}

function expireProblem(s: GameState, p: Problem): GameState {
  s = withOffice(s, { problems: s.office!.problems.filter((x) => x.id !== p.id) })
  if (p.kind === 'phishing') {
    const cost = Math.floor(s.money * 0.1)
    s = { ...s, money: s.money - cost, reputation: clampRep(s.reputation - 0.5) }
    s = addToast(s, 'bad', `Someone clicked the phishing link. Cleanup cost ${'$'}${cost.toLocaleString()}.`)
    return addFeed(s, 'bad', `Phishing link clicked. Cleanup cost $${cost.toLocaleString()}, reputation down.`)
  }
  if (p.kind === 'backup') {
    const cost = Math.floor(s.money * 0.15)
    s = { ...s, money: s.money - cost, reputation: clampRep(s.reputation - 0.3) }
    s = addToast(s, 'bad', `A drive failed with no recent backup. Recovery cost $${cost.toLocaleString()}.`)
    return addFeed(s, 'bad', `Data loss: a drive failed before the backup was fixed. Recovery cost $${cost.toLocaleString()}.`)
  }
  return s
}

function runStaff(s: GameState, dt: number): GameState {
  const o = s.office!
  const wages = (officeWages(s) * dt) / 1000
  if (wages > 0 && s.money < wages) return s
  s = { ...s, money: s.money - wages }
  const speed = teamSpeed(s)

  for (const member of o.staff) {
    const role = ROLES[member.role]
    if (!member.ready || role.interval === 0) continue
    let timer = member.timer + dt * speed
    if (timer >= role.interval) {
      const queue = s.tickets.filter((t) => !t.active)
      const target =
        member.role === 'tier2'
          ? (queue.find((t) => t.kind === 'outage') ?? queue.find((t) => t.kind !== 'alert') ?? queue[0])
          : queue.find((t) => t.priority !== 'Critical')
      if (target) {
        s = closeTicket(s, target, { payout: techPayout(s, target), text: '', by: `${member.name.split(' ')[0]} closed` })
        timer -= role.interval
      } else {
        timer = role.interval
      }
    }
    s = withOffice(s, { staff: s.office!.staff.map((x) => (x.id === member.id ? { ...x, timer } : x)) })
  }

  // The internal IT tech fixes the oldest office problem every 20 seconds.
  if (s.office!.staff.some((x) => x.role === 'internalIt' && x.ready)) {
    const timer = s.office!.internalTimer + dt
    if (timer >= INTERNAL_IT_INTERVAL && s.office!.problems.length > 0) {
      s = withOffice(s, { internalTimer: 0 })
      s = resolveProblem(s, s.office!.problems[0], 'Internal IT fixed')
    } else {
      s = withOffice(s, { internalTimer: Math.min(timer, INTERNAL_IT_INTERVAL) })
    }
  }
  return s
}

export function officeTick(s: GameState, dt: number): GameState {
  if (!s.office) return s
  for (const p of s.office.problems) {
    if (p.deadline !== undefined && s.time > p.deadline) s = expireProblem(s, p)
  }
  const timer = s.office!.problemTimer - dt
  if (timer <= 0) {
    const open = s.office!.problems.filter((p) => p.kind !== 'laptop').length
    s = withOffice(s, { problemTimer: nextProblemDelay() })
    if (open < MAX_OPEN_PROBLEMS) s = rollProblem(s)
  } else {
    s = withOffice(s, { problemTimer: timer })
  }
  return runStaff(s, dt)
}

export function chooseProblemStep(s: GameState, id: number, option: number): GameState {
  const p = s.office?.problems.find((x) => x.id === id)
  if (!p) return s
  const step = p.steps[p.stepIndex]
  const opt = step?.options[option]
  if (!opt || p.tried.includes(option)) return s
  if (opt.kind === 'right') {
    if (p.stepIndex + 1 >= p.steps.length) return resolveProblem(s, p, 'Fixed', opt.why)
    const next: Problem = { ...p, stepIndex: p.stepIndex + 1, tried: [], feedback: { kind: 'right', text: opt.why } }
    return withOffice(s, { problems: s.office!.problems.map((x) => (x.id === id ? next : x)) })
  }
  const penalty = opt.kind === 'risky' ? RISKY_PENALTY : SLOW_PENALTY
  const next: Problem = {
    ...p,
    tried: [...p.tried, option],
    feedback: { kind: opt.kind, text: opt.why },
    deadline: p.deadline !== undefined ? p.deadline - penalty : undefined,
  }
  s = withOffice(s, { problems: s.office!.problems.map((x) => (x.id === id ? next : x)) })
  if (opt.kind === 'risky') s = { ...s, reputation: clampRep(s.reputation - 0.05) }
  return s
}

// ---------- Office shop ----------

export type OfficeItemId =
  | 'hireTier1'
  | 'trainTier2'
  | 'dispatcher'
  | 'internalIt'
  | 'desk'
  | 'closet'
  | 'breakRoom'
  | 'managedSwitch'
  | 'meshWifi'
  | 'emailFilter'
  | 'offsiteBackup'
  | 'expansion'

export interface OfficeItem {
  id: OfficeItemId
  group: 'Staff' | 'Space' | 'Equipment'
  name: string
  effect: string
  cost: (s: GameState) => number
  /** Why it can't be bought yet, or null when it can. */
  blocked: (s: GameState) => string | null
  done: (s: GameState) => boolean
}

const o = (s: GameState) => s.office!
const hasRole = (s: GameState, role: Role) => o(s).staff.some((x) => x.role === role)
const needDesk = (s: GameState) => (freeDesk(o(s)) < 0 ? 'Buy another desk first' : null)

export const OFFICE_ITEMS: OfficeItem[] = [
  {
    id: 'hireTier1',
    group: 'Staff',
    name: 'Hire Tier 1 tech',
    effect: 'Works low and medium client tickets. Wage $2/s.',
    cost: (s) => Math.round(2000 * Math.pow(1.15, o(s).staff.length)),
    blocked: needDesk,
    done: () => false,
  },
  {
    id: 'trainTier2',
    group: 'Staff',
    name: 'Train a tech to Tier 2',
    effect: 'Handles any ticket, outages first, 30% faster. Wage $3/s.',
    cost: () => 3000,
    blocked: (s) => (o(s).staff.some((x) => x.role === 'tier1' && x.ready) ? null : 'Needs a ready Tier 1 tech'),
    done: () => false,
  },
  {
    id: 'dispatcher',
    group: 'Staff',
    name: 'Hire dispatcher',
    effect: 'Routes tickets to the right tech: team works 15% faster. Wage $4/s.',
    cost: () => 6000,
    blocked: (s) => (o(s).staff.length < 4 ? 'Have 4 staff' : needDesk(s)),
    done: (s) => hasRole(s, 'dispatcher'),
  },
  {
    id: 'internalIt',
    group: 'Staff',
    name: 'Hire internal IT tech',
    effect: 'Fixes one office problem every 20 s. Wage $5/s.',
    cost: () => 10000,
    blocked: (s) => (!o(s).built.closet ? 'Build the server closet' : needDesk(s)),
    done: (s) => hasRole(s, 'internalIt'),
  },
  {
    id: 'desk',
    group: 'Space',
    name: 'Extra desk',
    effect: `Room for one more hire (up to ${DESK_SLOTS}).`,
    cost: (s) => Math.round(800 * Math.pow(1.2, o(s).desks - START_DESKS)),
    blocked: () => null,
    done: (s) => o(s).desks >= DESK_SLOTS,
  },
  {
    id: 'closet',
    group: 'Space',
    name: 'Build server closet',
    effect: 'A proper home for the network gear. Unlocks switch and backup problems and new equipment.',
    cost: () => 5000,
    blocked: () => null,
    done: (s) => !!o(s).built.closet,
  },
  {
    id: 'breakRoom',
    group: 'Space',
    name: 'Build break room',
    effect: 'Rested techs work 10% faster.',
    cost: () => 4000,
    blocked: (s) => (o(s).staff.length < 3 ? 'Have 3 staff' : null),
    done: (s) => !!o(s).built.breakRoom,
  },
  {
    id: 'meshWifi',
    group: 'Equipment',
    name: 'Mesh Wi-Fi',
    effect: 'No more Wi-Fi dead zones in the pod.',
    cost: () => 3500,
    blocked: (s) => (o(s).staff.length < 4 ? 'Have 4 staff' : null),
    done: (s) => !!o(s).equipment.meshWifi,
  },
  {
    id: 'managedSwitch',
    group: 'Equipment',
    name: 'Managed switch',
    effect: 'Switch problems happen half as often.',
    cost: () => 4500,
    blocked: (s) => (!o(s).built.closet ? 'Build the server closet' : null),
    done: (s) => !!o(s).equipment.managedSwitch,
  },
  {
    id: 'emailFilter',
    group: 'Equipment',
    name: 'Email security filter',
    effect: 'Phishing emails reach staff half as often.',
    cost: () => 6000,
    blocked: (s) => (s.reputation < 4 ? 'Reach 4 stars reputation' : null),
    done: (s) => !!o(s).equipment.emailFilter,
  },
  {
    id: 'offsiteBackup',
    group: 'Equipment',
    name: 'Offsite backup',
    effect: 'A failed backup can no longer turn into data loss.',
    cost: () => 7000,
    blocked: (s) => (!o(s).built.closet ? 'Build the server closet' : null),
    done: (s) => !!o(s).equipment.offsiteBackup,
  },
  {
    id: 'expansion',
    group: 'Space',
    name: 'Expand to a second floor',
    effect: 'Completes stage 2.',
    cost: () => 40000,
    blocked: (s) =>
      o(s).staff.length < 10 || !o(s).built.closet || !o(s).equipment.offsiteBackup
        ? 'Have 10 staff, a server closet and offsite backup'
        : null,
    done: (s) => !!o(s).built.expansion,
  },
]

function hire(s: GameState, role: Role): GameState {
  const desk = freeDesk(o(s))
  if (desk < 0) return s
  const member = newStaff(s, role, desk, false)
  s = { ...s, nextId: s.nextId + 1 }
  s = withOffice(s, { staff: [...o(s).staff, member] })
  s = addFeed(s, 'info', `Hired ${member.name} as ${ROLES[role].label}. Their laptop needs setting up.`)
  return addProblem(s, 'laptop', member.id)
}

export function buyOfficeItem(s: GameState, id: OfficeItemId): GameState {
  if (!s.office) return s
  const item = OFFICE_ITEMS.find((x) => x.id === id)
  if (!item || item.done(s) || item.blocked(s)) return s
  const cost = item.cost(s)
  if (s.money < cost) return s
  s = { ...s, money: s.money - cost }
  switch (id) {
    case 'hireTier1':
      return hire(s, 'tier1')
    case 'dispatcher':
      return hire(s, 'dispatcher')
    case 'internalIt':
      return hire(s, 'internalIt')
    case 'trainTier2': {
      const target = o(s).staff.find((x) => x.role === 'tier1' && x.ready)!
      s = withOffice(s, { staff: o(s).staff.map((x) => (x.id === target.id ? { ...x, role: 'tier2' as Role } : x)) })
      return addFeed(s, 'info', `${target.name} is now a Tier 2 tech.`)
    }
    case 'desk':
      return addFeed(withOffice(s, { desks: o(s).desks + 1 }), 'info', 'Added a desk to the pod.')
    case 'closet':
    case 'breakRoom':
      return addFeed(withOffice(s, { built: { ...o(s).built, [id]: true } }), 'info', `Built the ${id === 'closet' ? 'server closet' : 'break room'}.`)
    case 'expansion':
      s = withOffice(s, { built: { ...o(s).built, expansion: true }, complete: true, showComplete: true })
      return addFeed(s, 'good', 'Expanded to a second floor. Stage 2 complete!')
    default:
      return addFeed(withOffice(s, { equipment: { ...o(s).equipment, [id]: true } }), 'info', `Installed ${item.name}.`)
  }
}

/** Rough money per second while away in stage 2. */
export function officeIdleRate(s: GameState, avgPay: number): number {
  const arrivals = 1000 / officeSpawnInterval(s)
  return Math.min(staffCapacity(s), arrivals) * avgPay - officeWages(s)
}

