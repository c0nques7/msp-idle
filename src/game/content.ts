// Ticket content: what each ticket type says and how it is worked.
// Choice steps teach the habits a real MSP tech uses.

export type TicketKind = 'alert' | 'reset' | 'software' | 'printer' | 'outage'
export type Priority = 'Low' | 'Medium' | 'Critical'
export type OptionKind = 'right' | 'slow' | 'risky'

export interface ChoiceOption {
  text: string
  kind: OptionKind
  why: string
}

export interface ChoiceStep {
  prompt: string
  options: ChoiceOption[]
}

export interface KindInfo {
  label: string
  priority: Priority
  slaMs: number
  payout: number
  hint: string
}

export const KINDS: Record<TicketKind, KindInfo> = {
  alert: {
    label: 'Monitoring alert',
    priority: 'Low',
    slaMs: 120_000,
    payout: 5,
    hint: 'Monitoring alerts come from the agent on each client machine. Read the details: a real problem needs work, but noise can be closed as a false positive in one click.',
  },
  reset: {
    label: 'Password reset',
    priority: 'Medium',
    slaMs: 60_000,
    payout: 12,
    hint: 'Password resets are the most common ticket, and a favorite way for attackers to get in. Always confirm who you are talking to first.',
  },
  software: {
    label: 'Software request',
    priority: 'Low',
    slaMs: 180_000,
    payout: 25,
    hint: 'Software needs an approval and a license before anything gets installed. Most MSPs deploy it remotely with their tools.',
  },
  printer: {
    label: 'Printer issue',
    priority: 'Medium',
    slaMs: 90_000,
    payout: 30,
    hint: 'Work from broad to narrow: find out who is affected, check the device, then fix the cause instead of the symptom.',
  },
  outage: {
    label: 'Outage',
    priority: 'Critical',
    slaMs: 60_000,
    payout: 150,
    hint: 'An outage stops a whole client from working. Confirm the scope, find the cause, and keep the client updated while you fix it. Expect a flood of related alerts.',
  },
}

// Alerts that arrive alongside an outage.
export const OUTAGE_ALERT: AlertTemplate = {
  subject: 'Mail flow check failed on {host}',
  body: 'Test message to an external mailbox was not delivered within 5 minutes.',
}

export const ALERT_WORK = 5
export const FALSE_POSITIVE_PAYOUT = 1

export interface AlertTemplate {
  subject: string
  body: string
}

// Real alerts need work. False positives can be closed with one click.
export const REAL_ALERTS: AlertTemplate[] = [
  { subject: 'Disk C: 94% full on {host}', body: 'Free space dropped from 18% to 6% over 3 days. Threshold is 90%.' },
  { subject: 'Backup job failed on {host}', body: 'Nightly backup failed: destination unreachable. Last good backup was 2 days ago.' },
  { subject: 'High CPU on {host}', body: 'CPU has been at 98% for 20 minutes. Top process: sqlservr.exe.' },
  { subject: 'Service stopped on {host}', body: 'The Print Spooler service stopped and did not restart on its own.' },
  { subject: 'Antivirus definitions out of date on {host}', body: 'Definitions have not updated in 9 days. Other machines at this client are current.' },
]

export const FALSE_ALERTS: AlertTemplate[] = [
  { subject: 'Ping timeout on {host}', body: '1 of 20 pings lost at 02:14. The host has responded normally since.' },
  { subject: 'Agent offline: {host}', body: 'Agent missed one check-in at 09:02 and checked in again at 09:04.' },
  { subject: 'High CPU on {host}', body: 'CPU hit 95% for 40 seconds during the scheduled antivirus scan, then returned to 10%.' },
  { subject: 'Disk C: 81% full on {host}', body: 'Threshold is 80%. Usage has been flat at 81% for six months on a 2 TB drive.' },
]

export interface ChoiceTemplate {
  subject: string
  body: string
  steps: ChoiceStep[]
}

