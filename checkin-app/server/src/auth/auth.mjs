// auth.mjs
//
// Functions for oauth2 authentication
//

import debug from 'debug'
import oauth from 'simple-oauth2'
import qs from 'querystring'
import config from '../config'
import websocket from '../websocket/websocket'
import oauthapi from '../api/oauthapi'
import wpapi from '../api/wpapi'
import tecapi from '../api/tecapi'
import graphqlapi from '../api/graphqlapi'

config.debug && debug.enable('auth:*')
const log = debug('auth:log')
const info = debug('auth:info')
const error = debug('auth:error')

const oauthClient = new oauth.AuthorizationCode({
  client: {
    id: config.oauth_client_id,
    secret: config.oauth_client_secret,
  },
  auth: {
    tokenHost: config.url,
    tokenPath: config.oauth_token_path,
    authorizePath: config.oauth_authorize_path,
  },
  options: {
    bodyFormat: 'form',
  },
})

// window of time before the actual expiration to refresh the token
const EXPIRATION_WINDOW_IN_SECONDS = 300

// FIXME: is it possible to logout from the WNH website after authorization and redirect to the oauth url
// https://wednesdaynighthop.com/wp-login.php?action=logout&redirect_to=https://checkin.wednesdaynighthop.com&checkin_app_redirect=true
// https://swinginatthesavoy.com/wp-login.php?action=logout&redirect_to=https://checkin.swinginatthesavoy.com&checkin_app_redirect=true

const oauthPort = config.oauth_port ? `:${config.oauth_port}` : ''
const redirectUri = `https://${config.host}${oauthPort}${config.oauth_redirect_path}`

