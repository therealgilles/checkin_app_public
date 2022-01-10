// expressServer.mjs
//
// Express server
//

import debug from 'debug'
import express from 'express'
import session from 'express-session'
import connectRedis from 'connect-redis'
import morgan from 'morgan'
import helmet from 'helmet'
import crypto from 'crypto'
import compression from 'compression'
import redis from 'redis'
import asyncHandler from 'express-async-handler'
import enforceSSL from './express-sslify/index'
import config from './config'
import db from './db/db'
import websocket from './websocket/websocket'
import httpxServer from './httpxServer'
import serverDebug from './serverDebug'
import auth from './auth/auth'
import serverRender from './serverRender'

const expressServer = express()
const RedisStore = connectRedis(session)

config.debug && debug.enable('expressServer:*')
const log = debug('expressServer:log')
// const info = debug('expressServer:info')
const error = debug('expressServer:error')

// const __dirname = path.dirname(new URL(import.meta.url).pathname)

// create https/http servers and secure websocket server
const servers = httpxServer.createHttpxServer(expressServer)
const serverType = !config.no_ssl && config.https_force ? 'https' : 'http'
websocket.createWsServer(expressServer, servers, serverType)

// do not show server info
expressServer.disable('x-powered-by')

if (!config.no_ssl && config.https_force) {
  // This sends back a redirect so it needs the client host port.
  log(`Enforce https on client host port ${config.host_port} through redirect`)
  expressServer.use(enforceSSL.HTTPS({ port: config.host_port }))
}

// crypto
expressServer.use((req, res, next) => {
  res.locals.scriptNonce = crypto.randomBytes(16).toString('base64')
  res.locals.styleNonce = crypto.randomBytes(16).toString('base64')
  next()
})

// helmet
expressServer.use(
  helmet({
    frameguard: { action: 'SAMEORIGIN' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: false },
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'default-src': ["'self'", 'https://*.googleapis.com https://*.cloudflare.com'],
        'script-src': [
          "'self'",
          "'unsafe-inline'",
          'https',
          (req, res) => `'nonce-${res.locals.scriptNonce}'`,
          "'strict-dynamic'",
          'https://*.googleapis.com https://stats.wp.com https://*.google.com https://*.gstatic.com https://*.cloudflare.com data:',
        ],
        'style-src': ["'self'", 'https', "'unsafe-inline' https://fonts.googleapis.com"],
        'font-src': ["'self'", 'https://*.gstatic.com https: data:'],
        'img-src': [
          "'self'",
          `${config.url} https://secure.gravatar.com https://*.wp.com https://ps.w.org ` +
            ' https://*.gstatic.com https://*.googleapis.com https://*.google.com https://*.cloudflare.com data:',
        ],
        'frame-src': ["'self'"],
        // FIXME: add wss url for Safari for now
        'connect-src': [
          "'self'",
          `wss://${config.host}${config.host_port ? `:${config.host_port}` : ''}`,
        ],
        // FIXME: 'require-trusted-types-for': ["'script'"],
      },
    },
  })
)

// add permissions-policy header
expressServer.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(self), midi=(self), camera=(self), usb=(self), magnetometer=(self), accelerometer=(self),' +
      ' vr=(self), speaker=(self), ambient-light-sensor=(self), gyroscope=(self), microphone=(self)'
  )
  next()
})

// compression
expressServer.use(compression()) // compress all responses

// bodyparser
expressServer.use(express.urlencoded({ extended: true }))
expressServer.use(express.json())

// trust first proxy
if (config.use_proxy) expressServer.set('trust proxy', 1)

// session
const sessionClient = redis.createClient({
  port: config.redis_port,
  host: config.redis_host,
  prefix: config.redis_prefix,
})
const sessionOptions = {
  secret: 'session secret for checkin-app',
  cookie: { secure: config.secure_cookie, sameSite: config.samesite_cookie },
  name: 'checkin-app.sid',
  maxAge: 24 * 3600 * 1000, // 24 hours in milliseconds
  httpOnly: false, // if we want to allow logout through websocket
  resave: false,
  saveUninitialized: false,
  store: new RedisStore({
    client: sessionClient,
    logErrors: config.redis_log_errors,
  }),
}
expressServer.use(session(sessionOptions))

// logger
expressServer.use(
  morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" '.concat(
      ':status :res[content-length] :response-time ms'
    )
  )
)

// serve favicon and static assets
// const buildPath = path.resolve(__dirname, '..', '..', 'app', 'build')
// expressServer.use(favicon(path.join(buildPath, 'favicon.ico')))
// expressServer.use('/static', express.static(path.join(buildPath, 'static')))
expressServer.use(express.static(process.env.RAZZLE_PUBLIC_DIR))

// check authentication
expressServer.use(auth.checkAuth)

// oauth redirect
expressServer.get('/oauth_redirect', asyncHandler(auth.oAuthRedirectHandler))

// API calls for front-end app

