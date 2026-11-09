import { KINDS } from '../game/content'
import { clickPower, has, slots, type Ticket } from '../game/engine'
import { SlaBar } from './format'
import type { Props } from './types'

export function WorkArea({ state, dispatch }: Props) {
  const active = state.tickets.filter((t) => t.active)
  const empty = slots(state) - active.length
  return (
    <section className="panel work">
      <div className="panel-head">
        <h2>My tickets</h2>
        <span className="muted small">
          {active.length} / {slots(state)} screens in use
        </span>
      </div>
      <div className="work-cards">
        {active.map((t) => (
          <TicketCard key={t.id} ticket={t} state={state} dispatch={dispatch} />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`empty-${i}`} className="card empty-card">
            Pick a ticket from the service board to start working it.
          </div>
        ))}
      </div>
    </section>
  )
}

function TicketCard({ ticket: t, state, dispatch }: Props & { ticket: Ticket }) {
  const info = KINDS[t.kind]
  const client = state.clients[t.clientIndex]
  const showHint = !state.hintsSeen.includes(t.kind)
  return (
    <article className={`card ticket-card${t.breached ? ' breached' : ''}`}>
      {showHint && (
        <div className="hint">
          <strong>New ticket type: {info.label}</strong>
          <p>{info.hint}</p>
          <button className="link" onClick={() => dispatch({ type: 'dismissHint', kind: t.kind })}>
            Got it
          </button>
        </div>
      )}
      <header className="card-head">
        <div>
          <div className="card-id">
            #{t.id} · {info.label} <span className={`pill pill-${t.priority.toLowerCase()}`}>{t.priority}</span>
          </div>
          <h3>{t.subject}</h3>
          <div className="meta">
            {t.user} · {client?.name}
          </div>
        </div>
        <button className="link" onClick={() => dispatch({ type: 'release', id: t.id })}>
          Put back
        </button>
      </header>
      <SlaBar remaining={t.deadline - state.time} total={t.slaMs} breached={t.breached} />
      <blockquote className="message">{t.body}</blockquote>
      {t.kind === 'alert' ? <AlertActions ticket={t} state={state} dispatch={dispatch} /> : <ChoiceActions ticket={t} state={state} dispatch={dispatch} />}
      <footer className="card-foot">
        <button className="link danger" onClick={() => dispatch({ type: 'escalate', id: t.id })}>
          Escalate to senior tech (half pay)
        </button>
      </footer>
    </article>
  )
}

function AlertActions({ ticket: t, state, dispatch }: Props & { ticket: Ticket }) {
  const work = t.work ?? 0
  const needed = t.workNeeded ?? 5
  return (
    <div className="actions">
      {t.feedback && <p className={`feedback fb-${t.feedback.kind}`}>{t.feedback.text}</p>}
      <div className="progress" aria-label={`Work ${work} of ${needed}`}>
        <div className="progress-fill" style={{ width: `${(work / needed) * 100}%` }} />
      </div>
      <div className="button-row">
        <button className="primary" onClick={() => dispatch({ type: 'work', id: t.id })}>
          Work it (+{clickPower(state)})
        </button>
        <button className="secondary" onClick={() => dispatch({ type: 'falsePositive', id: t.id })}>
          Close as false positive
        </button>
      </div>
    </div>
  )
}

function ChoiceActions({ ticket: t, state, dispatch }: Props & { ticket: Ticket }) {
  if (!t.steps || t.stepIndex === undefined) return null
  const step = t.steps[t.stepIndex]
  const runbook = has(state, 'runbook') && state.closedByKind[t.kind] >= 5 && t.stepIndex === 0
  return (
    <div className="actions">
      <div className="step-head">
        Step {t.stepIndex + 1} of {t.steps.length}: <strong>{step.prompt}</strong>
      </div>
      {t.feedback && (
        <p className={`feedback fb-${t.feedback.kind}`}>
          {t.feedback.kind === 'right' ? 'Correct. ' : t.feedback.kind === 'risky' ? 'Risky. ' : 'Slow. '}
          {t.feedback.text}
        </p>
      )}
      <div className="options">
        {step.options.map((o, i) => {
          const tried = t.tried?.includes(i)
          return (
            <button
              key={i}
              className={`option${tried ? ` tried tried-${o.kind}` : ''}${runbook && o.kind === 'right' ? ' runbook' : ''}`}
              disabled={tried}
              onClick={() => dispatch({ type: 'choose', id: t.id, option: i })}
            >
              {o.text}
              {runbook && o.kind === 'right' && <span className="tag">Runbook</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
