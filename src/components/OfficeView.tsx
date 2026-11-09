import { useEffect, useRef, useState } from 'react'
import { OfficeScene, type Pick } from '../office/OfficeScene'
import { PROBLEMS, ROLES } from '../game/officeContent'
import { teamSpeed } from '../game/office'
import type { Props } from './types'

export function OfficeView({ state, dispatch, onOpenCrm }: Props & { onOpenCrm: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [staffCard, setStaffCard] = useState<number | null>(null)
  const callbacks = useRef({ onOpenCrm, dispatch })
  callbacks.current = { onOpenCrm, dispatch }

  useEffect(() => {
    if (!hostRef.current) return
    let scene: OfficeScene
    try {
      scene = new OfficeScene(hostRef.current, {
        onPick: (p: Pick) => {
          if (p.kind === 'crm') callbacks.current.onOpenCrm()
          if (p.kind === 'problem') {
            setSelected(p.id)
            setStaffCard(null)
          }
          if (p.kind === 'staff') {
            setStaffCard(p.id)
            setSelected(null)
          }
        },
        onHover: (text, x, y) => setHover(text ? { text, x, y } : null),
        onIntroDone: () => callbacks.current.dispatch({ type: 'introPlayed' }),
      })
    } catch {
      return
    }
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.update(state)
  }, [state])

  const introPlayed = state.office?.introPlayed
  useEffect(() => {
    if (introPlayed === false) sceneRef.current?.playIntro()
  }, [introPlayed])

  const o = state.office!
  const problem = o.problems.find((p) => p.id === selected)
  const member = o.staff.find((x) => x.id === staffCard)
  const speed = teamSpeed(state)

  return (
    <section className="panel office">
      <div className="office-canvas" ref={hostRef}>
        {hover && (
          <div className="office-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
            {hover.text}
          </div>
        )}
        <div className="office-hud">
          <span className={`speed ${speed < 1 ? 'speed-slow' : ''}`}>Team speed {Math.round(speed * 100)}%</span>
          {o.problems.length > 0 && (
            <span className="speed speed-slow">
              {o.problems.length} office problem{o.problems.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {problem && <ProblemPanel state={state} dispatch={dispatch} id={problem.id} onClose={() => setSelected(null)} />}
        {member && (
          <div className="office-card">
            <div className="card-head">
              <div>
                <h3>{member.name}</h3>
                <div className="meta">
                  {ROLES[member.role].label} · ${ROLES[member.role].wage}/s
                </div>
              </div>
              <button className="link" onClick={() => setStaffCard(null)}>
                Close
              </button>
            </div>
            <p className="small">
              {member.ready
                ? ROLES[member.role].interval > 0
                  ? `Working client tickets, about one every ${(ROLES[member.role].interval / 1000 / speed).toFixed(1)} s.`
                  : member.role === 'dispatcher'
                    ? 'Routing tickets so the whole team works 15% faster.'
                    : 'Fixing office problems on their own, one every 20 s.'
                : 'Waiting for their laptop to be set up. Click the marker over their desk.'}
            </p>
          </div>
        )}
      </div>
      <div className="office-problems">
        {o.problems.length === 0 ? (
          <span className="muted small">No office problems right now. Techs are at full speed.</span>
        ) : (
          o.problems.map((p) => {
            const info = PROBLEMS[p.kind]
            const left = p.deadline !== undefined ? Math.max(0, Math.ceil((p.deadline - state.time) / 1000)) : null
            return (
              <button key={p.id} className={`problem-chip${selected === p.id ? ' selected' : ''}`} onClick={() => setSelected(p.id)}>
                <strong>{info.label}</strong>
                <span>
                  {info.effectText}
                  {left !== null ? ` · ${left}s left` : ''}
                </span>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

function ProblemPanel({ state, dispatch, id, onClose }: Props & { id: number; onClose: () => void }) {
  const p = state.office!.problems.find((x) => x.id === id)!
  const info = PROBLEMS[p.kind]
  const step = p.steps[p.stepIndex]
  const member = state.office!.staff.find((x) => x.id === p.staffId)
  const left = p.deadline !== undefined ? Math.max(0, Math.ceil((p.deadline - state.time) / 1000)) : null
  return (
    <div className="office-card problem-panel" role="dialog" aria-label={info.label}>
      <div className="card-head">
        <div>
          <div className="card-id">Internal ticket{member ? ` · ${member.name}` : ''}</div>
          <h3>{info.label}</h3>
          <div className="meta">
            {info.effectText}
            {left !== null ? ` · ${left}s left` : ''}
          </div>
        </div>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      {p.stepIndex === 0 && !p.feedback && <p className="hint-inline small">{info.hint}</p>}
      <div className="step-head">
        Step {p.stepIndex + 1} of {p.steps.length}: <strong>{step.prompt}</strong>
      </div>
      {p.feedback && (
        <p className={`feedback fb-${p.feedback.kind}`}>
          {p.feedback.kind === 'right' ? 'Correct. ' : p.feedback.kind === 'risky' ? 'Risky. ' : 'Slow. '}
          {p.feedback.text}
        </p>
      )}
      <div className="options">
        {step.options.map((opt, i) => {
          const tried = p.tried.includes(i)
          return (
            <button
              key={i}
              className={`option${tried ? ` tried tried-${opt.kind}` : ''}`}
              disabled={tried}
              onClick={() => dispatch({ type: 'chooseProblem', id: p.id, option: i })}
            >
              {opt.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
