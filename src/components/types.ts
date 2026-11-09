import type { Dispatch } from 'react'
import type { Action, GameState } from '../game/engine'

export interface Props {
  state: GameState
  dispatch: Dispatch<Action>
}
