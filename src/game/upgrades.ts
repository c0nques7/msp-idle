import type { GameState } from './engine'

export type UpgradeId =
  | 'secondMonitor'
  | 'shortcuts'
  | 'runbook'
  | 'canned'
  | 'autoTriage'
  | 'slaDashboard'
  | 'portal'
  | 'remoteTool'
  | 'knowledgeBase'
  | 'junior'
  | 'rmm'
  | 'thirdMonitor'
  | 'onCall'
  | 'senior'

export interface Upgrade {
  id: UpgradeId
  name: string
  baseCost: number
  effect: string
  unlockText: string
  unlocked: (s: GameState) => boolean
  /** How many times it can be bought. Defaults to 1. */
  max?: number
  /** Cost multiplier for each extra purchase. */
  growth?: number
}

export const MAX_JUNIORS = 5

export const UPGRADES: Upgrade[] = [
  { id: 'secondMonitor', name: 'Second monitor', baseCost: 50, effect: 'Work 2 tickets at once.', unlockText: '', unlocked: () => true },
  { id: 'shortcuts', name: 'Keyboard shortcuts', baseCost: 80, effect: 'Each click on an alert counts as 2 work.', unlockText: '', unlocked: () => true },
  {
    id: 'runbook',
    name: 'Runbook library',
    baseCost: 120,
    effect: "Ticket types you've solved 5 times show the right first step.",
    unlockText: 'Close 10 tickets',
    unlocked: (s) => s.ticketsClosed >= 10,
  },
  {
    id: 'canned',
    name: 'Canned responses',
    baseCost: 200,
    effect: 'Password resets skip their last step.',
    unlockText: 'Close 15 password resets',
    unlocked: (s) => s.closedByKind.reset >= 15,
  },
  {
    id: 'autoTriage',
    name: 'Alert auto-triage script',
    baseCost: 350,
    effect: 'False-positive alerts close themselves (+$1 each).',
    unlockText: 'See 40 alerts',
    unlocked: (s) => s.alertsSeen >= 40,
  },
  {
    id: 'slaDashboard',
    name: 'SLA dashboard',
    baseCost: 450,
    effect: 'New tickets get 25% more SLA time.',
    unlockText: 'Breach 3 SLAs',
    unlocked: (s) => s.breaches >= 3 || s.ticketsClosed >= 60,
  },
  {
    id: 'portal',
    name: 'Self-service reset portal',
    baseCost: 600,
    effect: 'Half of password resets never reach the queue (+$4 each).',
    unlockText: 'Own Canned responses',
    unlocked: (s) => !!s.upgrades.canned,
  },
  {
    id: 'remoteTool',
    name: 'Remote support tool',
    baseCost: 700,
    effect: 'Software, printer and outage tickets pay 25% more.',
    unlockText: 'Close 25 tickets',
    unlocked: (s) => s.ticketsClosed >= 25,
  },
  {
    id: 'knowledgeBase',
    name: 'Knowledge base',
    baseCost: 900,
    effect: 'Wrong choices cost half the SLA time.',
    unlockText: 'Reach 2 stars reputation',
    unlocked: (s) => s.reputation >= 2,
  },
  {
    id: 'junior',
    name: 'Hire junior tech',
    baseCost: 1200,
    effect: 'Closes a low or medium ticket every 4 s. Wage $2/s each.',
    unlockText: 'Earn $1,500 total',
    unlocked: (s) => s.totalEarned >= 1500,
    max: MAX_JUNIORS,
    growth: 1.35,
  },
  {
    id: 'rmm',
    name: 'RMM auto-remediation',
    baseCost: 2500,
    effect: 'Most real alerts fix themselves (+$3 each).',
    unlockText: 'Own Alert auto-triage',
    unlocked: (s) => !!s.upgrades.autoTriage,
  },
  {
    id: 'thirdMonitor',
    name: 'Third monitor',
    baseCost: 3000,
    effect: 'Work 3 tickets at once.',
    unlockText: 'Own Second monitor and close 100 tickets',
    unlocked: (s) => !!s.upgrades.secondMonitor && s.ticketsClosed >= 100,
  },
  {
    id: 'onCall',
    name: 'On-call rotation',
    baseCost: 4000,
    effect: 'While you are away, your team earns full pay (not half) for up to 8 hours (not 2).',
    unlockText: 'Hire a junior tech',
    unlocked: (s) => s.juniors >= 1,
  },
  {
    id: 'senior',
    name: 'Hire senior tech',
    baseCost: 8000,
    effect: 'Closes any ticket, outages first, every 3 s. Wage $6/s.',
    unlockText: 'Reach 3 stars reputation',
    unlocked: (s) => s.reputation >= 3,
  },
]

export function upgradeLevel(s: GameState, u: Upgrade): number {
  if (u.id === 'junior') return s.juniors
  return s.upgrades[u.id] ? 1 : 0
}

export function upgradeCost(s: GameState, u: Upgrade): number {
  return Math.round(u.baseCost * Math.pow(u.growth ?? 1, upgradeLevel(s, u)))
}

export function maxedOut(s: GameState, u: Upgrade): boolean {
  return upgradeLevel(s, u) >= (u.max ?? 1)
}
