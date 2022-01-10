import debug from 'debug'
import { actionTypes as wsActionTypes } from '../websocket'

debug.enable('refresh/actions:*')
// const log = debug('refresh/actions:log')
// const info = debug('refresh/actions:info')
// const error = debug('refresh/actions:error')

// unique key namespace used by combineReducers.
// By convention it will match the directory structure to
// make it easy to locate the src.
// Also action types will prefix with the capitalized version
export const key = 'refresh'

// action type constants
export const REFRESH_REQUEST = 'REFRESH_REQUEST'
export const REFRESH_CANCEL = 'REFRESH_CANCEL'
export const REFRESH_FULFILLED = 'REFRESH_FULFILLED'
export const REFRESH_REJECTED = 'REFRESH_REJECTED'
export const REFRESH_MSG_RECEIVED = wsActionTypes.WS_MSG_RECEIVED // use same string as websocket WS_MSG_RECEIVED
export const REFRESH_UPDATE_INFO = 'REFRESH_UPDATE_INFO'

export const actionTypes = {
  REFRESH_REQUEST,
  REFRESH_CANCEL,
  REFRESH_FULFILLED,
  REFRESH_REJECTED,
  REFRESH_MSG_RECEIVED,
  REFRESH_UPDATE_INFO,
}

export const REFRESH_IDX_BUTTON_REFRESH = 'settings refresh button' // refresh button
export const REFRESH_IDX_BUTTON_GET_DATA = 'settings get data' // get data button
export const REFRESH_IDX_STORE_INIT = 'store init' // store init at app load
export const REFRESH_IDX_MSG_RECEIVED = 'update message received' // update message received
// items/registrants/users update on server, trigger corresponding refresh
export const REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST = 'message received dispatch refresh'

export const stateIndexes = {
  REFRESH_IDX_BUTTON_REFRESH,
  REFRESH_IDX_BUTTON_GET_DATA,
  REFRESH_IDX_STORE_INIT,
  REFRESH_IDX_MSG_RECEIVED,
  REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST,
}

export const refreshEndpoints = [
  { endpoint: 'items' },
  { endpoint: 'registrants', query: 'filterByItems=true' }, // only get registrants with matching items
  { endpoint: 'users' },
]

// action creators
export const refreshRequest = (
  idx = REFRESH_IDX_STORE_INIT,
  refreshType = 'skipRefresh',
  refreshGroups = refreshEndpoints,
  ev
) => ({
  type: REFRESH_REQUEST,
  payload: [idx, refreshType, refreshGroups],
})
export const refreshCancel = idx => ({ type: REFRESH_CANCEL, payload: idx })
export const refreshFulfilled = (idx, refreshData, refreshGroups) => ({
  type: REFRESH_FULFILLED,
  payload: [idx, refreshData, refreshGroups],
})
export const refreshRejected = (idx, refreshGroups, err) => ({
  type: REFRESH_REJECTED,
  payload: [idx, refreshGroups, err],
})
export const refreshUpdateInfo = (status, refreshGroups) => ({
  type: REFRESH_UPDATE_INFO,
  payload: [status, refreshGroups],
})

export const actions = {
  refreshRequest,
  refreshCancel,
  refreshFulfilled,
  refreshRejected,
}
