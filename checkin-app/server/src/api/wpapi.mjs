// wpapi.mjs
//
// Functions accessing the wordpress REST API
//

import debug from 'debug'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import config from '../config'
import helpers from '../helpers/helpers'

config.debug && debug.enable('wpapi:*')
const log = debug('wpapi:log')
// const info = debug('wpapi:info')
const error = debug('wpapi:error')

const wpAxios = axios.create({
  baseURL: `${config.url}/${config.wpapi_path}/${config.wpapi_version}`,
  headers: {
    Authorization: `Basic ${config.auth_token}`,
    // 'Cache-Control': 'no-cache',
  },
})

axiosRetry(wpAxios, { retries: 3 })

const defaultExports = {
  updateAuth: auth => {
    log('wpapi updateAuth', auth)
    wpAxios.defaults.headers.Authorization = auth
  },

  getUser: async userInfo => {
    try {
      const context = `context=${userInfo.context || 'edit'}`
      const resp = await wpAxios.get(`/users/${userInfo.id}?${context}`)
      return resp.data
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getUsers: async (userInfo = {}) => {
    try {
      if (userInfo.id) {
        const user = await defaultExports.getUser(userInfo)
        return [user]
      }
      const perPage = `per_page=${userInfo.per_page || 1}`
      const resp = await wpAxios.get(`/users?${perPage}`)
      const totalUsers = resp.headers['x-wp-totalpages'] || 0
      log(`number of users: ${totalUsers} users`)

      // the REST API gives at most 100 users per page, so we need to grab all the pages
      const pageSize = 100
      const pages = []
      for (let i = 1; i <= Math.ceil(totalUsers / pageSize); i++) {
        pages.push(i)
        log('user batch', i)
      }
      const context = `context=${userInfo.context || 'edit'}`
      const usersArray = await Promise.all(
        pages.map(async page => {
          const r = await wpAxios.get(`users?page=${page}&per_page=${pageSize}&${context}`)
          return r.data
        })
      )
      return helpers.arrayFlatten(usersArray)
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  updateUser: (userInfo, userData) => {
    const context = `context=${userInfo.context || 'edit'}`
    return wpAxios.post(`/users/${userInfo.id}?${context}`, userData)
  },
}

// For testing:
if (config.self_test) {
  const wpapiTesting = async () => {
    try {
      await helpers.waitForInitDone() // delay testing to make sure all modules are loaded
      const users = await defaultExports.getUsers({ id: config.users.test_user })
      users.map(user => log(`Username: ${user.name}`))
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  }
  wpapiTesting()
}

export default defaultExports
