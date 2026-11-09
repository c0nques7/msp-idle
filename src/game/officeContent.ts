// Stage 2 content: internal office problems, staff roles and office purchases.
import type { ChoiceStep } from './content'

export type ProblemKind = 'printer' | 'laptop' | 'wifi' | 'phishing' | 'switch' | 'backup'

/** Something in the office a problem can sit on. */
export type ProblemTarget = 'printer' | 'desk' | 'ap' | 'rack' | 'nas'

export interface ProblemInfo {
  label: string
  target: ProblemTarget
  /** Team speed multiplier while open (1 = no slowdown). */
  speed: number
  /** If set, something bad happens when the problem is left open this long. */
  deadlineMs?: number
  effectText: string
  hint: string
  steps: ChoiceStep[]
}

export const PROBLEMS: Record<ProblemKind, ProblemInfo> = {
  printer: {
    label: 'Office printer offline',
    target: 'printer',
    speed: 0.9,
    effectText: 'Team works 10% slower',
    hint: 'Your own office breaks too. Click problems in the office to work them, just like client tickets.',
    steps: [
      {
        prompt: 'Find the scope',
        options: [
          { text: 'Check whether everyone or just one tech is affected', kind: 'right', why: 'Same habit as with clients: scope first.' },
          { text: 'Order a new printer', kind: 'risky', why: 'Spending money before you know the problem is how budgets disappear.' },
          { text: 'Let everyone email documents to the front desk to print', kind: 'slow', why: 'A workaround is not a fix, and it costs the whole office time.' },
        ],
      },
      {
        prompt: 'Fix it',
        options: [
          { text: 'Give it a DHCP reservation so its address never changes', kind: 'right', why: 'Fixing the cause keeps it from going offline again.' },
          { text: 'Power cycle it and walk away', kind: 'slow', why: 'It will drop again the next time its address changes.' },
          { text: 'Install a different driver on every PC', kind: 'risky', why: 'Changing every machine for a network problem creates new problems.' },
        ],
      },
    ],
  },
  laptop: {
    label: 'New hire laptop setup',
    target: 'desk',
    speed: 1,
    effectText: 'The new hire cannot work yet',
    hint: 'Every new hire needs a laptop set up before they can work. Onboarding is a checklist: image, accounts, then permissions.',
    steps: [
      {
        prompt: 'Prepare the laptop',
        options: [
          { text: 'Deploy the standard image with updates and security tools', kind: 'right', why: 'A standard image means every machine is set up the same, secure way.' },
          { text: 'Hand over the laptop straight out of the box', kind: 'risky', why: 'Unpatched and unmanaged laptops are an easy way in for attackers.' },
          { text: 'Install every app by hand while they watch', kind: 'slow', why: 'Imaging does this in minutes, the same way every time.' },
        ],
      },
      {
        prompt: 'Create their accounts',
        options: [
          { text: 'Create accounts from the onboarding template and require MFA', kind: 'right', why: 'Templates keep access consistent, and MFA protects the account from day one.' },
          { text: "Let them share another tech's login for now", kind: 'risky', why: 'Shared logins make it impossible to know who did what.' },
          { text: 'Wait until their first week is over', kind: 'slow', why: 'They cannot do any work without accounts.' },
        ],
      },
      {
        prompt: 'Set permissions',
        options: [
          { text: 'Grant only what their role needs', kind: 'right', why: 'Least privilege limits the damage if an account is ever compromised.' },
          { text: 'Make them a domain admin to save time', kind: 'risky', why: 'Admin rights for everyone turn one mistake into a disaster.' },
          { text: 'Give no access and add things as they ask', kind: 'slow', why: 'A role template avoids days of access requests.' },
        ],
      },
    ],
  },
  wifi: {
    label: 'Wi-Fi dropping in the pod',
    target: 'ap',
    speed: 0.75,
    effectText: 'Team works 25% slower',
    hint: 'Wireless problems are usually about coverage or interference. Measure before you buy hardware.',
    steps: [
      {
        prompt: 'Measure it',
        options: [
          { text: 'Run a quick site survey of signal strength in the pod', kind: 'right', why: 'Data tells you whether it is coverage, interference or the access point.' },
          { text: 'Buy three more access points', kind: 'risky', why: 'More access points on the same channel can make interference worse.' },
          { text: 'Tell everyone to sit closer to the router', kind: 'slow', why: 'That moves the problem around instead of fixing it.' },
        ],
      },
      {
        prompt: 'Find the cause',
        options: [
          { text: "Check for a neighbor's network on the same channel", kind: 'right', why: 'Channel overlap is one of the most common causes of slow office Wi-Fi.' },
          { text: 'Factory reset the access point', kind: 'risky', why: 'That wipes the configuration and takes everyone offline.' },
          { text: 'Restart every laptop in the pod', kind: 'slow', why: 'The laptops are not the common factor. The air is.' },
        ],
      },
      {
        prompt: 'Fix it',
        options: [
          { text: 'Move the access point to a clear channel and lower its power slightly', kind: 'right', why: 'A clean channel and sensible power give stable coverage.' },
          { text: 'Turn the power up to maximum', kind: 'slow', why: 'Louder is not clearer. It often adds interference.' },
          { text: 'Switch the office to a guest network with no password', kind: 'risky', why: 'An open network lets anyone onto your MSP network.' },
        ],
      },
    ],
  },
  phishing: {
    label: 'Phishing email reported',
    target: 'desk',
    speed: 1,
    deadlineMs: 60_000,
    effectText: 'Deal with it within 60 s or someone clicks it',
    hint: "An MSP's own staff are a prime target: one stolen login can reach every client. Treat reports fast.",
    steps: [
      {
        prompt: 'Check the email',
        options: [
          { text: 'Inspect the headers and the real link destination', kind: 'right', why: 'Headers and link targets show where the email really came from.' },
          { text: 'Click the link to see where it goes', kind: 'risky', why: 'Never click a suspicious link, even to test it.' },
          { text: 'Forward it to the whole team to ask if it looks real', kind: 'risky', why: 'Now everyone has the phishing email in their inbox.' },
        ],
      },
      {
        prompt: 'Contain it',
        options: [
          { text: 'Purge the email from every mailbox that received it', kind: 'right', why: 'Removing it everywhere stops the next person from clicking.' },
          { text: 'Delete it from the reporter’s inbox only', kind: 'slow', why: 'Others probably got it too.' },
          { text: 'Ignore it, nobody clicked', kind: 'risky', why: 'You do not know that yet.' },
        ],
      },
      {
        prompt: 'Follow up',
        options: [
          { text: 'Block the sender and thank the person who reported it', kind: 'right', why: 'Blocking stops repeats, and thanking reporters keeps people reporting.' },
          { text: 'Remind the reporter to be more careful', kind: 'slow', why: 'They did the right thing. Discouraging reports makes everyone less safe.' },
          { text: 'Do nothing more', kind: 'slow', why: 'The same sender will try again tomorrow.' },
        ],
      },
    ],
  },
  switch: {
    label: 'Switch port flapping',
    target: 'rack',
    speed: 0.5,
    effectText: 'Whole office works 50% slower',
    hint: 'Network problems are worked from the bottom up: logs, then cables, then hardware.',
    steps: [
      {
        prompt: 'Look first',
        options: [
          { text: "Check the switch's logs for the port going up and down", kind: 'right', why: 'Logs tell you which port and how often, before you touch anything.' },
          { text: 'Reboot the switch right away', kind: 'risky', why: 'That drops the whole office, and the logs that explain the problem are lost.' },
          { text: 'Ask each tech whether their internet feels slow', kind: 'slow', why: 'The switch already knows exactly which port is failing.' },
        ],
      },
      {
        prompt: 'Check the cabling',
        options: [
          { text: 'Swap the patch cable on that port', kind: 'right', why: 'A damaged cable is the most common cause, and the cheapest fix.' },
          { text: 'Replace the whole switch', kind: 'risky', why: 'Expensive and slow when a $5 cable is the likely cause.' },
          { text: 'Disable the port and see who complains', kind: 'slow', why: 'You are creating a new outage to find an old one.' },
        ],
      },
      {
        prompt: 'Confirm the fix',
        options: [
          { text: 'Watch the port for a few minutes and note the fix in the docs', kind: 'right', why: 'Confirm it is stable and leave a record for next time.' },
          { text: 'Close it as soon as the light comes back', kind: 'slow', why: 'A flapping port can look fine for a minute. Watch it.' },
          { text: 'Turn off logging so the alerts stop', kind: 'risky', why: 'Silencing alerts hides the next problem.' },
        ],
      },
    ],
  },
  backup: {
    label: "Backup didn't run",
    target: 'nas',
    speed: 1,
    deadlineMs: 90_000,
    effectText: 'Fix within 90 s or risk losing data',
    hint: 'A backup you have never restored is a hope, not a backup.',
    steps: [
      {
        prompt: 'Find out why',
        options: [
          { text: 'Read the backup job log for the error', kind: 'right', why: 'The log usually names the exact cause, such as a full disk or an expired password.' },
          { text: 'Delete old backups to make room', kind: 'risky', why: 'Deleting backups to fix backups can leave you with nothing.' },
          { text: 'Wait and see if tonight’s job works', kind: 'slow', why: 'Another night without a backup is another night of risk.' },
        ],
      },
      {
        prompt: 'Prove it works',
        options: [
          { text: 'Run the job now, then test-restore a file', kind: 'right', why: 'Only a successful restore proves the backup is good.' },
          { text: 'Check that the job says Success', kind: 'slow', why: 'Jobs can report success and still produce unusable backups.' },
          { text: 'Turn off backup alerts, they are noisy', kind: 'risky', why: 'You would never know about the next failure.' },
        ],
      },
    ],
  },
}

export type Role = 'tier1' | 'tier2' | 'dispatcher' | 'internalIt'

export interface RoleInfo {
  label: string
  wage: number
  /** Milliseconds per client ticket at full speed. 0 = does not work client tickets. */
  interval: number
}

export const ROLES: Record<Role, RoleInfo> = {
  tier1: { label: 'Tier 1 tech', wage: 2, interval: 4000 },
  tier2: { label: 'Tier 2 tech', wage: 3, interval: 2800 },
  dispatcher: { label: 'Dispatcher', wage: 4, interval: 0 },
  internalIt: { label: 'Internal IT tech', wage: 5, interval: 0 },
}

export const DESK_SLOTS = 12
export const START_DESKS = 6
