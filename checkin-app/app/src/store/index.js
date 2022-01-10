import { createStore, applyMiddleware, compose } from 'redux'
import { routerMiddleware } from 'connected-react-router'
import { createLogicMiddleware } from 'redux-logic'
import { createBrowserHistory, createMemoryHistory } from 'history'
import axios from 'axios'
import debug from 'debug'
import rootReducer from './rootReducer'
import logic from './rootLogic'
import { actions as wsActions } from '../websocket'

debug.enable('store/index:*')
// const log = debug('store/index:log')
// const info = debug('store/index:info')
// const error = debug('store/index:error')

const storeMiddlewareSetup = ({ isServer, serverUrl }) => {
  const history = isServer
    ? createMemoryHistory({
        initialEntries: [serverUrl],
      })
    : createBrowserHistory()

  const deps = {
    // injected dependencies for logic
    httpClient: axios,
  }

  // add all redux-logic middlewares and deps
  const logicMiddleware = createLogicMiddleware(logic, deps)
  // logicMiddleware.monitor$.subscribe(x => log(x))

  const enhancers = []
  const middleware = [logicMiddleware, routerMiddleware(history)]

  if (process.env.NODE_ENV === 'development' && !isServer) {
    const devToolsExtension = window.devToolsExtension

    if (typeof devToolsExtension === 'function') {
      // connect to redux devtools if available
      enhancers.push(devToolsExtension())
    }
  }

  const composeEnhancer = (!isServer && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose
  const composedEnhancers = composeEnhancer(applyMiddleware(...middleware), ...enhancers)

  return { history, composedEnhancers, logicMiddleware }
}

export const getStore = ({ isServer, serverUrl = '/' } = {}) => {
  let preloadedState

  const { history, composedEnhancers, logicMiddleware } = storeMiddlewareSetup({
    isServer,
    serverUrl,
  })

  if (!isServer) {
    preloadedState = window.__PRELOADED_STATE__
    delete window.__PRELOADED_STATE__
  }

  const store = createStore(rootReducer(history), preloadedState, composedEnhancers)

  // used in serverRender
  store.logicMiddleware = logicMiddleware

  if (process.env.NODE_ENV !== 'production') {
    if (module.hot) {
      module.hot.accept('./', () => {
        store.replaceReducer(rootReducer(history))
        store.dispatch(wsActions.msgListen()) // restart listening to websocket
      })
    }
  }

  !isServer && store.dispatch(wsActions.msgListen()) // start listening to webSocket on app load

  return { store, history }
}

// on the client, we initialize the store once
export const { store, history } = process.browser ? getStore() : {}
