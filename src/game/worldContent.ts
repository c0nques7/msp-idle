// Stage 4 content: world regions and global events.
import type { EventInfo } from './regionContent'

export type WorldEventKind =
  | 'dsar'
  | 'handoff'
  | 'cloudOutage'
  | 'currency'
  | 'phishing'
  | 'multinational'
  | 'laborLaw'
  | 'dueDiligence'
  | 'residency'

export interface WorldEventInfo extends EventInfo {
  privacy?: boolean
  currency?: boolean
}

export interface WorldSlot {
  name: string
  cost: number
  /** Global service that must be owned before entering. */
  needs?: 'gdpr' | 'currency'
}

/** Slot 0 is home: the region you built in stage 3. */
export const WORLD_SLOTS: WorldSlot[] = [
  { name: 'Home region', cost: 0 },
  { name: 'Latin America', cost: 100_000 },
  { name: 'Europe', cost: 150_000, needs: 'gdpr' },
  { name: 'Africa', cost: 180_000 },
  { name: 'Asia Pacific', cost: 220_000, needs: 'currency' },
  { name: 'Middle East', cost: 260_000 },
]

export const WORLD_REVENUE_PER_CLIENT = 5
export const OFFICE_WAGE = 30
export const OFFICE_CAPACITY = 25