// get all items
expressServer.get(
  '/api/items',
  asyncHandler(async (req, res, next) => {
    const items = await db.getItems({ query: req.query })
    res.json(items)
  })
)
// get item info (title, date, time, variant [role/style/size], teachers, description)
expressServer.get(
  '/api/items/:itemId',
  asyncHandler(async (req, res, next) => {
    const cl = await db.getItems({
      id: decodeURIComponent(req.params.itemId),
      query: req.query,
    })
    res.json(cl)
  })
)

// get all registrants
expressServer.get(
  '/api/registrants',
  asyncHandler(async (req, res, next) => {
    const registrants = await db.getRegistrants({ query: req.query })
    res.json(registrants)
  })
)
// get registrant info (name, email, items, check-in status)
expressServer
  .route('/api/registrants/:registrantId')
  .get(
    asyncHandler(async (req, res, next) => {
      const registrant = await db.getRegistrants({
        id: Buffer.from(decodeURIComponent(req.params.registrantId), 'base64').toString('ascii'),
        query: req.query,
      })
      res.json(registrant)
    })
  )
  // update registrant info (check-in status, name?, email?, items?, refund?)
  .put(
    asyncHandler(async (req, res, next) => {
      try {
        await db.updateRegistrant(
          {
            id: Buffer.from(decodeURIComponent(req.params.registrantId), 'base64').toString(
              'ascii'
            ),
            query: req.query,
          },
          req.body
        )
        res.sendStatus(200)
      } catch (err) {
        error(err)
        res.status(500).json(err)
        // do not throw error here
      }
    })
  )

// get users
expressServer.get(
  '/api/users',
  asyncHandler(async (req, res, next) => {
    const users = await db.getUsers({ query: req.query })
    res.json(users)
  })
)
expressServer
  .route('/api/users/:userId')
  .get(
    asyncHandler(async (req, res, next) => {
      const user = await db.getUsers({
        id: decodeURIComponent(req.params.userId),
        query: req.query,
      })
      res.json(user)
    })
  )
  .put(
    asyncHandler(async (req, res, next) => {
      // update user
      try {
        await db.updateUser(
          { id: decodeURIComponent(req.params.userId), query: req.query },
          req.body
        )
        res.sendStatus(200)
      } catch (err) {
        res.status(500).json(err)
        // do not throw error here
      }
    })
  )

// refresh items/registrants/users
expressServer.get(
  '/api/refresh/items',
  asyncHandler(async (req, res, next) => {
    await db.refreshItems({ query: req.query })
    res.sendStatus(200)
  })
)
expressServer.get(
  '/api/refresh/registrants',
  asyncHandler(async (req, res, next) => {
    await db.refreshRegistrants({ query: req.query })
    res.sendStatus(200)
  })
)
expressServer.get(
  '/api/refresh/users',
  asyncHandler(async (req, res, next) => {
    await db.refreshUsers({ query: req.query })
    res.sendStatus(200)
  })
)
expressServer.get(
  '/api/refresh/orders/:orderId',
  asyncHandler(async (req, res, next) => {
    await db.refreshRegistrants(
      { sendMsg: true, query: req.query },
      { id: decodeURIComponent(req.params.orderId), query: req.query }
    )
    res.sendStatus(200)
  })
)
// refresh users & items, then registrants
expressServer.get(
  '/api/refresh',
  asyncHandler(async (req, res, next) => {
    await Promise.all([
      db.refreshUsers({ query: req.query }),
      db.refreshItems({ query: req.query }),
    ])
    await db.refreshRegistrants({ query: req.query })
    res.sendStatus(200)
  })
)

if (config.production || config.self_test) {
  config.webhook_types.forEach(type => {
    const webhookUri = `/${config.webhook_api_path}/${type}`

    log('Setting up webhook access uri', webhookUri)
    expressServer.post(
      webhookUri,
      asyncHandler(async (req, res, next) => {
        log('Received a webhook post request!!', type)
        const order = req.body
        // log(webhookUri, order)
        // skip orders without order id or accepted status
        if (!order.id || !order.status || !config.orders.statuses.includes(order.status)) {
          log('... skipping order because missing order id or skipped order status', order)
          res.sendStatus(200)
          return
        }
        const registrantId = db.getOrderRegistrantId(order)
        // skip order if all line items have no corresponding loaded product items
        const registrantInfo = {
          query: {
            reqId: 'server',
            filterByItems: 'true',
            skipIfMissingAllItems: true,
          },
          id: registrantId,
          sendMsg: true,
        }
        const orderInfo = { id: order.id }
        await db.refreshRegistrants(registrantInfo, orderInfo, [order])
        res.sendStatus(200)
      })
    )
  })
}

// debug routes (for testing only)
serverDebug.addDebugRoutes(expressServer, db)

// login/logout
expressServer.get('/login', (req, res) => res.redirect('/'))
expressServer.post('/login', asyncHandler(auth.login))
expressServer.get('/logout', asyncHandler(auth.logout))

// setup websocket route
websocket.setupExpressWsRoute(expressServer, serverType)

// prevent direct access to index.html
expressServer.get('/index.html', (req, res) => res.redirect('/'))

// server render
expressServer.get('/*', asyncHandler(serverRender))

// used for hot reload
export default expressServer