const APPS = ['Adobe Acrobat Pro', 'Microsoft Visio', 'QuickBooks Desktop', 'Zoom', 'AutoCAD LT', 'Microsoft Project']

export const RESET_TEMPLATES: ChoiceTemplate[] = [
  {
    subject: 'Locked out of my account',
    body: "Hi, it's {user}. I'm locked out again and I need to get in ASAP, I have a meeting in 10 minutes.",
    steps: [
      {
        prompt: 'Verify the caller',
        options: [
          { text: 'Call them back on the number on file', kind: 'right', why: 'A callback to a known number proves you are talking to the real user.' },
          { text: 'Reset it now, they sound legit', kind: 'risky', why: 'Social engineering starts exactly like this: urgency and a believable story.' },
          { text: 'Email their manager and wait for a reply', kind: 'slow', why: 'Manager approval works, but it is slow for a routine reset when a callback does the job.' },
        ],
      },
      {
        prompt: 'Reset the password',
        options: [
          { text: 'Set a temporary password and force a change at next login', kind: 'right', why: 'Only the user ends up knowing their real password.' },
          { text: 'Set it to something simple and tell them', kind: 'risky', why: 'A simple password you both know is a weak password someone else might guess.' },
          { text: 'Turn off MFA so they can get in', kind: 'risky', why: 'Never weaken MFA to fix a login problem. It is the main thing stopping account takeovers.' },
        ],
      },
    ],
  },
  {
    subject: 'Password expired, cannot log in',
    body: "My password expired over the weekend and now it won't take my old one. Can you reset it? - {user}",
    steps: [
      {
        prompt: 'Verify the user',
        options: [
          { text: 'Confirm identity through the client’s verification process', kind: 'right', why: 'Every reset starts with verifying identity, even when the request looks routine.' },
          { text: 'Trust the email since it came from their address', kind: 'risky', why: 'Email accounts get compromised. A reset request from the inbox is not proof of identity.' },
          { text: 'Drive on-site to see them in person', kind: 'slow', why: 'It works, but a phone verification takes two minutes instead of an hour.' },
        ],
      },
      {
        prompt: 'Reset the password',
        options: [
          { text: 'Set a temporary password and force a change at next login', kind: 'right', why: 'The user picks a new password that only they know.' },
          { text: 'Set the password to never expire', kind: 'risky', why: 'Turning off expiry policy to dodge a reset breaks the client’s security policy.' },
          { text: 'Email them the new password in plain text', kind: 'risky', why: 'Passwords in email can be read by anyone with access to that mailbox.' },
        ],
      },
    ],
  },
]

export const SOFTWARE_TEMPLATES: ChoiceTemplate[] = [
  {
    subject: 'Need {app} installed',
    body: 'Hi, can I get {app} on my laptop? I need it for a project starting this week. Thanks, {user}',
    steps: [
      {
        prompt: 'Check approval',
        options: [
          { text: 'Confirm their manager approved it, per the client’s policy', kind: 'right', why: 'Software costs the client money and adds risk, so it needs sign-off first.' },
          { text: 'Install it now, it’s common software', kind: 'risky', why: 'Unapproved installs cause license bills and policy problems for the client.' },
          { text: 'Add it to the list for next month’s on-site visit', kind: 'slow', why: 'This can be done remotely today. Waiting a month blocks the user for no reason.' },
        ],
      },
      {
        prompt: 'License and install',
        options: [
          { text: 'Assign a license from the client’s pool and deploy it remotely', kind: 'right', why: 'Licensed, tracked and installed with your tools, with no visit needed.' },
          { text: 'Download a free copy from a random site', kind: 'risky', why: 'Unofficial downloads are a common way malware gets in.' },
          { text: 'Remote in and click through the installer while they watch', kind: 'slow', why: 'It works, but deploying through your RMM tool is faster and repeatable.' },
        ],
      },
    ],
  },
]

