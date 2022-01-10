import debug from 'debug'
import { key, AUTH_SIGN_IN_REQUEST, AUTH_SIGNED_IN, AUTH_SIGN_IN_REJECTED,
  AUTH_SIGN_OUT_REQUEST, AUTH_SIGNED_OUT, AUTH_SIGN_OUT_REJECTED } from './actions'
import { anyToString } from '../store/helpers'

debug.enable('auth/reducer:*')
const log = debug('auth/reducer:log')
// const info = debug('auth/reducer:info')
// const error = debug('auth/reducer:error')

export const selectors = {
  authenticated: state => state[key].authenticated,
  signInOngoing: state => state[key].signInOngoing,
  signOutOngoing: state => state[key].signOutOngoing,
  signOutDone: state => state[key].signOutDone,
  authError: state => state[key].authError,
}

const initialState = {
  authenticated: false,
  signInOngoing: false,
  signOutOngoing: false,
  signOutDone: false,
  authError: '',
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case AUTH_SIGN_IN_REQUEST:
      return {
        ...state,
        signInOngoing: true,
        signOutDone: false,
      }
    case AUTH_SIGNED_IN: {
      log('AUTH_SIGNED_IN')
      return {
        ...state,
        authenticated: true,
        signInOngoing: false,
      }
    }
    case AUTH_SIGN_IN_REJECTED:
      return {
        ...state,
        signInOngoing: false,
        authError: anyToString(action.payload),
      }
    case AUTH_SIGN_OUT_REQUEST:
      return {
        ...state,
        signOutOngoing: true,
        signOutDone: false,
      }
    case AUTH_SIGNED_OUT:
      return {
        ...state,
        authenticated: false,
        signOutOngoing: false,
        signOutDone: true,
      }
    case AUTH_SIGN_OUT_REJECTED:
      return {
        ...state,
        signOutOngoing: false,
        signOutDone: false,
        authError: anyToString(action.payload),
      }
    default:
      return state
  }
}
