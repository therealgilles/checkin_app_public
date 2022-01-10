// index.mjs
//
// Express https/http/wss server startup
//

import debug from 'debug'
import config from './config'
import helpers from './helpers/helpers'
import './db/dequeue'
import shutdown from './signals'

// create express/https/http/wss servers and start wss server
let httpxServer = require('./httpxServer').default
let serverApp = require('./expressServer').default

config.debug && debug.enable('index:*')
const log = debug('index:log')
const info = debug('index:info')
const error = debug('index:error')

if (module.hot) {
  let websocket = require('./websocket/websocket').default // eslint-disable-line global-require
  module.hot.accept(['./expressServer', './httpxServer'], async module => {
    log(`🔁  HMR Reloading ${module}...`)
    try {
      if (module === './expressServer') {
        const servers = httpxServer.getServers({ full: true })
        servers.http.server.removeListener('request', serverApp)
        serverApp = require('./expressServer').default // eslint-disable-line global-require
        servers.http.serverApp = serverApp
        servers.http.server.on('request', serverApp)
        websocket = require('./websocket/websocket').default // eslint-disable-line global-require
        websocket.onWsConnection()
      }

      if (module === './httpxServer') {
        const servers = httpxServer.getServers()
        shutdown({ signal: 0, servers, skipWebhooks: true, dontExit: true })
        httpxServer = require('./httpxServer').default // eslint-disable-line global-require
        await httpxServer.startHttpxServer()
        websocket = require('./websocket/websocket').default // eslint-disable-line global-require
        websocket.onWsConnection()
      }
    } catch (err) {
      error(err)
    }
  })
  module.hot.accept(err => error(err))
  module.hot.dispose(() => {
    const servers = httpxServer.getServers()
    shutdown({ signal: 0, servers, skipWebhooks: true, dontExit: true })
  })
  info('✅  Server-side HMR Enabled!')
} else if (process.env.NODE_ENV === 'development') {
  error('⛔️  module.hot NOT FOUND')
}

// start https/http servers (once redis is up)
const startHttpServers = async () => {
  try {
    await helpers.waitForRedisDone()
    await httpxServer.startHttpxServer()
    await helpers.setInitDone()
  } catch (err) {
    error(err)
    throw new Error('Could not start https/http servers')
  }
}
startHttpServers()
