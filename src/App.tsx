import { useEffect, useReducer, useRef, useState } from 'react'
import { OfficeView } from './components/OfficeView'
import { OfficeShop } from './components/OfficeShop'
import { MapView } from './components/MapView'
import { RegionShop } from './components/RegionShop'
import { WorldView } from './components/WorldView'
import { GlobalShop } from './components/GlobalShop'
import { reducer, slots, type GameState } from './game/engine'
import { loadGame, saveGame, clearSave } from './game/save'
import { StartScreen } from './components/StartScreen'
import { TopBar } from './components/TopBar'
import { Board } from './components/Board'
import { WorkArea } from './components/WorkArea'
import { Shop } from './components/Shop'
import { Feed } from './components/Feed'
import { Overlays } from './components/Overlays'

const TICK_MS = 100

export type View = 'world' | 'map' | 'office' | 'crm'

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadGame)
  const [view, setView] = useState<View>('office')
  const stateRef = useRef<GameState>(state)
  stateRef.current = state

  // Game clock. Time away from the page is paid out as idle earnings on the next load.
  useEffect(() => {
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = Math.min(1000, now - last)
      last = now
      dispatch({ type: 'tick', dt })
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [])

  // Each new stage opens on its own view.
  useEffect(() => {
    if (state.stage === 4) setView('world')
    else if (state.stage === 3) setView('map')
    else if (state.stage === 2) setView('office')
  }, [state.stage])

  // Autosave every 3 seconds and when the page closes.
  useEffect(() => {
    const id = window.setInterval(() => saveGame(stateRef.current), 3000)
    const onHide = () => saveGame(stateRef.current)
    window.addEventListener('beforeunload', onHide)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [])

  if (!state.started) {
    return <StartScreen state={state} dispatch={dispatch} />
  }

  const onReset = () => {
    clearSave()
    dispatch({ type: 'reset' })
  }

  const inOffice = state.stage >= 2 && !!state.office
  const inRegion = state.stage >= 3 && !!state.region
  const inWorld = state.stage === 4 && !!state.world
  // Stage 2 has no map, so fall back to the office.
  const current: View = (view === 'map' && !inRegion) || (view === 'world' && !inWorld) ? 'office' : view
  const showOffice = inOffice && current === 'office'
  const showMap = inRegion && current === 'map'
  const showWorld = inWorld && current === 'world'

  return (
    <div className="app">
      <TopBar
        state={state}
        dispatch={dispatch}
        onReset={onReset}
        view={inOffice ? current : null}
        onView={setView}
      />
      {showWorld ? (
        <main className="layout layout-office">
          <WorldView state={state} dispatch={dispatch} onOpenMap={() => setView('map')} />
          <aside className="side">
            <GlobalShop state={state} dispatch={dispatch} />
            <Feed state={state} />
          </aside>
        </main>
      ) : showMap ? (
        <main className="layout layout-office">
          <MapView state={state} dispatch={dispatch} onOpenOffice={() => setView('office')} />
          <aside className="side">
            <RegionShop state={state} dispatch={dispatch} />
            <Feed state={state} />
          </aside>
        </main>
      ) : showOffice ? (
        <main className="layout layout-office">
          <OfficeView state={state} dispatch={dispatch} onOpenCrm={() => setView('crm')} />
          <aside className="side">
            <OfficeShop state={state} dispatch={dispatch} />
            <Feed state={state} />
          </aside>
        </main>
      ) : (
        <main className="layout">
          <Board state={state} dispatch={dispatch} canPick={state.tickets.filter((t) => t.active).length < slots(state)} />
          <WorkArea state={state} dispatch={dispatch} />
          <aside className="side">
            {inOffice ? <OfficeShop state={state} dispatch={dispatch} /> : <Shop state={state} dispatch={dispatch} />}
            <Feed state={state} />
          </aside>
        </main>
      )}
      <Overlays state={state} dispatch={dispatch} onEnterOffice={() => setView('office')} onEnterMap={() => setView('map')} onEnterWorld={() => setView('world')} />
    </div>
  )
}
