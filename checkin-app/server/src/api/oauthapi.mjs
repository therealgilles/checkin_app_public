// oauthapi.mjs
//
// Functions accessing the oauth2 server
//

// OAuth2 Protocol
// request url: /oauth/authorize?response_type=code&client_id=TestClient&redirect_uri=https://redirect-uri.com/cb
// redirect with code: https://redirect-uri.com/cb?code=xxx
// request token: curl -u client_id:client_secret http://server.com/oauth/token -d 'grant_type=authorization_code&code=xxx'
// received token: {
//   "access_token":"2e5a2e729965f12a90cf977ad723c5533133a911",
//   "expires_in":86400,
//   "token_type":"Bearer",
//   "scope":"basic",
//   "refresh_token":"aed1d92c9b985ae1e770925497414b9d1238e41c"
// }

import debug from 'debug'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import config from '../config'
import helpers from '../helpers/helpers'

config.debug && debug.enable('oauthapi:*')
const log = debug('oauthapi:log')
// const info = debug('oauthapi:info')
const error = debug('oauthapi:error')

const oauthAxios = axios.create({
  baseURL: `${config.url}/${config.oauthapi_path}`,
  headers: {
    Authorization: '', // not set yet
    'Cache-Control': 'no-cache',
  },
})

axiosRetry(oauthAxios, { retries: 3 })

const defaultExports = {
  updateAuth: auth => {
    log('oauthapi updateAuth', auth)
    oauthAxios.defaults.headers.Authorization = auth
  },

  getCurrentUser: async () => {
    try {
      const resp = await oauthAxios.get('/me')
      return resp.data
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getCurrentUserName: async () => {
    try {
      const user = await defaultExports.getCurrentUser()
      return helpers.nameCapitalize(user.display_name || user.user_nicename || user.user_login)
    } catch (err) {
      throw new Error(err)
    }
  },
}

export default defaultExports