export const WORLD_EVENTS: Record<WorldEventKind, WorldEventInfo> = {
  dsar: {
    label: 'Data subject access request',
    setup: "A client's customer in another country asks for every piece of personal data held about them. Privacy law gives you one month to answer.",
    success: { clients: 10 },
    successText: 'A complete, on-time answer. The client now trusts you with their privacy program.',
    fail: { money: -40_000, health: -10 },
    failText: 'The regulator got involved, and the fine landed on you.',
    privacy: true,
    steps: [
      {
        prompt: 'Verify',
        options: [
          { text: "Confirm the requester's identity before sharing anything", kind: 'right', why: 'Sending personal data to the wrong person is a breach of its own.' },
          { text: 'Email the data to whatever address asked', kind: 'risky', why: 'Anyone can claim to be someone else by email.' },
          { text: 'Insist they send the request by post', kind: 'slow', why: 'Requests can arrive in any form. Adding hoops eats into the deadline.' },
        ],
      },
      {
        prompt: 'Collect',
        options: [
          { text: 'Search every system that holds their data, including the CRM and backups', kind: 'right', why: 'An incomplete answer means another round and another complaint.' },
          { text: 'Check only the main database', kind: 'slow', why: 'Personal data lives in email, tickets and file shares too.' },
          { text: 'Delete their records so there is nothing to report', kind: 'risky', why: 'Destroying data to dodge a request is a serious violation.' },
        ],
      },
      {
        prompt: 'Respond',
        options: [
          { text: 'Send a complete copy within the month, in a common format', kind: 'right', why: 'That is exactly what the law asks for.' },
          { text: 'Charge a fee for the copy', kind: 'risky', why: 'The first copy must normally be free.' },
          { text: 'Wait until the last week to start', kind: 'slow', why: 'Any surprise in the last week means a missed deadline.' },
        ],
      },
    ],
  },
  handoff: {
    label: 'Ticket lost in the overnight handoff',
    setup: "A server-down ticket opened in one region sat for six hours while the next region's shift assumed someone owned it.",
    success: { health: 10 },
    successText: 'The client was back up within the hour, and handoffs have been clean since.',
    fail: { clients: -10, health: -15 },
    failText: 'The client escalated to their CEO, and other clients heard about it.',
    steps: [
      {
        prompt: 'Recover',
        options: [
          { text: 'Assign an owner now and update the client with the plan', kind: 'right', why: 'An owner and an update stop the bleeding in minutes.' },
          { text: "Wait for the original tech's next shift", kind: 'slow', why: 'Six hours down is already six hours too many.' },
          { text: 'Close it and open a fresh ticket', kind: 'risky', why: 'It loses the history and looks like hiding the SLA miss.' },
        ],
      },
      {
        prompt: 'Fix the process',
        options: [
          { text: 'Make every handoff name an owner and a next step in the ticket', kind: 'right', why: 'Written ownership is what makes follow-the-sun work.' },
          { text: 'Remind everyone in the next team meeting', kind: 'slow', why: 'Reminders fade. A required field does not.' },
          { text: 'Blame the overnight tech in front of the team', kind: 'risky', why: 'Blame hides the process gap and teaches people to cover up.' },
        ],
      },
    ],
  },
  cloudOutage: {
    label: 'Cloud provider region outage',
    setup: "A major cloud provider's region is down, and dozens of client apps are offline.",
    success: { clients: 15 },
    successText: 'Clients with disaster recovery barely noticed. The rest signed up for it.',
    fail: { clients: -15, health: -20 },
    failText: 'Clients sat offline for a day with no word from you.',
    steps: [
      {
        prompt: 'Confirm',
        options: [
          { text: "Check the provider's status page and your monitoring to confirm the scope", kind: 'right', why: 'Know what is down and why before you touch anything.' },
          { text: 'Open a ticket for each client, one at a time', kind: 'slow', why: 'One incident with a list of affected clients is faster.' },
          { text: 'Start rebuilding servers in a hurry', kind: 'risky', why: 'Rebuilding into the same broken region fixes nothing.' },
        ],
      },
      {
        prompt: 'Restore',
        options: [
          { text: 'Fail over clients that have disaster recovery to a second region', kind: 'right', why: 'This is what the DR plan is for.' },
          { text: 'Move every client to a different provider today', kind: 'risky', why: 'A rushed migration during an outage creates a second outage.' },
          { text: 'Wait for the provider with no plan', kind: 'slow', why: 'Clients with DR are paying for you to use it.' },
        ],
      },
      {
        prompt: 'Communicate',
        options: [
          { text: 'Send updates on a schedule, and list which clients lack DR for later', kind: 'right', why: 'Regular updates keep trust, and the list becomes next quarter\'s projects.' },
          { text: 'Promise clients it will never happen again', kind: 'risky', why: 'You do not control the provider. Promise a plan, not a miracle.' },
          { text: 'Reply only to clients who call', kind: 'slow', why: 'Silence makes every client assume the worst.' },
        ],
      },
    ],
  },
  currency: {
    label: 'Local currency drops 15%',
    setup: 'The local currency fell 15% against the dollar. Your costs there are in dollars, but your contracts are in local currency.',
    success: {},
    successText: 'Margins recovered at renewal, and no client left over it.',
    fail: { money: -60_000 },
    failText: 'Months of thin margins came straight out of your profit.',
    currency: true,
    steps: [
      {
        prompt: 'Review',
        options: [
          { text: 'Check which contracts have a currency adjustment clause', kind: 'right', why: 'Some contracts already let you adjust. Start there.' },
          { text: 'Raise every price 15% tomorrow', kind: 'risky', why: 'Surprise increases without contract backing drive clients away.' },
          { text: 'Wait to see if the currency bounces back', kind: 'slow', why: 'Hope is not a pricing strategy.' },
        ],
      },
      {
        prompt: 'Act',
        options: [
          { text: 'Add adjustment clauses at renewal and price new deals with them', kind: 'right', why: 'Fair, contractual protection for both sides.' },
          { text: 'Cancel contracts that are now unprofitable', kind: 'risky', why: 'Walking away damages your name in a market you just entered.' },
          { text: 'Absorb the loss quietly', kind: 'slow', why: 'Your margins pay your people.' },
        ],
      },
    ],
  },
  phishing: {
    label: 'Phishing campaign across countries',
    setup: 'The same phishing campaign is hitting clients in several countries, in several languages.',
    success: { clients: 10 },
    successText: 'Blocked everywhere within the hour. Clients noticed how fast you moved.',
    fail: { clients: -20, health: -15 },
    failText: 'Several clients had accounts taken over before you caught up.',
    security: true,
    steps: [
      {
        prompt: 'Contain',
        options: [
          { text: 'Block the sender domains and links across every client tenant', kind: 'right', why: 'One campaign, one response everywhere.' },
          { text: 'Block it only for clients who report it', kind: 'slow', why: 'The ones who have not reported it are the ones clicking.' },
          { text: 'Turn off email for everyone', kind: 'risky', why: 'You would stop the business, not the attacker.' },
        ],
      },
      {
        prompt: 'Protect',
        options: [
          { text: 'Reset passwords for anyone who clicked and confirm MFA is on', kind: 'right', why: 'Stolen passwords are useless with fresh credentials and MFA.' },
          { text: 'Reset only the admin accounts', kind: 'risky', why: 'Attackers happily start with a regular mailbox.' },
          { text: 'Send everyone a reminder to be careful', kind: 'slow', why: 'Awareness helps later. Compromised accounts need action now.' },
        ],
      },
      {
        prompt: 'Share',
        options: [
          { text: 'Share the indicators with all clients and your security partners', kind: 'right', why: 'Shared intelligence protects everyone faster.' },
          { text: 'Name the first client who was hit in a public post', kind: 'risky', why: "Never expose a client's incident without their consent." },
          { text: 'Keep it internal', kind: 'slow', why: 'Partners could have blocked the next wave.' },
        ],
      },
    ],
  },
  multinational: {
    label: 'Multinational wants one MSP',
    setup: 'A company with offices in 14 countries wants a single provider for all of them.',
    success: { clients: 30 },
    successText: 'They signed a global master agreement. Their offices count as 30 clients.',
    fail: {},
    failText: 'They chose a larger global provider.',
    steps: [
      {
        prompt: 'Scope',
        options: [
          { text: 'Map their sites, local laws and languages before pricing', kind: 'right', why: 'Every country adds requirements you must price in.' },
          { text: 'Quote one global price per user without looking', kind: 'risky', why: 'Hidden local requirements turn into losses.' },
          { text: 'Ask for a year to study it', kind: 'slow', why: 'They will sign with someone else first.' },
        ],
      },
      {
        prompt: 'Deliver',
        options: [
          { text: 'Use your own offices where you have them and vetted local partners elsewhere', kind: 'right', why: 'Partners give you local hands without building an office everywhere.' },
          { text: 'Promise on-site support everywhere from day one', kind: 'risky', why: 'You cannot be on-site where you have no one.' },
          { text: 'Support every country remotely from home', kind: 'slow', why: 'Time zones and languages make remote-only support slow.' },
        ],
      },
      {
        prompt: 'Contract',
        options: [
          { text: "One master agreement with local schedules for each country's SLAs and laws", kind: 'right', why: 'Global consistency with local compliance.' },
          { text: 'Use your home-country contract everywhere', kind: 'risky', why: 'Some clauses will be unenforceable or illegal abroad.' },
          { text: 'Sign a separate contract in every country', kind: 'slow', why: 'Fourteen contracts means fourteen renewals and no single view.' },
        ],
      },
    ],
  },
  laborLaw: {
    label: 'New labor law limits on-call work',
    setup: 'A country you operate in now limits overnight on-call work for employees.',
    success: { health: 10 },
    successText: 'Nights are covered from regions where it is daytime, and your team is happier.',
    fail: { money: -50_000, health: -10 },
    failText: 'A labor complaint led to back pay and penalties.',
    steps: [
      {
        prompt: 'Understand',
        options: [
          { text: 'Get advice from local employment counsel', kind: 'right', why: 'Local law needs local expertise.' },
          { text: 'Assume your home-country rules still apply', kind: 'risky', why: 'Employment law is local. Assuming otherwise is how penalties happen.' },
          { text: 'Wait until someone complains', kind: 'slow', why: 'By then you owe back pay.' },
        ],
      },
      {
        prompt: 'Adapt',
        options: [
          { text: 'Cover nights from a region where it is daytime', kind: 'right', why: 'Follow-the-sun turns a legal limit into better coverage.' },
          { text: 'Keep the old on-call rota quietly', kind: 'risky', why: 'Knowingly breaking labor law is far worse than not knowing.' },
          { text: 'Hire a separate night shift at premium pay', kind: 'slow', why: 'It works, but costs far more than using your other regions.' },
        ],
      },
    ],
  },
  dueDiligence: {
    label: 'Buying a foreign MSP',
    setup: 'A local MSP is for sale and would double your presence in the region.',
    success: { clients: 25, techs: 1 },
    successText: 'The deal closed cleanly, with their clients and their office intact.',
    fail: { money: -80_000 },
    failText: 'Hidden problems surfaced after closing and cost you dearly.',
    steps: [
      {
        prompt: 'Check security',
        options: [
          { text: 'Review their security posture and any past breaches', kind: 'right', why: 'You are buying their risk along with their clients.' },
          { text: 'Skip it to close faster', kind: 'risky', why: "An attacker already inside their network is now inside yours." },
          { text: 'Take their word for it over the phone', kind: 'slow', why: 'Ask for evidence, not reassurance.' },
        ],
      },
      {
        prompt: 'Check contracts',
        options: [
          { text: 'Read client contracts for change-of-control clauses', kind: 'right', why: 'Some clients can walk away when ownership changes.' },
          { text: 'Assume every client transfers automatically', kind: 'risky', why: 'Those clients are the reason you are paying.' },
          { text: 'Review the contracts after closing', kind: 'slow', why: 'After closing is too late to change the price.' },
        ],
      },
      {
        prompt: 'Keep people',
        options: [
          { text: 'Agree retention terms with key staff before the deal closes', kind: 'right', why: 'Their people hold the client relationships.' },
          { text: 'Announce layoffs on day one', kind: 'risky', why: 'The best people leave first, and clients follow them.' },
          { text: 'Sort out staffing after the deal', kind: 'slow', why: 'Uncertainty makes key people start job hunting.' },
        ],
      },
    ],
  },
  residency: {
    label: 'Client requires in-country data',
    setup: 'A government client requires that its data and backups never leave the country.',
    success: { clients: 10 },
    successText: 'Compliant and documented. Other public sector clients are asking about it.',
    fail: { clients: -10 },
    failText: 'An audit found backups stored abroad, and the client ended the contract.',
    privacy: true,
    steps: [
      {
        prompt: 'Audit',
        options: [
          { text: 'Map where their data and backups actually live today', kind: 'right', why: 'Backups and logs often sit in another country without anyone noticing.' },
          { text: 'Tell them everything is fine without checking', kind: 'risky', why: 'An unchecked promise to a government client is a liability.' },
          { text: 'Ask the cloud provider to check for you', kind: 'slow', why: 'They know their regions, not your configuration.' },
        ],
      },
      {
        prompt: 'Fix',
        options: [
          { text: 'Move storage and backups to an in-country region and document it', kind: 'right', why: 'Compliance you can prove is compliance that lasts.' },
          { text: 'Turn off the backups that go abroad', kind: 'risky', why: 'Now they have no backups at all.' },
          { text: 'Ask them to accept an exception', kind: 'slow', why: 'Government rules rarely bend. Fix it instead.' },
        ],
      },
    ],
  },
}
