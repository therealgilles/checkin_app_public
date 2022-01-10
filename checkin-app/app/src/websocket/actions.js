import debug from 'debug'
import { store } from '../store'
import { actions as refreshActions, stateIndexes, refreshEndpoints } from '../refresh'
import { actions as authActions, selectors as authSelectors } from '../auth'
import { isCancelledRequestId, setClientId } from './helpers'

debug.enable('websocket/actions:*')
const log = debug('websocket/actions:log')
const info = debug('websocket/actions:info')
// const error = debug('websocket/actions:error')

export const key = 'websocket'

export const WS_MSG_SEND = 'WS_MSG_SEND'
export const WS_MSG_LISTEN = 'WS_MSG_LISTEN'
export const WS_MSG_STOP_LISTENING = 'WS_MSG_STOP_LISTENING'
export const WS_MSG_RECEIVED = 'WS_MSG_RECEIVED'
export const WS_MSG_DISCARDED = 'WS_MSG_DISCARDED'
export const WS_MSG_ERROR = 'WS_MSG_ERROR'
export const WS_CONNECT = 'WS_CONNECT'
export const WS_DISCONNECT = 'WS_DISCONNECT'

export const actionTypes = {
  WS_MSG_SEND,
  WS_MSG_LISTEN,
  WS_MSG_STOP_LISTENING,
  WS_MSG_RECEIVED,
  WS_MSG_ERROR,
  WS_CONNECT,
  WS_DISCONNECT,
}

// NOTE: dispatch action here based on received message content
// NOTE: we can stringify/parse the message here if needed
export const msgListen = () => ({ type: WS_MSG_LISTEN })
export const msgSend = msg => {
  log('msgSend', msg)
  return { type: WS_MSG_SEND, payload: msg }
}
export const msgReceived = msg => {
  log('msgReceived', msg)
  const { reqId, clientId, cmd, data } = msg
  const cmdMatch = cmd.match(/^(?:no )?(items|registrants|users) updated$/)
  const authenticated = authSelectors.authenticated(store.getState())

  // discard message if its ID is part of the cancelled request IDs
  if (isCancelledRequestId(reqId)) {
    info(`Cancelling message with request ID ${reqId}`)
    return { type: WS_MSG_DISCARDED }
  }

  if (cmd === 'send first connect') {
    if (clientId) setClientId(clientId)
    const userInfo = JSON.parse(localStorage.getItem('userInfo'))
    const sendMsg = { cmd: 'first connect', data: { userInfo, authenticated } }
    return msgSend(sendMsg)
  }

  if (cmd === 'send session check') {
    return authActions.checkSession()
  }

  if (cmd === 'logout') {
    return authActions.signedOut()
  }

  if (cmd === 'send get settings') {
    if (!authenticated) {
      log('skipping get settings when not authenticated')
      return { type: WS_MSG_DISCARDED }
    }

    return msgSend({ cmd: 'get settings', data })
  }

  if (cmd === 'send refresh request') {
    if (!authenticated) {
      log('skipping refresh request when not authenticated')
      return { type: WS_MSG_DISCARDED }
    }

    return refreshActions.refreshRequest(
      stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST,
      'skipRefresh'
    )
  }

  if (cmdMatch) {
    // items/registrants/users updated
    if (!authenticated) {
      log('skipping refresh request when not authenticated')
      return { type: WS_MSG_DISCARDED }
    }

    const refreshGroups = refreshEndpoints.filter(re => re.endpoint === cmdMatch[1])
    // log(`dispatching refresh request for ${refreshGroups}`)
    return refreshActions.refreshRequest(
      stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST,
      'skipRefresh',
      refreshGroups
    )
  }

  if (cmd === 'login') {
    const { userInfo } = data
    log('received login message', data)
    store.dispatch(authActions.signedIn(userInfo))
    return authActions.signedInMsg()
  }

  // forward message to other reducers
  return { type: WS_MSG_RECEIVED, payload: msg }
}

export const actions = {
  msgListen,
  msgSend,
  msgReceived,
}
