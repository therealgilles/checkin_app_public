import debug from 'debug'
import { key, TOPMENU_UPDATE_CONTENT } from './actions'

debug.enable('topmenu/reducer:*')
// const log = debug('topmenu/reducer:log')
// const info = debug('topmenu/reducer:info')
// const error = debug('topmenu/reducer:error')

export const selectors = {
  content: state => state[key].content,
}

const initialState = {
  content: null,
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case TOPMENU_UPDATE_CONTENT: {
      const content = action.payload
      return {
        ...state,
        content,
      }
    }
    default:
      return state
  }
}