const defaultExports = {
  getAuthorizationUri: () =>
    oauthClient.authorizeURL({
      redirect_uri: redirectUri,
      // scope: 'basic',
      state: encodeURIComponent(JSON.stringify({ secret: config.oauth_state_secret })),
    }),

  oAuthRedirectHandler: async (req, res) => {
    log('oAuthRedirectHandler')

    const state = decodeURIComponent(req.query.state)
    let parsedState = {}
    try {
      // FIXME: remove backslashes that are somehow being added
      parsedState = JSON.parse(state.replace(/\\/g, ''))
    } catch (err) {
      error('Invalid State Error', err)
      res.json('Authentication failed, state')
      throw new Error('Authentication failed, state')
    }

    const { secret } = parsedState
    if (secret !== config.oauth_state_secret) {
      // FIXME: the secret should be randomly generated for each new authorization
      // Could be temporarily stored in redis with some kind of identifier.
      res.json('Authentication failed, secret') // FIXME
      throw new Error('Authentication failed, secret')
    }

    const code = req.query.code
    const options = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }

    log('oAuthRedirectHandler', config.oauth_token_path, qs.encode(options))
    try {
      const accessToken = await oauthClient.getToken(options)
      log('The resulting token:', accessToken)
      // accessToken.expires_in = 30
      await defaultExports.updateSession(req, { token: accessToken }) // store token
      return defaultExports.updateTokenGetUser(req, res, {
        getUser: true,
        oAuth: true,
      })
    } catch (err) {
      error('Access Token Error', err)
      res.json('Authentication failed, token') // FIXME: provide a way to retry?
      return Promise.resolve()
    }
  },

  updateTokenGetUser: (req, res, { getUser, noRes, oAuth }) => {
    const accessToken = req.session.token
    const auth = `${accessToken.token.token_type} ${accessToken.token.access_token}`
    oauthapi.updateAuth(auth)
    wpapi.updateAuth(auth)
    tecapi.updateAuth(auth)
    graphqlapi.updateAuth(auth)

    return getUser
      ? defaultExports.updateUser(req, res, { noRes, oAuth })
      : defaultExports.finishLogin(req, res, { noRes, oAuth })
  },

  updateUser: async (req, res, { noRes, oAuth }) => {
    try {
      const name = await oauthapi.getCurrentUserName()
      log('current user name', name)
      const userInfo = { name }
      const re = new RegExp(config.oauth_user_regexp, 'i')
      if (!name.match(re)) {
        throw new Error(`Unauthorized Access by ${name}`)
      }
      await defaultExports.updateSession(req, { userInfo })
      return defaultExports.finishLogin(req, res, { noRes, oAuth })
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  finishLogin: async (req, res, { noRes, oAuth }) => {
    try {
      await defaultExports.updateSession(req, { authenticated: true })
      log('finishLogin: session authenticated!!!', req.session)

      log('finishLogin session ID', req.session.id)
      const userInfo = req.session.userInfo
      log('finishLogin', { userInfo })

      if (oAuth) {
        // NOTE: if we just went through oauthClient authorization, we will get a new session
        //       when we are directed back to the site, so there won't be any websocket clients
        //       associated with it yet.
        log('finishLogin oAuth')
      } else {
        const clients = websocket.getWsClientBySessionId(req.session.id)
        log('finishLogin found clients?', !!clients)

        if (clients) {
          await websocket.sendMsg({ reqId: 'server', cmd: 'login', data: { userInfo } }, clients)
        } else {
          throw new Error('finishLogin websocket client not found')
        }
      }

      if (!noRes) {
        // res.json('Authorization successful')
        log('finishLogin redirecting to ', req.session.originalUrlPath || '/')
        res.redirect(req.session.originalUrlPath || '/')
      }

      return Promise.resolve()
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  login: async (req, res, next) => {
    log('/login post', req.session)
    // NOTE: by the time we get here, the session has already been reloaded
    //       because of the websocket message exchange

    const { originalUrlPath } = req.body
    log('Original URL path', originalUrlPath)

    try {
      await defaultExports.updateSession(req, { originalUrlPath })

      // re-authorize if forced or not authenticated or token is missing
      if (req.query.forceAuth === '1' || !req.session.authenticated || !req.session.token) {
        log('/login auth redirect', defaultExports.getAuthorizationUri())
        return res.json({ authUrl: defaultExports.getAuthorizationUri() })
      }

      log('/login using existing token')
      return defaultExports.checkToken(req, res)
    } catch (err) {
      const errMsg = err.message || err
      if (errMsg === 'try login again') {
        return res.redirect(originalUrlPath)
      }
      return next(err)
    }
  },

  logout: async (req, res) => {
    Object.keys(req.cookies || {}).forEach(key => res.clearCookie(key)) // clear all cookies

    if (req.session) {
      log('/logout session exists')
      const clients = websocket.getWsClientBySessionId(req.session.id)
      defaultExports.deleteSessionKey(req, 'authenticated')
      log('/logout session deauthenticated')

      if (req.session.token) {
        try {
          log('... revoking all tokens')
          const accessToken = oauthClient.createToken(req.session.token)
          // This is technically a promise, but we do not await on it to avoid delaying the logout process.
          accessToken.revokeAll()
        } catch (err) {
          error('Error revoking token:', err)
        }
      }

      try {
        req.session.destroy(err => {
          // destroy session
          if (err) throw new Error(err)
        })

        if (clients) {
          await websocket.sendMsg(
            { reqId: 'server', cmd: 'logout', data: 'user triggered logout' },
            clients
          )
        }
      } catch (err) {
        error(err)
      }
    }

    return res.redirect('/') // redirect in all cases
  },

  checkToken: async (req, res) => {
    // check token has not expired
    const checkAccessToken = async () => {
      const accessToken = req.session.token ? oauthClient.createToken(req.session.token) : null
      if (!accessToken) {
        error('Error checkToken: no token found')
      }

      // only works if oauth2 server supports refresh tokens
      if (!accessToken.expired(EXPIRATION_WINDOW_IN_SECONDS)) {
        return Promise.resolve()
      }

      log('checkToken: token expired or will expire soon, refreshing...')

      try {
        const newAccessToken = await accessToken.refresh()
        log('checkToken: token refreshed, new token', newAccessToken)
        await defaultExports.updateSession(req, { token: newAccessToken })
        return defaultExports.updateTokenGetUser(req, res, {
          getUser: true,
          noRes: true,
        })
      } catch (err) {
        error('Refresh Token Error', err.response.data)
        defaultExports.deleteSessionKey(req, 'token') // delete existing token
        return Promise.reject(new Error('try login again'))
      }
    }

    try {
      await checkAccessToken()

      // use existing token to login
      if (!req.session.userInfo) {
        return defaultExports.updateUser(req, res, { noRes: false })
      }
      return defaultExports.finishLogin(req, res, { noRes: false })
    } catch (err) {
      error(err)
      return Promise.resolve()
    }
  },

  checkAuth: async (req, res, next) => {
    // unprotected route
    if (
      req.url.match(/^\/ws\/?/) ||
      req.url.match(/^\/oauth_redirect\/?/) ||
      req.url.match(/\/webhook\//) ||
      req.url.match(/^\/(login|logout|)(\?.*)?\/?$/)
    ) {
      log('checkAuth unprotected route', req.url)
      return next()
    }

    // protected route
    log('checkAuth protected route', req.url)

    // reload the session if it exists
    const reloadSession = async () => {
      if (!req.session) {
        log('checkAuth no session found')
        throw new Error('checkAuth no session found')
      }

      try {
        return new Promise((resolve, reject) => {
          req.session.reload(err => {
            if (err) {
              error('Cannot reload session, check if USE_PROXY is correctly set if using a proxy.')
              return reject(String(`Error during checkAuth session reload: ${err}`))
            }
            return resolve('checkAuth session reloaded')
          })
        })
      } catch (err) {
        throw String(`Error during checkAuth session reload: ${err}`)
      }
    }

    try {
      await reloadSession()

      if (!req.session.authenticated) {
        await defaultExports.checkToken(req, res)
      }

      log('checkAuth all checks passed')
      return next() // forward request to next middleware
    } catch (err) {
      info(err)
      const clients = req.session ? websocket.getWsClientBySessionId(req.session.id) : []
      req.session.destroy(errDestroy => {
        // destroy session
        if (errDestroy) throw new Error(errDestroy)
      })
      if (clients)
        websocket.sendMsg({ reqId: 'server', cmd: 'logout', data: 'checkAuth failed' }, clients)
      log('checkAuth failed')
      return res.redirect(303, '/logout') // 303 - See Other
    }
  },

  updateSession: async (req, updateObj) => {
    try {
      Object.keys(updateObj).forEach(key => {
        req.session[key] = updateObj[key]
      })
      return req.session.save(err => {
        // save session to store
        if (err) {
          throw new Error(err)
        }
        return Promise.resolve()
      })
    } catch (err) {
      return Promise.reject(new Error(err))
    }
  },

  deleteSessionKey: (req, key) => {
    delete req.session[key]
  },
}

export default defaultExports
