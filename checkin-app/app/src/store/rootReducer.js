import debug from 'debug'
import { combineReducers } from 'redux'
import { connectRouter } from 'connected-react-router'
import { key as refreshKey, reducer as refreshReducer } from '../refresh'
import { key as checkinKey, reducer as checkinReducer } from '../checkin'
import { key as websocketKey, reducer as websocketReducer } from '../websocket'
import { key as authKey, reducer as authReducer } from '../auth'
import { key as uiKey, reducer as uiReducer } from '../ui'
import { key as searchKey, reducer as searchReducer } from '../search'
import { key as historyKey, reducer as historyReducer } from '../history'
import { key as orderUpdateKey, reducer as orderUpdateReducer } from '../order'
import { key as metaDataKey, reducer as metaDataReducer } from '../metadata'
import { key as topMenuKey, reducer as topMenuReducer } from '../components/topmenu'
import { AUTH_SIGNED_OUT } from '../auth/actions'

debug.enable('store/rootReducer:*')
// const log = debug('store/rootReducer:log')
// const info = debug('store/rootReducer:info')
// const error = debug('store/rootReducer:error')

export default history => {
  const appReducer = combineReducers({
    router: connectRouter(history),
    [refreshKey]: refreshReducer,
    [checkinKey]: checkinReducer,
    [websocketKey]: websocketReducer,
    [authKey]: authReducer,
    [uiKey]: uiReducer,
    [searchKey]: searchReducer,
    [historyKey]: historyReducer,
    [orderUpdateKey]: orderUpdateReducer,
    [metaDataKey]: metaDataReducer,
    [topMenuKey]: topMenuReducer,
  })

  const rootReducer = (state, action) => {
    // log('rootReducer', action)
    if (action.type === AUTH_SIGNED_OUT) {
      // on logout, reset everything except router
      const { router } = state
      state = { router } // eslint-disable-line no-param-reassign
    }
    return appReducer(state, action)
  }

  return rootReducer
}
