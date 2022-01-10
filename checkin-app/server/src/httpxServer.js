// httpxServer.mjs
//
// https/http servers
//

import http from 'http'
// import spdy from 'spdy'
// import http2 from 'http2'
import https from 'https'
import fs from 'fs'
import path from 'path'
import greenlockExpress from 'greenlock-express'
import greenlockStore from 'greenlock-store-fs'
import AcmeDnsCloudflare from 'acme-dns-01-cloudflare'
import redirectHTTPS from 'redirect-https'
import os from 'os'
import debug from 'debug'
import config from './config'
import helpers from './helpers/helpers'

config.debug && debug.enable('httpxServer:*')
const log = debug('httpxServer:log')
const info = debug('httpxServer:info')
const error = debug('httpxServer:error')

const servers = {}

const defaultExports = {
  createHttpxServer: expressServer => {
    info('User =', os.userInfo())

    const serverConfig = {}

    if (!config.no_ssl && config.use_greenlock) {
      info(`Creating ${config.production ? 'production' : 'development'} greenlock servers...`)
      info('... domain names =', config.domains)
      info('... ssl path =', config.ssl_path)

      const store = greenlockStore.create({
        configDir: config.ssl_path,
        debug: true,
      })

      const DNSChallenge = new AcmeDnsCloudflare({
        email: config.cloudflare_email,
        key: config.cloudflare_api_key,
        verifyPropagation: true,
        // waitFor: 1000 * 10, // 10-second delay for TXT record update. 10s is the default
      })

      // https/http servers
      const greenlock = greenlockExpress.create({
        version: 'draft-11', // Let's Encrypt v2 is ACME draft 11
        server: config.letsencrypt_server, // Let's Encrypt server
        email: config.ssl_email, // Emailed when certificates expire
        agreeTos: true, // Required for letsencrypt
        approvedDomains: config.domains, // List of accepted domain names
        configDir: path.dirname(path.dirname(config.ssl_path)), // Directory path where certificates go
        // app: expressServer, // Express server
        debug: config.greenlock_debug, // Add console messages
        communityMember: true,
        telemetry: true,
        //
        store,
        challenges: { 'dns-01': DNSChallenge },
        challengeType: 'dns-01',
      })

      serverConfig.options = greenlock.tlsOptions
      if (config.https_force) serverConfig.expressServerHttp = greenlock.middleware(redirectHTTPS())
    } else {
      const sfx = config.no_ssl ? '' : 's'
      info(`Creating ${config.production ? 'production' : 'development'} server${sfx}...`)

      if (!config.no_ssl) {
        // key/certificate for https server
        serverConfig.options = {
          key: fs.readFileSync(`${config.ssl_path}/privkey.pem`),
          cert: fs.readFileSync(`${config.ssl_path}/fullchain.pem`),
        }
      }
    }

    if (!config.no_ssl) {
      const httpsServer = https.createServer(serverConfig.options, expressServer)
      servers.https = {
        server: httpsServer,
        port: config.https_port,
        serverApp: expressServer,
      }

      const unencryptedBE = process.env.REACT_APP_UNENCRYPTED_BACKEND === 'true'
      if (unencryptedBE) {
        throw new Error(
          'REACT_APP_UNENCRYPTED_BACKEND is true but we are trying to create an https server.'
        )
      }
    }

    const serverApp = serverConfig.expressServerHttp || expressServer
    const httpServer = http.createServer(serverApp)
    servers.http = { server: httpServer, port: config.http_port, serverApp }

    const serverTypes = Object.keys(servers)
    log(`... ${serverTypes.join('/')} server${serverTypes.length > 1 ? 's' : ''} created`)

    return servers
  },

  startHttpxServer: async () => {
    try {
      const promises = []
      const serverTypes = Object.keys(servers)
      log(`Starting server${serverTypes.length > 1 ? 's' : ''}...`)

      serverTypes.forEach(type => {
        const { server, port } = servers[type]
        promises.push(
          new Promise(resolve => {
            server.listen(port, () => {
              // const host = server.address().address
              log(`... ${type.toUpperCase()} server listening on port ${port}`)
              resolve()
            })
          })
        )
      })

      await Promise.all(promises)
      return helpers.setServerStarted()
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getServers: ({ full = false } = {}) =>
    full ? servers : Object.values(servers).map(inst => inst.server),
}

export default defaultExports
