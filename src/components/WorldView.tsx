import { useEffect, useRef, useState } from 'react'
import { WorldScene, type WorldPick } from '../world/WorldScene'
import { OFFICE_WAGE, WORLD_EVENTS, WORLD_SLOTS } from '../game/worldContent'
import {
  campaignClients,
  campaignCost,
  eventCovered,
  officeCapacity,
  officeCost,
  regionEntryBlocked,
  regionName,
  worldHealthDrift,
  worldIncome,
  worldOutcomeText,
  worldProgress,
  worldRegionIncome,
  worldRevenuePerClient,
} from '../game/world'
import { regionIncome } from '../game/region'
import { shuffledOrder } from '../game/names'
import { money } from './format'
import type { Props } from './types'

export function WorldView({ state, dispatch, onOpenMap }: Props & { onOpenMap: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<WorldScene | null>(null)
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<WorldPick | null>(null)
  const refs = useRef({ dispatch, onOpenMap })
  refs.current = { dispatch, onOpenMap }

  useEffect(() => {
    if (!hostRef.current) return
    let scene: WorldScene
    try {
      scene = new WorldScene(hostRef.current, {
        onPick: (p) => (p.kind === 'home' ? refs.current.onOpenMap() : setSelected(p)),
        onHover: (text, x, y) => setHover(text ? { text, x, y } : null),
        onIntroDone: () => refs.current.dispatch({ type: 'worldIntroPlayed' }),
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

  const introPlayed = state.world?.introPlayed
  useEffect(() => {
    if (introPlayed === false) sceneRef.current?.playIntro()
  }, [introPlayed])

  const world = state.world!
  const p = worldProgress(state)
  const income = worldIncome(state) + regionIncome(state)
  const sel = selected?.kind === 'event' && !world.events.some((e) => e.id === selected.id) ? null : selected
  const close = () => setSelected(null)

  return (
    <section className="panel office map">
      <div className="office-canvas" ref={hostRef}>
        {hover && (
          <div className="office-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
            {hover.text}
          </div>
        )}
        <div className="office-hud">
          <span className="speed">Regions +{money(income)}/s</span>
          <span className="speed">
            Goal: {p.regions}/{p.total} regions · Follow-the-sun {p.sun ? '✓' : '✗'} · Global SOC {p.gsoc ? '✓' : '✗'} · IPO {p.ipo ? '✓' : '✗'}
          </span>
        </div>
        {sel?.kind === 'event' && <EventPanel state={state} dispatch={dispatch} id={sel.id} onClose={close} />}
        {sel?.kind === 'region' && <RegionPanel state={state} dispatch={dispatch} id={sel.id} onClose={close} />}
        {sel?.kind === 'slot' && <SlotPanel state={state} dispatch={dispatch} slot={sel.slot} onClose={close} />}
      </div>
      <div className="office-problems">
        {world.events.length === 0 ? (
          <span className="muted small">
            {world.regions.length === 0
              ? 'Click a closed region on the map to expand into it. Click your home region to open the regional map.'
              : 'No global events right now.'}
          </span>
        ) : (
          world.events.map((ev) => {
            const region = world.regions.find((x) => x.id === ev.regionId)
            const left = Math.max(0, Math.ceil((ev.deadline - state.time) / 1000))
            return (
              <button
                key={ev.id}
                className={`problem-chip${sel?.kind === 'event' && sel.id === ev.id ? ' selected' : ''}`}
                onClick={() => setSelected({ kind: 'event', id: ev.id })}
              >
                <strong>{WORLD_EVENTS[ev.kind].label}</strong>
                <span>
                  {region ? regionName(region) : ''} · {left}s left
                </span>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

function RegionPanel({ state, dispatch, id, onClose }: Props & { id: number; onClose: () => void }) {
  const r = state.world!.regions.find((x) => x.id === id)
  if (!r) return null
  const capacity = r.offices * officeCapacity(state)
  const drift = worldHealthDrift(state, r)
  const office = officeCost(r)
  const campaign = campaignCost(r)
  return (
    <div className="office-card" role="dialog" aria-label={regionName(r)}>
      <div className="card-head">
        <div>
          <div className="card-id">World region</div>
          <h3>{regionName(r)}</h3>
          <div className="meta">
            {r.offices} offices · {r.clients} clients · {Math.round(r.health)}% health
          </div>
        </div>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="small">
        Earns {money(r.clients * worldRevenuePerClient(state) * (r.health / 100))}/s from clients and pays {money(r.offices * OFFICE_WAGE)}/s to run
        its offices: <strong>{money(worldRegionIncome(state, r))}/s</strong> net.
      </p>
      <p className={`small ${drift < 0 ? 'fb-risky' : 'muted'}`}>
        {drift < 0
          ? `Overloaded: ${r.offices} offices can cover ${capacity} clients. Health is falling.`
          : `Offices can cover up to ${capacity} clients.${r.health < 100 ? ' Health is recovering.' : ''}`}
      </p>
      <div className="site-actions">
        <button className="secondary" disabled={state.money < office} onClick={() => dispatch({ type: 'buyWorldRegion', regionId: r.id, id: 'office' })}>
          Open another office (+{officeCapacity(state)} client capacity) · {money(office)}
        </button>
        <button className="secondary" disabled={state.money < campaign} onClick={() => dispatch({ type: 'buyWorldRegion', regionId: r.id, id: 'campaign' })}>
          Marketing campaign, +{campaignClients(state)} clients · {money(campaign)}
        </button>
      </div>
    </div>
  )
}

function SlotPanel({ state, dispatch, slot, onClose }: Props & { slot: number; onClose: () => void }) {
  const info = WORLD_SLOTS[slot]
  const blocked = regionEntryBlocked(state, slot)
  return (
    <div className="office-card" role="dialog" aria-label={info.name}>
      <div className="card-head">
        <div>
          <div className="card-id">Not open yet</div>
          <h3>Expand into {info.name}</h3>
        </div>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="small">A local entity, a first office and 20 launch clients. Running costs ${OFFICE_WAGE}/s per office.</p>
      {blocked && <p className="small fb-risky">{blocked}. Buy it in the Global panel first.</p>}
      <div className="site-actions">
        <button
          className="primary"
          disabled={!!blocked || state.money < info.cost}
          onClick={() => {
            dispatch({ type: 'enterWorldRegion', slot })
            onClose()
          }}
        >
          Enter {info.name} · {money(info.cost)}
        </button>
      </div>
    </div>
  )
}

function EventPanel({ state, dispatch, id, onClose }: Props & { id: number; onClose: () => void }) {
  const ev = state.world!.events.find((x) => x.id === id)
  if (!ev) return null
  const info = WORLD_EVENTS[ev.kind]
  const region = state.world!.regions.find((x) => x.id === ev.regionId)
  const step = info.steps[ev.stepIndex]
  const left = Math.max(0, Math.ceil((ev.deadline - state.time) / 1000))
  return (
    <div className="office-card problem-panel" role="dialog" aria-label={info.label}>
      <div className="card-head">
        <div>
          <div className="card-id">
            {region ? regionName(region) : ''} · {left}s left
          </div>
          <h3>{info.label}</h3>
          <div className="meta">
            Handled well: {worldOutcomeText(info.success)} · Badly: {worldOutcomeText(info.fail)}
          </div>
        </div>
        <button className="link" onClick={onClose}>
          Close
        </button>
      </div>
      {eventCovered(state, ev.kind) && <p className="small fb-right">Your global services have this covered either way. Work it to learn how.</p>}
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
        {shuffledOrder(step.options.length, ev.id * 11 + ev.stepIndex + 3).map((i) => {
          const opt = step.options[i]
          const tried = ev.tried.includes(i)
          return (
            <button
              key={i}
              className={`option${tried ? ` tried tried-${opt.kind}` : ''}`}
              disabled={tried}
              onClick={() => dispatch({ type: 'chooseWorldEvent', id: ev.id, option: i })}
            >
              {opt.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}
