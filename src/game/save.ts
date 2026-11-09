import { applyAwayTime, newGame, type GameState } from './engine'

const KEY = 'msp-idle-save-v1'

/** Brings older saves up to the current shape. */
function migrate(raw: Record<string, unknown>): GameState | null {
  if (raw.version === 3) return raw as unknown as GameState
  if (raw.version === 2) return { ...(raw as unknown as GameState), version: 3, stage: 1, office: null }
  if (raw.version !== 1) return null
  const base = newGame(raw.seed as number)
  const v1 = raw as unknown as GameState & { upgrades: Record<string, boolean> }
  const { junior, ...upgrades } = v1.upgrades
  return {
    ...base,
    ...v1,
    version: 3,
    stage: 1,
    office: null,
    upgrades,
    juniors: junior ? 1 : 0,
    closedByKind: { ...base.closedByKind, ...v1.closedByKind },
    breaches: 0,
    seniorTimer: 0,
    announced: base.announced,
    toasts: [],
    promoted: false,
    showPromotion: false,
    welcomeBack: null,
    savedAt: Date.now(),
  }
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const state = migrate(JSON.parse(raw))
      if (state) return applyAwayTime(state, Date.now())
    }
  } catch {
    // Storage unavailable or corrupt save: start fresh.
  }
  return newGame()
}

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }))
  } catch {
    // Ignore storage failures (private mode, quota).
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
