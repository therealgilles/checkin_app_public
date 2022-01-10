// WooCommerceAPIRetry.mjs
//
// Add retry to woocommerce REST API _request function
//

import debug from 'debug'
import WooCommerceAPIRetry from 'woocommerce-api'
import requestretry from 'requestretry'
import throttledRequest from 'throttled-request'
import config from '../config'

config.debug && debug.enable('WooCommerceAPIRetry:*')
// const log = debug('WooCommerceAPIRetry:log')
// const info = debug('WooCommerceAPIRetry:info')
// const error = debug('WooCommerceAPIRetry:error')

// throttle Woocommerce API requests
const request = throttledRequest(requestretry)
request.configure({
  requests: 10,
  milliseconds: 1000,
})

// Override the request function to use requestretry
// (copied from node_modules/woocommerce-api/index.js and modified)
WooCommerceAPIRetry.prototype._request = function _request(method, endpoint, data, callback) {
  const url = this._getUrl(endpoint)

  const params = {
    url,
    method,
    encoding: this.encoding,
    timeout: this.timeout,
    headers: {
      'User-Agent': `WooCommerce API Client-Node.js/${this.classVersion}`,
      Accept: 'application/json'
    },

    // requestretry parameters
    maxAttempts: 3, // try 3 times
    retryDelay: 200, // wait for 100ms before trying again
  }

  if (this.isSsl) {
    if (this.queryStringAuth) {
      params.qs = {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }
    } else {
      params.auth = {
        user: this.consumerKey,
        pass: this.consumerSecret
      }
    }

    if (!this.verifySsl) {
      params.strictSSL = false
    }
  } else {
    params.qs = this._getOAuth().authorize({
      url,
      method,
    })
  }

  if (data) {
    params.headers['Content-Type'] = 'application/json;charset=utf-8'
    params.body = JSON.stringify(data)
  }

  if (!callback) {
    return request(params)
  }

  return request(params, callback)
}

export default WooCommerceAPIRetry
