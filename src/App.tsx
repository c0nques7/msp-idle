import { useEffect, useReducer, useRef, useState } from 'react'
import { OfficeView } from './components/OfficeView'
import { OfficeShop } from './components/OfficeShop'
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

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadGame)
  const [view, setView] = useState<'office' | 'crm'>('office')
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

  const inOffice = state.stage === 2 && state.office
  const showOffice = inOffice && view === 'office'

  return (
    <div className="app">
      <TopBar
        state={state}
        dispatch={dispatch}
        onReset={onReset}
        view={inOffice ? view : null}
        onView={setView}
      />
      {showOffice ? (
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
      <Overlays state={state} dispatch={dispatch} onEnterOffice={() => setView('office')} />
    </div>
  )
}
