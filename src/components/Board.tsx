import { KINDS } from '../game/content'
import { QUEUE_LIMIT } from '../game/engine'
import { SlaBar } from './format'
import type { Props } from './types'

export function Board({ state, dispatch, canPick }: Props & { canPick: boolean }) {
  const queue = state.tickets.filter((t) => !t.active)
  return (
    <section className="panel board">
      <div className="panel-head">
        <h2>Service board</h2>
        <span className="muted small">
          {queue.length} / {QUEUE_LIMIT} in queue
        </span>
      </div>
      {queue.length === 0 ? (
        <p className="empty">The queue is clear. New tickets will land here.</p>
      ) : (
        <div className="ticket-table" role="table" aria-label="Ticket queue">
          <div className="row head" role="row">
            <span role="columnheader">#</span>
            <span role="columnheader">Priority</span>
            <span role="columnheader">Summary</span>
            <span role="columnheader">SLA</span>
          </div>
          {queue.map((t) => (
            <button
              key={t.id}
              className={`row ticket-row${t.breached ? ' breached' : ''}`}
              role="row"
              disabled={!canPick}
              title={canPick ? 'Pick up this ticket' : 'Your screens are full. Finish or put back a ticket first.'}
              onClick={() => dispatch({ type: 'pick', id: t.id })}
            >
              <span className="id">{t.id}</span>
              <span>
                <span className={`pill pill-${t.priority.toLowerCase()}`}>{t.priority}</span>
              </span>
              <span className="summary">
                <span className="subject">{t.subject}</span>
                <span className="meta">
                  {KINDS[t.kind].label} · {state.clients[t.clientIndex]?.name}
                </span>
              </span>
              <SlaBar remaining={t.deadline - state.time} total={t.slaMs} breached={t.breached} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
