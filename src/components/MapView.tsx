import { useEffect, useRef, useState } from 'react'
import { RegionScene, type MapPick } from '../region/RegionScene'
import { EVENTS, SITE_SLOTS, TECH_WAGE } from '../game/regionContent'
import {
  REGION_ITEMS,
  clientsPerTech,
  exitProgress,
  healthDrift,
  hireCost,
  marketingCost,
  outcomeText,
  regionIncome,
  revenuePerClient,
  siteIncome,
} from '../game/region'
import { money } from './format'
import { mulberry32 } from '../game/names'
import type { Props } from './types'

type Selection = MapPick | null

export function MapView({ state, dispatch, onOpenOffice }: Props & { onOpenOffice: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RegionScene | null>(null)
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<Selection>(null)
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  useEffect(() => {
    if (!hostRef.current) return
    let scene: RegionScene
    try {
      scene = new RegionScene(hostRef.current, {
        onPick: (p) => setSelected(p),
        onHover: (text, x, y) => setHover(text ? { text, x, y } : null),
        onIntroDone: () => dispatchRef.current({ type: 'regionIntroPlayed' }),
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

  const introPlayed = state.region?.introPlayed
  useEffect(() => {
    if (introPlayed === false) sceneRef.current?.playIntro()
  }, [introPlayed])

  const reg = state.region!
  const progress = exitProgress(state)
  const income = regionIncome(state)
  // A selected event that has resolved closes its panel.
  const sel = selected?.kind === 'event' && !reg.events.some((e) => e.id === selected.id) ? null : selected

  return (
    <section className="panel office map">
      <div className="office-canvas" ref={hostRef}>
        {hover && (
          <div className="office-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
            {hover.text}
          </div>
        )}
        <div className="office-hud">
          <span className={`speed ${income < 0 ? 'speed-slow' : ''}`}>
            Sites {income >= 0 ? '+' : ''}
            {money(income)}/s
          </span>
          <span className="speed">
            Goal: {progress.sites}/{SITE_SLOTS} sites · NOC {progress.noc ? '✓' : '✗'} · SOC {progress.soc ? '✓' : '✗'}
          </span>
        </div>
        {sel?.kind === 'event' && <EventPanel state={state} dispatch={dispatch} id={sel.id} onClose={() => setSelected(null)} />}
        {sel?.kind === 'site' && (
          <SitePanel state={state} dispatch={dispatch} id={sel.id} onClose={() => setSelected(null)} onOpenOffice={onOpenOffice} />
        )}
        {sel?.kind === 'slot' && <SlotPanel state={state} dispatch={dispatch} onClose={() => setSelected(null)} />}
      </div>
      <div className="office-problems">
        {reg.events.length === 0 ? (
          <span className="muted small">No events right now. Your sites are running on their own.</span>
        ) : (
          reg.events.map((ev) => {
            const site = reg.sites.find((x) => x.id === ev.siteId)
            const left = Math.max(0, Math.ceil((ev.deadline - state.time) / 1000))
            return (
              <button
                key={ev.id}
                className={`problem-chip${sel?.kind === 'event' && sel.id === ev.id ? ' selected' : ''}`}
                onClick={() => setSelected({ kind: 'event', id: ev.id })}
              >
                <strong>{EVENTS[ev.kind].label}</strong>
                <span>
                  {site?.name} · {left}s left
                </span>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

function SitePanel({ state, dispatch, id, onClose, onOpenOffice }: Props & { id: number; onClose: () => void; onOpenOffice: () => void }) {
  const site = state.region!.sites.find((x) => x.id === id)
  if (!site) return null
  const capacity = site.techs * clientsPerTech(state)
  const drift = healthDrift(state, site)
  const hire = hireCost(site)
  const mkt = marketingCost(site)
  return (
    <div className="office-card" role="dialog" aria-label={site.name}>
      <div className="card-head">
        <div>
          <div className="card-id">{site.hq ? 'Headquarters' : 'Branch site'}</div>
          <h3>{site.name}</h3>
          <div className="meta">
            {site.techs} techs · {site.clients} clients · {Math.round(site.health)}% health
          </div>
        </div>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="small">
        Earns {money(site.clients * revenuePerClient(state) * (site.health / 100))}/s from clients and pays {money(site.techs * TECH_WAGE)}/s in
        wages: <strong>{money(siteIncome(state, site))}/s</strong> net.
      </p>
      <p className={`small ${drift < 0 ? 'fb-risky' : 'muted'}`}>
        {drift < 0
          ? `Understaffed: ${site.techs} techs can cover ${capacity} clients. Health is falling.`
          : `Staffed for up to ${capacity} clients.${site.health < 100 ? ' Health is recovering.' : ''}`}
      </p>
      <div className="site-actions">
        <button className="secondary" disabled={state.money < hire} onClick={() => dispatch({ type: 'buySite', siteId: site.id, id: 'hireTech' })}>
          Hire a tech · {money(hire)}
        </button>
        <button className="secondary" disabled={state.money < mkt} onClick={() => dispatch({ type: 'buySite', siteId: site.id, id: 'marketing' })}>
          Local marketing, +5 clients · {money(mkt)}
        </button>
        {site.hq && (
          <button className="link" onClick={onOpenOffice}>
            Open the HQ office
          </button>
        )}
      </div>
    </div>
  )
}

function SlotPanel({ state, dispatch, onClose }: Props & { onClose: () => void }) {
  const items = REGION_ITEMS.filter((x) => (x.id === 'openSite' || x.id === 'acquire') && !x.done(state))
  return (
    <div className="office-card" role="dialog" aria-label="Empty site">
      <div className="card-head">
        <div>
          <div className="card-id">Empty slot</div>
          <h3>Grow into a new town</h3>
        </div>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="site-actions">
        {items.map((it) => (
          <button
            key={it.id}
            className="secondary"
            disabled={state.money < it.cost(state)}
            onClick={() => {
              dispatch({ type: 'buyRegion', id: it.id })
              onClose()
            }}
          >
            <strong>{it.name}</strong> · {money(it.cost(state))}
            <span className="small muted block">{it.effect}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function EventPanel({ state, dispatch, id, onClose }: Props & { id: number; onClose: () => void }) {
  const ev = state.region!.events.find((x) => x.id === id)
  if (!ev) return null
  const info = EVENTS[ev.kind]
  const site = state.region!.sites.find((x) => x.id === ev.siteId)
  const step = info.steps[ev.stepIndex]
  const left = Math.max(0, Math.ceil((ev.deadline - state.time) / 1000))
  return (
    <div className="office-card problem-panel" role="dialog" aria-label={info.label}>
      <div className="card-head">
        <div>
          <div className="card-id">
            {site?.name} · {left}s left
          </div>
          <h3>{info.label}</h3>
          <div className="meta">
            Handled well: {outcomeText(info.success)} · Badly: {outcomeText(info.fail)}
          </div>
        </div>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      {ev.stepIndex === 0 && !ev.feedback && <p className="hint-inline small">{info.setup}</p>}
      <div className="step-head">
        Step {ev.stepIndex + 1} of {info.steps.length}: <strong>{step.prompt}</strong>
      </div>
      {ev.feedback && (
        <p className={`feedback fb-${ev.feedback.kind}`}>
          {ev.feedback.kind === 'right' ? 'Correct. ' : ev.feedback.kind === 'risky' ? 'Risky. ' : 'Slow. '}
          {ev.feedback.text}
        </p>
      )}
      <div className="options">
        {shuffledOrder(step.options.length, ev.id * 7 + ev.stepIndex).map((i) => {
          const opt = step.options[i]
          const tried = ev.tried.includes(i)
          return (
            <button
              key={i}
              className={`option${tried ? ` tried tried-${opt.kind}` : ''}`}
              disabled={tried}
              onClick={() => dispatch({ type: 'chooseEvent', id: ev.id, option: i })}
            >
              {opt.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** A stable shuffle per event step, so the right answer isn't always in the same place. */
function shuffledOrder(n: number, seed: number): number[] {
  const rng = mulberry32(seed)
  const order = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}
