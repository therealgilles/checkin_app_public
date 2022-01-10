// dbUsers.mjs
//
// Functions to access users
//

import debug from 'debug'
import config from '../config'
import wpapi from '../api/wpapi'
import helpers from '../helpers/helpers'
import websocket from '../websocket/websocket'
import db from './db'

config.debug && debug.enable('dbUsers:*')
const log = debug('dbUsers:log')
const info = debug('dbUsers:info')
const error = debug('dbUsers:error')

const users = {}

const avatarSize = 96 // grab size 96
const getAvatar = (avatar, letter) => {
  const type = isNaN(letter) ? 'latin' : 'number'
  return avatar.replace(/(number|latin)_.\.png/, `${type}_${letter.toLowerCase()}.png`)
}
const defaultAvatar = `https://secure.gravatar.com/avatar/08eb813fff818a069e7f798f5574a7c7?f=y&s=${avatarSize}&d=mm&r=g`

const defaultExports = {
  users,
  avatarSize,
  defaultAvatar,

  dbResetUsers: async () => {
    try {
      log('Resetting all users')
      return Promise.all(
        ['users'].map(async objName => {
          await helpers.emptyRedisObject(db, defaultExports[objName], objName)
        })
      )
    } catch (err) {
      throw new Error(err)
    }
  },
  dbUpdateUser: (userId, updatedUser) =>
    db.redisDbClient.hsetAsync('users', userId, JSON.stringify(updatedUser)),

  refreshUsersMemoized: null,
  refreshUsersCore: async (userInfoArg = {}) => {
    try {
      const userInfo = helpers.objValMayBeNumber(userInfoArg, 'id', { isNumber: true })

      await websocket.sendMsg({
        reqId: userInfo.query ? userInfo.query.reqId : undefined,
        cmd: userInfo.id ? 'updating user' : 'updating users',
        data: userInfo,
      })
      if (!helpers.objHasKey(userInfo, 'id')) {
        await defaultExports.dbResetUsers(userInfo)
      }
      const userList = await wpapi.getUsers(userInfo)
      let status = 'not updated'

      if (
        userInfo.query &&
        userInfo.query.reqId &&
        websocket.isCancelledRequestId(userInfo.query.reqId)
      ) {
        info('Not updating users because request was cancelled')
        status += ', request cancelled' // do not update users if the request was cancelled
      } else {
        if (userInfo.id && isNaN(userInfo.id)) {
          throw new Error(`User ID ${userInfo.id} is not a number`)
        }
        status = 'updated'

        const skipUnusedUsers = db.settings.uiUsers.skipUnusedUsers
        const skipUnusedUsersLimit =
          3600 * 365.25 * db.settings.uiUsers.skipUnusedUsersOptions.defaultValue

        await Promise.all(
          userList.map(async user => {
            try {
              if (!userInfo.id && skipUnusedUsers) {
                // skip user if they have not logged in for more than 2 years
                if (
                  !user.first_name.match(/Gilles/i) && // keep all test accounts
                  user.meta.when_last_login &&
                  !isNaN(user.meta.when_last_login)
                ) {
                  const currentTimestamp = Math.floor(Date.now() / 1000)
                  const d = currentTimestamp - user.meta.when_last_login
                  if (d > skipUnusedUsersLimit) {
                    log('skipping USER', user.id, user.meta.when_last_login)
                    return
                  }
                }
              }

              log('refreshUsers user id =', user.id)
              // log('avatar = ', user.avatar_urls[96])
              users[user.id] = {
                firstname: user.first_name,
                lastname: user.last_name,
                email: helpers.obscureEmail(user.email),
                username: user.username,
                avatar: getAvatar(user.avatar_urls[avatarSize], user.first_name.charAt(0)),
                meta: user.meta,
                roles: user.roles.filter(role => Object.keys(config.wcapi_users).includes(role)), // grab useful user roles
              }
              if (user.birthday_discount) {
                // transform into boolean
                users[user.id].birthday_discount = true
              }
              if (user.birthday_needs_verification) {
                // transform into boolean
                users[user.id].birthday_needs_verification = true
              }
              await defaultExports.dbUpdateUser(user.id, users[user.id])
              if (userInfo.sendMsg) {
                // the user ID is not necessarily set by now
                const localUserInfo = { id: user.id, ...userInfo }
                await defaultExports.updateUserSendMsg(localUserInfo)
              }
            } catch (err) {
              error(err)
              throw new Error(err)
            }
          })
        )
      }

      log('number of users', Object.keys(users).length)

      const sfx = userInfo.id ? '' : 's'
      return websocket.sendMsg({
        reqId: 'server', // userInfo.query ? userInfo.query.reqId : undefined,
        cmd: `user${sfx} ${status}`,
        data: userInfo,
      })
    } catch (err) {
      throw new Error(err)
    }
  },
  refreshUsers: async (userInfo = {}, { keyCheck = false } = {}) => {
    try {
      if (!defaultExports.refreshUsersMemoized) {
        defaultExports.refreshUsersMemoized = helpers.asyncMemoizeUntilDone(
          defaultExports.refreshUsersCore
        )
      }

      return defaultExports.refreshUsersMemoized({ key: userInfo.id, keyCheck }, userInfo)
    } catch (err) {
      throw new Error(err)
    }
  },

  // make sure we use a number for the ID
  getUsers: (userInfo = {}) => Promise.resolve(userInfo.id ? users[Number(userInfo.id)] : users),

  updateUser: async (userInfoArg, newDataToUpdate) => {
    if (!newDataToUpdate) {
      return Promise.resolve()
    }

    const userInfo = helpers.objValMayBeNumber(userInfoArg, 'id', { isNumber: true })
    const dataToUpdate = {}

    if (newDataToUpdate.meta) {
      // support specific meta fields updates
      dataToUpdate.meta = {}
      if (newDataToUpdate.meta.birthday_verified !== undefined)
        dataToUpdate.meta.birthday_verified = newDataToUpdate.meta.birthday_verified
    }

    const localUserInfo = { query: { reqId: 'server' }, id: userInfo.id, sendMsg: true }

    await wpapi.updateUser(userInfo, dataToUpdate)
    return defaultExports.refreshUsers(localUserInfo)
  },

  updateUserSendMsg: userInfoArg => {
    const userInfo = helpers.objValMayBeNumber(userInfoArg, 'id', { isNumber: true })

    return websocket.sendMsg({
      reqId: 'server',
      cmd: 'update user',
      data: { id: userInfo.id, userData: users[userInfo.id] },
    })
  },

  getUserAvatar: async userInfo => {
    try {
      // Request user info if missing
      if (!users[userInfo.id]) {
        await defaultExports.refreshUsers(userInfo)
      } else {
        // wait for user update to be done
        await defaultExports.refreshUsers(userInfo, { keyCheck: true })
      }

      return users[userInfo.id].avatar
    } catch (err) {
      throw new Error(err)
    }
  },
}

export default defaultExports
