import { createLogic } from 'redux-logic'
import debug from 'debug'
import {
  signInRejected,
  AUTH_SIGN_IN_REQUEST,
  signedOut,
  signOutRejected,
  AUTH_SIGN_OUT_REQUEST,
} from './actions'
import { selectors as authSelectors } from './reducer'

debug.enable('auth/logic:*')
const log = debug('auth/logic:log')
// const info = debug('auth/logic:info')
const error = debug('auth/logic:error')

export const signInLogic = createLogic({
  type: AUTH_SIGN_IN_REQUEST,
  // cancelType: AUTH_SIGN_IN_CANCEL,
  // latest: true, // take latest only

  // use axios injected as httpClient from configureStore logic deps
  // we also have access to getState and action in the first argument
  // but they were not needed for this particular code
  async process({ httpClient, getState, action }, dispatch, done) {
    try {
      const { data: resp } = await httpClient.post(`/login${window.location.search}`, {
        originalUrlPath: window.location.pathname,
      })
      // log('signInLogic', resp.authUrl || 'no auth url provided')
      if (resp.authUrl) window.location.assign(resp.authUrl)
    } catch (err) {
      error(err) // might be a render err
      dispatch(signInRejected(err))
    } finally {
      log('signInLogic done')
      done()
    }
  },
})

export const signOutLogic = createLogic({
  type: AUTH_SIGN_OUT_REQUEST,
  // cancelType: AUTH_SIGN_OUT_CANCEL,
  // latest: true, // take latest only

  // use axios injected as httpClient from configureStore logic deps
  // we also have access to getState and action in the first argument
  // but they were not needed for this particular code
  async process({ httpClient, getState, action }, dispatch, done) {
    try {
      // log('signOutLogic /logout')
      await httpClient.get('/logout')
      const authenticated = authSelectors.authenticated(getState())
      if (authenticated) dispatch(signedOut())
    } catch (err) {
      error(err) // might be a render err
      dispatch(signOutRejected(err))
    } finally {
      log('signOutLogic done')
      done()
    }
  },
})

export default [signInLogic, signOutLogic]
