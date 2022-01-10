// signals.mjs
//
// Sign handling
//

import debug from 'debug'
import config from './config'
import httpxServer from './httpxServer'
import wcapi from './api/wcapi'

config.debug && debug.enable('signals:*')
const log = debug('signals:log')
const info = debug('signals:info')
// const error = debug('signals:error')

const signals = {
  SIGINT: 2,
  SIGTERM: 15,
}

const deleteWebhooksOnExit = async () => {
  await wcapi.deleteWebhooksOnExit()
}

const shutdown = ({
  signal,
  servers,
  close = false,
  skipWebhooks = false,
  dontExit = false,
} = {}) => {
  log('shutdown', signal)
  log('... # of running servers =', servers.length)
  if (servers && servers.length > 0) {
    const timeout = setTimeout(() => {
      shutdown({ signal, servers: [], skipWebhooks, dontExit })
    }, 2000) // wait max 2 seconds
    servers[0].close(() => {
      clearTimeout(timeout)
      shutdown({
        signal,
        servers: servers.slice(1),
        close: true,
        skipWebhooks,
        dontExit,
      })
    })
    return
  }

  if (close) info(`... servers stopped by ${signal}`)

  if (!skipWebhooks) deleteWebhooksOnExit()

  if (!dontExit) {
    if (signal === 'SIGINT') {
      info(`... gracefully shutting down from ${signal} (Ctrl-C)`)
      info('Goodbye')
      process.exit()
    }

    info(`... exiting with signal ${signal}`)
    info('Goodbye')
    process.exit(128 + signals[signal])
  }
}

let exitSignal
Object.keys(signals).forEach(signal => {
  info(`Setting shutdown signal ${signal}`)
  process.on(signal, () => {
    if (exitSignal) {
      // only shutdown with the first signal
      info(`... skipping signal ${signal} as shutdown is already ongoing`)
      return
    }

    exitSignal = signal
    info(`Shutting down due to ${signal}`)
    shutdown({ signal: exitSignal, servers: httpxServer.getServers() })
  })
})

export default shutdown
