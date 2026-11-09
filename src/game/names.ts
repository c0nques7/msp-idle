// Seeded name generation for the MSP, its clients and their users.

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rng = () => number

export const pick = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]

const MSP_FIRST = ['Blue', 'North', 'Iron', 'Summit', 'Clear', 'Bright', 'Granite', 'Cedar', 'Harbor', 'Silver', 'Key', 'Red', 'High', 'True', 'Stone']
const MSP_SECOND = ['peak', 'line', 'path', 'gate', 'ridge', 'field', 'point', 'wave', 'bridge', 'stone', 'brook', 'rock', 'view']
const MSP_TYPE = ['Managed IT', 'Technologies', 'IT Solutions', 'Tech Partners', 'Networks', 'IT Services']

const PLACES = ['Cedar Valley', 'Northgate', 'Riverside', 'Oak Hollow', 'Pinecrest', 'Lakeshore', 'Maple Ridge', 'Stonebrook', 'Westfield', 'Fairview', 'Elm Park', 'Bayside', 'Highland', 'Copper Creek']
const SURNAMES = ['Harlow', 'Finch', 'Mercer', 'Holloway', 'Prescott', 'Vance', 'Whitaker', 'Calloway', 'Brennan', 'Okafor', 'Lindqvist', 'Moreno', 'Takahashi', 'Patel', 'Novak', 'Reyes']
const FIRST_NAMES = ['Dana', 'Marcus', 'Priya', 'Tom', 'Elena', 'Jordan', 'Kevin', 'Aisha', 'Ben', 'Sofia', 'Raj', 'Megan', 'Luis', 'Hannah', 'Owen', 'Grace', 'Darnell', 'Yuki', 'Carla', 'Sam']

const CLIENT_PATTERNS: ((rng: Rng) => string)[] = [
  (r) => `${pick(r, SURNAMES)} & ${pick(r, SURNAMES)} Law`,
  (r) => `${pick(r, PLACES)} Dental`,
  (r) => `${pick(r, PLACES)} Logistics`,
  (r) => `${pick(r, SURNAMES)} Accounting`,
  (r) => `${pick(r, PLACES)} Veterinary Clinic`,
  (r) => `${pick(r, SURNAMES)} Construction`,
  (r) => `${pick(r, PLACES)} Realty`,
  (r) => `${pick(r, PLACES)} Family Medicine`,
  (r) => `${pick(r, SURNAMES)} Insurance Group`,
  (r) => `${pick(r, PLACES)} Credit Union`,
]

export interface Client {
  name: string
  code: string
}

export function generateMspName(rng: Rng): string {
  return `${pick(rng, MSP_FIRST)}${pick(rng, MSP_SECOND)} ${pick(rng, MSP_TYPE)}`
}

function clientCode(name: string): string {
  return name
    .replace('&', '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 3)
}

export function generateClients(rng: Rng, count: number): Client[] {
  const clients: Client[] = []
  const usedNames = new Set<string>()
  const usedCodes = new Set<string>()
  // Each business type is used once so the client list feels varied.
  const patterns = [...CLIENT_PATTERNS]
  let guard = 0
  while (clients.length < count && patterns.length > 0 && guard++ < 200) {
    const patternIndex = Math.floor(rng() * patterns.length)
    const name = patterns[patternIndex](rng)
    patterns.splice(patternIndex, 1)
    let code = clientCode(name)
    if (usedNames.has(name)) continue
    if (usedCodes.has(code)) code = code.slice(0, 2) + String(clients.length + 1)
    usedNames.add(name)
    usedCodes.add(code)
    clients.push({ name, code })
  }
  return clients
}

export function generateUser(rng: Rng): string {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, SURNAMES)}`
}

const HOST_SUFFIX = ['FS01', 'DC01', 'SQL01', 'PC-14', 'LT-07', 'WS-22', 'APP01', 'PC-03']
export function generateHost(rng: Rng, client: Client): string {
  return `${client.code}-${pick(rng, HOST_SUFFIX)}`
}
