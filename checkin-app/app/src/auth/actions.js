import debug from 'debug'
import { store } from '../store'
import { actions as wsActions } from '../websocket'
import { stateIndexes, actions as refreshActions, selectors as refreshSelectors } from '../refresh'
import { selectors as authSelectors } from './reducer'

debug.enable('auth/actions:*')
const log = debug('auth/actions:log')
// const info = debug('auth/actions:info')
const error = debug('auth/actions:error')

export const key = 'auth'

export const AUTH_SIGN_IN_REQUEST = 'AUTH_SIGN_IN_REQUEST'
export const AUTH_SIGNED_IN = 'AUTH_SIGNED_IN'
export const AUTH_SIGN_IN_REJECTED = 'AUTH_SIGN_IN_REJECTED'
export const AUTH_SIGN_OUT_REQUEST = 'AUTH_SIGN_OUT_REQUEST'
export const AUTH_SIGNED_OUT = 'AUTH_SIGNED_OUT'
export const AUTH_SIGN_OUT_REJECTED = 'AUTH_SIGN_OUT_REJECTED'
export const AUTH_CHECK_SESSION = 'AUTH_CHECK_SESSION'

export const actionTypes = {
  AUTH_SIGN_IN_REQUEST,
  AUTH_SIGNED_IN,
  AUTH_SIGN_IN_REJECTED,
  AUTH_SIGN_OUT_REQUEST,
  AUTH_SIGNED_OUT,
  AUTH_SIGN_OUT_REJECTED,
  AUTH_CHECK_SESSION,
}

// action creators
export const signInRequest = () => ({ type: AUTH_SIGN_IN_REQUEST })
export const signedIn = userInfo => {
  localStorage.setItem('userInfo', JSON.stringify(userInfo))
  return { type: AUTH_SIGNED_IN }
}
export const signedInMsg = () => {
  try {
    const userInfo = JSON.parse(localStorage.getItem('userInfo'))
    const msg = { cmd: 'signed in', data: { userInfo } }
    return wsActions.msgSend(msg)
  } catch (err) {
    error(err)
    return { type: AUTH_SIGN_IN_REJECTED, payload: err }
  }
}
export const signInRejected = err => ({
  type: AUTH_SIGN_IN_REJECTED,
  payload: err,
})
export const signOutRequest = () => ({ type: AUTH_SIGN_OUT_REQUEST })
export const signedOut = () => {
  Object.values(stateIndexes).forEach(idx => {
    // cancel all potential ongoing refresh actions
    const refreshStatus = refreshSelectors.refreshStatus(store.getState())
    if (((refreshStatus[idx] || '').match(/refreshing/) || []).length) {
      log(refreshStatus[idx], 'is ongoing?')
      store.dispatch(refreshActions.refreshCancel(idx))
    }
  })
  localStorage.removeItem('userInfo')
  return { type: AUTH_SIGNED_OUT }
}
export const signOutRejected = err => ({
  type: AUTH_SIGN_OUT_REJECTED,
  payload: err,
})
export const checkSession = () => {
  try {
    // session cookie will be sent with message if it exists
    const userInfo = JSON.parse(localStorage.getItem('userInfo'))
    const authenticated = authSelectors.authenticated(store.getState())
    const msg = { cmd: 'session check', data: { userInfo, authenticated } }
    log('checkSession', msg)
    return wsActions.msgSend(msg)
  } catch (err) {
    error(err)
    return {}
  }
}

export const actions = {
  signInRequest,
  signedIn,
  signedInMsg,
  signInRejected,
  signOutRequest,
  signedOut,
  signOutRejected,
  checkSession,
}
