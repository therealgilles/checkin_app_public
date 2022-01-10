// websocket.mjs
//
// WebSocket functions
//

import debug from 'debug'
import expressWs from 'express-ws'
// import diff from 'deep-diff'
import config from '../config'
import db from '../db/db'

config.debug && debug.enable('websocket:*')
const log = debug('websocket:log')
const info = debug('websocket:info')
const error = debug('websocket:error')

let wss // websocket server
const wsClientBySessionId = {}

const cancelledReqIds = {} // keep track of cancelled request IDs

const intervalCheck = 30 * 1000 // every 30 seconds
let displayIntervalResetValue
let displayIntervalCheckCounter

const resetDisplayIntervalCounter = () => {
  displayIntervalResetValue = 1
  displayIntervalCheckCounter = displayIntervalResetValue
}
resetDisplayIntervalCounter()

const defaultExports = {
  createWsServer: (expressServer, servers, serverType) => {
    log('Creating websocket server...')
    const expressWsObj = expressWs(expressServer, servers[serverType].server)
    log(`... ws server created over ${serverType}`)
    wss = expressWsObj.getWss()
  },

  setupExpressWsRoute: (expressServer, serverType) => {
    info('Setting up websocket route...')
    const wsEndpoint = '/ws'
    expressServer.ws(wsEndpoint, (ws, req) => defaultExports.receiveMsg(ws, req))
    info(`... route set as ${wsEndpoint}`)
    defaultExports.onWsConnection()
  },

  onWsConnection: () => {
    wss.on('connection', (ws, req) => {
      if (!ws.id) {
        // give the client an identifier
        ws.id = req.headers['sec-websocket-key'] // eslint-disable-line no-param-reassign
      }

      log('websocket client connected ID', ws.id)
      log('... ws client IP address', ws._socket.remoteAddress)

      ws.isAlive = true // eslint-disable-line no-param-reassign
      ws.on('pong', () => {
        ws.isAlive = true // eslint-disable-line no-param-reassign
      })

      // on first connection, we do not have req.session set, so we ask the client to send a message back
      // which will have req.session if the session exists on the client side
      defaultExports.sendMsg({ reqId: 'server', clientId: ws.id, cmd: 'send first connect' }, ws)
    })

    setInterval(() => {
      if (displayIntervalCheckCounter === 0) {
        info('Websocket connection interval check...')
      }

      // go through all tracked clients and remove them if they are not alive
      Object.keys(wsClientBySessionId).forEach(sessionId => {
        defaultExports.cleanUpWsClientBySessionId(sessionId)
      })

      // set all clients isAlive to false
      Object.keys(wsClientBySessionId).forEach(sessionId => {
        defaultExports.setAliveValueWsClientBySessionId(sessionId, false)
      })

      wss.clients.forEach(ws => {
        // This is probably not necessary as it should be covered above, but it won't hurt
        ws.isAlive = false // eslint-disable-line no-param-reassign

        ws.ping(() => {}) // send ping to active clients
      })

      if (displayIntervalCheckCounter === 0) {
        // when we display this message, we double the reset value to space messages further
        displayIntervalResetValue *= 2
        displayIntervalCheckCounter = displayIntervalResetValue
      } else {
        displayIntervalCheckCounter -= 1 // decrement when we are not displaying the message
      }
    }, intervalCheck) // check ws client connection every 30 seconds
  },

  wsIsAlive: ws => ws && ws.isAlive,

  terminateWs: (ws, sessionId) => {
    log('ws client appears gone, terminating', ws.id, `[${new Date().toLocaleString()}]`)
    defaultExports.rmWsClient(ws, sessionId)
    ws.terminate()
  },

  receiveMsg: (ws, req) => {
    ws.on('message', msg => {
      resetDisplayIntervalCounter()

      log('websocket msg receive', msg, req.session.id)
      log('... ws client IP address', ws._socket.remoteAddress)
      log(
        '... ws request IP address',
        req.headers['x-forwarded-for'] || req.connection.remoteAddress
      )
      ws.userInfo && log('... ws user info', ws.userInfo)

      // if there is no session set, we send a logout to the client
      if (!req.session) {
        defaultExports.sendMsg({ reqId: 'server', cmd: 'logout', data: 'no session' }, ws)
        return
      }
      defaultExports.setWsClientBySessionId(req.session.id, ws) // associate client with session ID

      // we got a session from the client, reload the local session to make sure it's up-to-date
      req.session.reload(err => {
        if (err) {
          info(err)
          info('receiveMsg:', 'Unknown session could not be reloaded, sending logout')
          req.session.destroy(destroyErr => {
            if (destroyErr) throw new Error(destroyErr)
          })
          defaultExports.sendMsg({ reqId: 'server', cmd: 'logout', data: 'unknown session' }, ws)
          return
        }

        const { cmd, data } = JSON.parse(msg)
        const { authenticated } = data || {}

        // if session not authenticated, we send a logout to the client
        if (!req.session.authenticated) {
          log('websocket req session ID not authenticated', req.session.id, req.session)
          // if (authenticated) defaultExports.sendMsg({ reqId: 'server', cmd: 'logout', data: 'session not authenticated' }, ws)
          defaultExports.sendMsg(
            { reqId: 'server', cmd: 'logout', data: 'session not authenticated' },
            ws
          )
          return
        }

        const { userInfo } = data || {}
        const userInfoMatch =
          userInfo && JSON.stringify(userInfo) === JSON.stringify(req.session.userInfo)

        const re = new RegExp(config.oauth_user_regexp, 'i')
        if (userInfo && userInfo.name && !userInfo.name.match(re)) {
          defaultExports.sendMsg({ reqId: 'server', cmd: 'logout', data: 'unauthorized' }, ws)
          return
        }

        req.session.userInfo && (ws.userInfo = req.session.userInfo) // eslint-disable-line no-param-reassign

        // session is authenticated
        if (cmd === 'first connect') {
          if (!userInfoMatch || !authenticated) {
            defaultExports.sendMsg(
              { reqId: 'server', cmd: 'login', data: { userInfo: req.session.userInfo } },
              ws
            )
            defaultExports.sendMsg({ reqId: 'server', cmd: 'send session check' }, ws)
          } else {
            defaultExports.sendMsg(
              { reqId: 'server', cmd: 'version check', data: { version: config.version } },
              ws
            )
          }
        } else if (cmd === 'session check') {
          // client sent session check
          log('session check')
          if (!userInfoMatch) {
            defaultExports.sendMsg(
              { reqId: 'server', cmd: 'logout', data: 'session verif failed' },
              ws
            )
          }
        } else if (cmd === 'signed in') {
          defaultExports.sendMsg(
            {
              reqId: 'server',
              cmd: 'send get settings',
              data: { nextCmd: 'send refresh request' },
            },
            ws
          )
        } else if (cmd === 'get settings') {
          db.getSettingsSendMsg().then(() => {
            data.nextCmd && defaultExports.sendMsg({ reqId: 'server', cmd: data.nextCmd }, ws)
          })
        } else if (cmd === 'update settings') {
          db.updateSettingsSendMsg({ settings: data.settings })
        } else if (cmd === 'cancelled request ID') {
          defaultExports.setCancelledRequestId(data.reqId)
        }
      })
    })
  },

  sendMsg: (msg, clients) => {
    // log('sendMsg', msg)
    if (defaultExports.isCancelledRequestId(msg.reqId)) {
      info(`Cancelling ws msg with request ID ${msg.reqId}`)
      return Promise.resolve()
    }

    resetDisplayIntervalCounter()

    const clientArray = Array.isArray(clients) ? clients : [clients]
    const wssClients = Array.from(wss.clients.values()).filter(
      ws => !clients || clientArray.filter(c => ws === c).length
    )

    if (!wssClients.length) error('No websocket clients connected.')

    return Promise.all(
      wssClients.map(
        ws =>
          new Promise((resolve, reject) => {
            log('websocket sending msg to client', msg)
            log('... ws client IP address', ws._socket.remoteAddress)
            ws.send(JSON.stringify(msg), err => (err ? reject(new Error(err)) : resolve()))
          })
      )
    )
  },

  setWsClientBySessionId: (sessionId, ws) => {
    log('set - check if session ID ws client needs to be added', sessionId, ws.id)
    wsClientBySessionId[sessionId] || (wsClientBySessionId[sessionId] = [])

    if (!wsClientBySessionId[sessionId].filter(client => client.id === ws.id).length) {
      log('... adding ws client', ws.id)
      wsClientBySessionId[sessionId].push(ws)
    } else {
      log('... ws client already present', ws.id)
    }

    log('... number of ws clients for this session', wsClientBySessionId[sessionId].length)
  },

  getWsClientBySessionId: sessionId => {
    log('get - getting session ID ws clients', sessionId)
    return wsClientBySessionId[sessionId]
  },

  deleteWsClientBySessionId: sessionId => {
    log('del - deleting session ID ws clients', sessionId)
    delete wsClientBySessionId[sessionId]
  },

  setAliveValueWsClientBySessionId: (sessionId, isAlive) => {
    wsClientBySessionId[sessionId].forEach(ws => {
      ws.isAlive = isAlive // eslint-disable-line no-param-reassign
    })
  },

  cleanUpWsClientBySessionId: sessionId => {
    // log('clean - cleaning up session ID ws clients', sessionId)

    // remove null/undefined clients, terminate dead clients
    wsClientBySessionId[sessionId]
      .filter(ws => ws)
      .forEach(ws => {
        defaultExports.wsIsAlive(ws) || defaultExports.terminateWs(ws, sessionId)
      })

    if (!wsClientBySessionId[sessionId].length) {
      log('... all ws clients are gone')
      defaultExports.deleteWsClientBySessionId(sessionId)
    }

    if (displayIntervalCheckCounter === 0) {
      log(
        '... number of ws clients for this session',
        (wsClientBySessionId[sessionId] || []).length
      )
    }
  },

  rmWsClient: (ws, sessionId) => {
    log('rm - removing ws client', ws.id)
    const sessionIds = [sessionId] || Object.keys(wsClientBySessionId)
    sessionIds.forEach(sId => {
      wsClientBySessionId[sId] = wsClientBySessionId[sId].filter(client => client.id !== ws.id)
    })
  },

  setCancelledRequestId: reqId => {
    if (reqId !== undefined) {
      log(`Adding request ID ${reqId} to cancelled request IDs list`)
      cancelledReqIds[reqId] = true
    }
  },

  isCancelledRequestId: reqId => reqId !== undefined && cancelledReqIds[reqId] === true,
}

export default defaultExports
