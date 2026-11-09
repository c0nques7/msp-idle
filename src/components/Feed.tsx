import type { GameState } from '../game/engine'

export function Feed({ state }: { state: GameState }) {
  return (
    <section className="panel feed">
      <div className="panel-head">
        <h2>Activity</h2>
      </div>
      {state.feed.length === 0 ? (
        <p className="empty">Closed tickets and events show up here.</p>
      ) : (
        <ul className="feed-list">
          {state.feed.map((f) => (
            <li key={f.id} className={`feed-item tone-${f.tone}`}>
              {f.text}
              {f.detail && <span className="feed-detail">{f.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
