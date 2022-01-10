import { key, WS_CONNECT, WS_DISCONNECT } from './actions'

export const selectors = {
  wsConnected: state => state[key].wsConnected,
}

const initialState = {
  wsConnected: false, // WS connected?
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case WS_CONNECT:
      return {
        ...state,
        wsConnected: true,
      }
    case WS_DISCONNECT:
      return {
        ...state,
        wsConnected: false,
      }
    default:
      return state
  }
}