export const PRINTER_TEMPLATES: ChoiceTemplate[] = [
  {
    subject: 'Printer says offline',
    body: "The front office printer says it's offline but it's on and has paper. - {user}",
    steps: [
      {
        prompt: 'Find the scope',
        options: [
          { text: 'Ask if anyone else can print to it', kind: 'right', why: 'Scope tells you whether the problem is the printer or one PC.' },
          { text: 'Drive on-site right away', kind: 'slow', why: 'Most printer issues can be found remotely. Gather facts before rolling a truck.' },
          { text: 'Tell them to buy a new printer', kind: 'risky', why: 'Recommending hardware before you know the problem wastes the client’s money.' },
        ],
      },
      {
        prompt: 'Check the printer',
        options: [
          { text: 'Ping the printer’s IP address from the network', kind: 'right', why: 'Nobody can print, so check whether the printer is where the PCs expect it to be.' },
          { text: 'Reinstall Windows on their PC', kind: 'risky', why: 'Everyone is affected, so it is not one PC. And a reinstall is far out of proportion.' },
          { text: 'Wait an hour to see if it fixes itself', kind: 'slow', why: 'The office still cannot print. Keep troubleshooting.' },
        ],
      },
      {
        prompt: 'Fix it',
        options: [
          { text: 'It got a new IP from DHCP: add a reservation and update the port', kind: 'right', why: 'Fixing the cause means it won’t go offline again next time the address changes.' },
          { text: 'Power cycle it and close the ticket', kind: 'slow', why: 'It works for now, but it will drop offline again when the address changes.' },
          { text: 'Remove the printer from everyone’s PC', kind: 'risky', why: 'That makes the problem bigger, not smaller.' },
        ],
      },
    ],
  },
]

export const OUTAGE_TEMPLATES: ChoiceTemplate[] = [
  {
    subject: "Whole office can't get email",
    body: "Nobody here can send or receive email since about 20 minutes ago. We have clients waiting on documents. - {user}",
    steps: [
      {
        prompt: 'Confirm the scope',
        options: [
          { text: 'Check whether it affects everyone at the client or just some users', kind: 'right', why: 'The scope points you to the cause: one user is a mailbox, everyone is the service or the network.' },
          { text: 'Rebuild Outlook profiles one user at a time', kind: 'slow', why: 'Everyone is affected, so it is not one profile. This burns time on the wrong layer.' },
          { text: 'Restart their firewall in the middle of the workday', kind: 'risky', why: 'Restarting core network gear without a plan can knock out everything else too.' },
        ],
      },
      {
        prompt: 'Find the cause',
        options: [
          { text: "Check the email provider's service health page", kind: 'right', why: 'Big providers have outages too. Checking their status first can save an hour of troubleshooting.' },
          { text: "Reset every user's password", kind: 'risky', why: 'There is no sign of a security problem, and mass resets create a second outage.' },
          { text: 'Wait for more users to call in with details', kind: 'slow', why: 'You already know everyone is affected. More calls will not tell you anything new.' },
        ],
      },
      {
        prompt: 'Keep the client informed',
        options: [
          { text: 'Send a status update with what you know and when the next update comes', kind: 'right', why: 'Clients forgive outages. They do not forgive silence.' },
          { text: 'Stay quiet until it is fixed', kind: 'risky', why: 'Silence during an outage is how MSPs lose clients.' },
          { text: 'Call every user individually', kind: 'slow', why: 'One update to the office contact reaches everyone faster.' },
        ],
      },
      {
        prompt: 'Close it out',
        options: [
          { text: 'Confirm mail is flowing, then close with a summary for the client', kind: 'right', why: 'Verifying the fix and writing a summary gives the client confidence and leaves a record for next time.' },
          { text: 'Close it as soon as one email arrives', kind: 'risky', why: 'One message is not proof. Confirm sending and receiving before calling it fixed.' },
          { text: 'Leave it open for a week just in case', kind: 'slow', why: 'An open outage ticket confuses everyone. Close it and reopen if it comes back.' },
        ],
      },
    ],
  },
]

export const pickApp =(rng: () => number) => APPS[Math.floor(rng() * APPS.length)]
