const debug = require('debug')
const { createProxyMiddleware } = require('http-proxy-middleware')

debug.enable('setupProxy:*')
// const log = debug('setupProxy:log')
// const info = debug('setupProxy':info')
const error = debug('setupProxy:error')

const unencryptedBE = (process.env.REACT_APP_UNENCRYPTED_BACKEND === 'true')
const target = unencryptedBE ? 'http://localhost:8888' : 'https://localhost:8443'

module.exports = function setupProxy(app) {
  // app.use(createProxyMiddleware('/login', { target, secure: false }))
  // app.use(createProxyMiddleware('/logout', { target, secure: false }))
  // app.use(createProxyMiddleware('/oauth_redirect', { target, secure: false }))
  // app.use(createProxyMiddleware('/api', { target, secure: false }))
  app.use(createProxyMiddleware('/ws', {
    target,
    secure: false,
    ws: true,
    onError: (err, req, res) => {
      error(err)
    }
  }))
  app.use(createProxyMiddleware({
    target,
    secure: false,
    // logLevel: 'debug',
    // onProxyRes: (proxyRes, req, res) => {
    //   // log('response headers =', proxyRes.headers)
    // },
  }))
}
