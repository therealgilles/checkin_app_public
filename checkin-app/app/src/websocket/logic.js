import { createLogic } from 'redux-logic'
import { timer } from 'rxjs'
import { filter, tap, map, takeUntil, retryWhen, switchMap } from 'rxjs/operators'
import { webSocket } from 'rxjs/webSocket'
import debug from 'debug'
import { store } from '../store'
import {
  msgReceived,
  WS_CONNECT,
  WS_DISCONNECT,
  WS_MSG_ERROR,
  WS_MSG_SEND,
  WS_MSG_LISTEN,
  WS_MSG_STOP_LISTENING,
} from './actions'

debug.enable('websocket/logic:*')
const log = debug('websocket/logic:log')
// const info = debug('websocket/logic:info')
const error = debug('websocket/logic:error')

const isServer = !process.browser

let WS_SERVER
if (!isServer) {
  const wsType = window.location.protocol === 'http:' ? 'ws' : 'wss'
  const port = window.location.port ? `:${window.location.port}` : ''
  WS_SERVER = `${wsType}://${window.location.hostname}${port}/ws`
  log(`ws server = ${WS_SERVER}`)
}

const wsListen = {
  type: WS_MSG_LISTEN,
  cancelType: WS_MSG_STOP_LISTENING,
  latest: true, // take latest only
  warnTimeout: 0, // long running logic

  processOptions: {
    failType: WS_MSG_ERROR,
  },
}

if (!isServer) {
  wsListen.process = ({ action$, cancelled$ }) => {
    const wsSubject$ = webSocket({
      url: WS_SERVER,
      openObserver: {
        next: () => store.dispatch({ type: WS_CONNECT }),
      },
      closeObserver: {
        next: () => store.dispatch({ type: WS_DISCONNECT }),
      },
    })

    // send message on WS_MSG_SEND action
    action$
      .pipe(
        filter(action => action.type === WS_MSG_SEND),
        tap(action => wsSubject$.next(action.payload)),
        takeUntil(cancelled$)
      )
      .subscribe()

    // dispatch msgReceived with payload from server
    // on any incoming messages
    // returning obs subscribes to it
    return wsSubject$.pipe(
      map(msg => msgReceived(msg)),
      retryWhen(errors =>
        errors.pipe(
          tap(err => error(err)),
          switchMap(err => timer(1000))
        )
      )
    )
  }
}

const wsListenLogic = createLogic(wsListen)

export default [wsListenLogic]
