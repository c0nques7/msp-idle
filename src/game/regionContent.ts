// Stage 3 content: regional events that hit a whole site.
import type { ChoiceStep } from './content'

export type EventKind = 'storm' | 'audit' | 'prospect' | 'techQuits' | 'ransomware' | 'churn' | 'vendor'

export interface Outcome {
  health?: number
  clients?: number
  techs?: number
  money?: number
}

export interface EventInfo {
  label: string
  /** Shown in the event card under the title. */
  setup: string
  success: Outcome
  successText: string
  fail: Outcome
  failText: string
  security?: boolean
  steps: ChoiceStep[]
}

export const EVENTS: Record<EventKind, EventInfo> = {
  storm: {
    label: 'Storm knocks out power',
    setup: 'A storm has cut power across the area. Clients are calling in, and some servers went down hard.',
    success: { health: 10 },
    successText: 'Clients came back online in priority order and thanked you for the updates.',
    fail: { health: -30, clients: -2 },
    failText: 'Clients sat in the dark with no updates. Two of them are shopping for a new MSP.',
    steps: [
      {
        prompt: 'Get the picture',
        options: [
          { text: "Check monitoring to see which clients' sites are actually down", kind: 'right', why: 'Monitoring tells you the real scope in minutes, before the phones melt.' },
          { text: 'Answer the phones in the order they ring', kind: 'slow', why: 'The loudest client is not always the most affected one.' },
          { text: 'Send every tech out on-site immediately', kind: 'risky', why: 'Driving into a storm without a plan puts people at risk and wastes the day.' },
        ],
      },
      {
        prompt: 'Prioritize',
        options: [
          { text: 'Restore the medical and critical clients first, then the rest', kind: 'right', why: 'Impact decides order. A clinic without records is worse than an office without email.' },
          { text: 'Start with the biggest client by revenue', kind: 'slow', why: 'Revenue matters, but patient care and safety come first.' },
          { text: 'Power everything back on at once as soon as power returns', kind: 'risky', why: 'Servers that crashed hard need checks first, or you risk data corruption.' },
        ],
      },
      {
        prompt: 'Communicate',
        options: [
          { text: 'Send all affected clients a status update with the next update time', kind: 'right', why: 'Proactive updates turn a bad day into a trust-building one.' },
          { text: 'Update clients only when they call', kind: 'slow', why: 'Silence makes every client assume the worst.' },
          { text: 'Tell everyone it will be fixed within the hour', kind: 'risky', why: 'Never promise a time you do not control. The utility decides when power returns.' },
        ],
      },
    ],
  },
  audit: {
    label: 'Compliance audit at a medical client',
    setup: 'A medical client has a compliance audit next week, and the auditor wants evidence of your security controls.',
    success: { clients: 3 },
    successText: 'The audit passed cleanly. Word spread, and three more practices signed on.',
    fail: { clients: -3 },
    failText: 'The audit flagged gaps in your controls, and the client is reviewing its options.',
    steps: [
      {
        prompt: 'Prepare',
        options: [
          { text: 'Pull the documented policies, patch reports and access reviews', kind: 'right', why: 'Auditors want evidence. If it is not documented, it did not happen.' },
          { text: 'Plan to explain everything verbally on the day', kind: 'slow', why: 'Auditors cannot accept "trust us". Bring proof.' },
          { text: 'Write the missing policies the night before and backdate them', kind: 'risky', why: 'Falsifying records turns a gap into fraud.' },
        ],
      },
      {
        prompt: 'During the audit',
        options: [
          { text: 'Answer what you can prove and log any gaps with a fix date', kind: 'right', why: 'Honest gaps with a plan are normal. Hidden gaps are what sink you.' },
          { text: 'Promise controls you do not have yet', kind: 'risky', why: 'Overpromising to an auditor creates legal exposure for you and the client.' },
          { text: 'Refer every question to the client', kind: 'slow', why: 'You run their IT. You are the one who has the answers.' },
        ],
      },
    ],
  },
  prospect: {
    label: 'Big prospect wants a quote',
    setup: 'A 60-person firm is unhappy with its current MSP and wants a proposal by Friday.',
    success: { clients: 6 },
    successText: 'They signed a three-year agreement at a price that works.',
    fail: {},
    failText: 'The prospect went with another MSP.',
    steps: [
      {
        prompt: 'Scope it',
        options: [
          { text: 'Run a discovery visit to document their devices, users and apps', kind: 'right', why: 'You cannot price work you have not seen.' },
          { text: 'Quote from the number of employees alone', kind: 'risky', why: 'Hidden servers and messy networks turn a good deal into a money pit.' },
          { text: 'Ask them to fill in a 40-page questionnaire', kind: 'slow', why: 'Busy prospects will not finish it. A short visit gets better data.' },
        ],
      },
      {
        prompt: 'Price it',
        options: [
          { text: 'Price per user to cover the real work, plus onboarding', kind: 'right', why: 'A fair price you can deliver on beats a cheap one you will regret.' },
          { text: 'Undercut their current MSP by 40% to win', kind: 'risky', why: 'Winning a contract at a loss means every ticket costs you money.' },
          { text: 'Quote hourly and see how it goes', kind: 'slow', why: 'Hourly billing makes clients avoid calling, which leads to bigger problems.' },
        ],
      },
      {
        prompt: 'Close it',
        options: [
          { text: 'Present a clear onboarding plan with the first 30 days spelled out', kind: 'right', why: 'Prospects buy confidence. A plan shows you have done this before.' },
          { text: 'Badmouth their current MSP', kind: 'risky', why: 'It makes you look petty, and they chose that MSP once.' },
          { text: 'Email the quote and wait', kind: 'slow', why: 'A proposal with no conversation is easy to ignore.' },
        ],
      },
    ],
  },
  techQuits: {
    label: 'Senior tech gives notice',
    setup: 'The tech who knows every client at this site has accepted another job. Two weeks left.',
    success: {},
    successText: 'Knowledge was handed over cleanly, and nothing broke.',
    fail: { techs: -1, health: -15 },
    failText: 'They left with knowledge nobody else had. The site is scrambling.',
    steps: [
      {
        prompt: 'Protect the knowledge',
        options: [
          { text: 'Have them document every client and shadow their replacement', kind: 'right', why: 'Two weeks of handover saves months of rediscovery.' },
          { text: 'Ask them to leave a note with the important passwords', kind: 'risky', why: 'Passwords on a note are a security incident waiting to happen. They belong in a password vault.' },
          { text: 'Let them work normally until their last day', kind: 'slow', why: 'Business as usual means their knowledge walks out the door.' },
        ],
      },
      {
        prompt: 'Close the gap',
        options: [
          { text: 'Rotate shared credentials and remove their access on the last day', kind: 'right', why: 'Offboarding is a security task, not just a goodbye.' },
          { text: 'Leave their accounts active in case you need to ask them something', kind: 'risky', why: "A former employee's live account is a classic way in for attackers." },
          { text: 'Disable access a month later when things calm down', kind: 'slow', why: 'Access should end when employment ends.' },
        ],
      },
    ],
  },
  ransomware: {
    label: 'Ransomware at a client',
    setup: 'A client calls: files are renamed and there is a ransom note on every desktop.',
    success: { clients: 2 },
    successText: 'Contained and restored from backup in hours. The story became your best sales pitch.',
    fail: { clients: -5, health: -20 },
    failText: 'The infection spread and the restore took days. Several clients are rattled.',
    security: true,
    steps: [
      {
        prompt: 'Contain',
        options: [
          { text: 'Disconnect infected machines from the network right away', kind: 'right', why: 'Stopping the spread comes before everything else.' },
          { text: 'Reboot the infected machines', kind: 'risky', why: 'Rebooting can destroy evidence and does not stop the spread.' },
          { text: 'Start reading the ransom note for clues', kind: 'slow', why: 'Every minute connected is another machine encrypted.' },
        ],
      },
      {
        prompt: 'Recover',
        options: [
          { text: 'Restore from the last tested, offline backup', kind: 'right', why: 'This is why you test restores. Clean backups are the way out.' },
          { text: 'Pay the ransom quickly to get back to work', kind: 'risky', why: 'Paying funds attackers, may break sanctions law, and often does not return the data.' },
          { text: 'Rebuild every machine from scratch', kind: 'slow', why: 'Backups get people working days sooner.' },
        ],
      },
      {
        prompt: 'Follow up',
        options: [
          { text: 'Find how they got in, close it, and help the client with legal notification', kind: 'right', why: 'If you do not close the door, they will be back. Notification may be required by law.' },
          { text: 'Call it fixed once files are back', kind: 'risky', why: 'The way in is still open.' },
          { text: 'Send a generic security tips email to all clients', kind: 'slow', why: 'Nice, but it does not close the hole that was used.' },
        ],
      },
    ],
  },
  churn: {
    label: 'Client threatens to leave',
    setup: 'A long-time client says response times have slipped and they are talking to other MSPs.',
    success: {},
    successText: 'You found the real problem, fixed it, and kept the client.',
    fail: { clients: -4 },
    failText: 'The client left and took a referral partner with them.',
    steps: [
      {
        prompt: 'Listen',
        options: [
          { text: 'Meet them and ask for specific tickets that went badly', kind: 'right', why: 'Specific examples point to the real cause.' },
          { text: 'Offer a discount straight away', kind: 'risky', why: 'Discounts without fixes just make the problem cheaper.' },
          { text: 'Send them your SLA report showing you hit targets', kind: 'slow', why: 'Arguing with data the client does not feel ends relationships.' },
        ],
      },
      {
        prompt: 'Fix it',
        options: [
          { text: 'Fix the root cause and send a written plan with a check-in date', kind: 'right', why: 'A written plan shows commitment and gives you a date to prove it.' },
          { text: 'Assign your best tech to them exclusively', kind: 'slow', why: 'It helps them and hurts every other client.' },
          { text: 'Promise it will never happen again', kind: 'risky', why: 'Promises without changes break again quickly.' },
        ],
      },
    ],
  },
  vendor: {
    label: 'Vendor raises license prices 30%',
    setup: 'A key software vendor is raising prices 30% next month across every client.',
    success: {},
    successText: 'Clients took the change well because it was explained early and fairly.',
    fail: { money: -8000 },
    failText: 'You absorbed the increase for months, and it came out of your margin.',
    steps: [
      {
        prompt: 'Review',
        options: [
          { text: 'Check your client contracts for how price changes pass through', kind: 'right', why: 'Good contracts let you pass vendor increases on with notice.' },
          { text: 'Switch every client to a different vendor this week', kind: 'risky', why: 'A rushed migration costs more than the price increase.' },
          { text: 'Ignore it until the invoice arrives', kind: 'slow', why: 'Surprises are worse for everyone than early notice.' },
        ],
      },
      {
        prompt: 'Communicate',
        options: [
          { text: 'Give clients 30 days notice with the reason and the new price', kind: 'right', why: 'Transparency keeps trust even when news is bad.' },
          { text: 'Quietly add it to next invoice', kind: 'risky', why: 'Surprise charges damage trust more than the money itself.' },
          { text: 'Absorb it to keep everyone happy', kind: 'slow', why: 'Your margins pay your techs. Absorbing every increase is not sustainable.' },
        ],
      },
    ],
  },
}

export const SITE_SLOTS = 5
export const REVENUE_PER_CLIENT = 3
export const TECH_WAGE = 3
