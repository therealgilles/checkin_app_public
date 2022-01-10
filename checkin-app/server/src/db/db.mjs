// db.mjs
//
// Functions to access items, registrants, users, and settings
//

import debug from 'debug'
import redis from 'redis'
import bluebird from 'bluebird'
import config from '../config'
import helpers from '../helpers/helpers'
import dbItems from './dbItems'
import dbUsers from './dbUsers'
import dbRegistrants from './dbRegistrants'
import dbSettings from './dbSettings'
import dbPlacements from './dbPlacements'

// promisify redis with bluebird
bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

config.debug && debug.enable('db:*')
const log = debug('db:log')
const info = debug('db:info')
const error = debug('db:error')

const redisDbClient = redis.createClient({ port: config.redis_port, host: config.redis_host, prefix: config.redis_prefix })

const waitForRedisConnect = async () => {
  try {
    await redisDbClient.onAsync('connect')
    info('Redis server db client connected')
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
waitForRedisConnect()

const waitForRedisDataRestored = async () => {
  try {
    await redisDbClient.onAsync('ready')
    info('Redis server db client ready')

    await Promise.all([
      // Restore db data from redis
      //   merge settings
      redisDbClient.hgetallAsync('settings').then(result => helpers.redisRestoreHash(result, dbSettings.settings, {
        merge: true,
        override: { app: { version: config.version } } // always use the config version
      })),
      redisDbClient.hgetallAsync('slugOfEventItem').then(result => helpers.redisRestoreObj(result, dbItems.slugOfEventItem)),
      redisDbClient.hgetallAsync('slugOfProductItem').then(result => helpers.redisRestoreObj(result, dbItems.slugOfProductItem)),
      redisDbClient.hgetallAsync('items').then(result => helpers.redisRestoreHash(result, dbItems.items)),
      redisDbClient.hgetallAsync('registrants').then(result => helpers.redisRestoreHash(result, dbRegistrants.registrants)),
      redisDbClient.hgetallAsync('users').then(result => helpers.redisRestoreHash(result, dbUsers.users)),
      redisDbClient.hgetallAsync('orderBillingInfo').then(result => helpers.redisRestoreHash(result, dbRegistrants.orderBillingInfo)),
      redisDbClient.hgetallAsync('registrantsByEmail').then(result => helpers.redisRestoreHash(result, dbRegistrants.registrantsByEmail)),
      redisDbClient.hgetallAsync('placements').then(result => helpers.redisRestoreHash(result, dbPlacements.placements)),
    ])
    log('Redis data restored')
    return helpers.setRedisDone('db')
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
waitForRedisDataRestored()

const defaultExports = { redisDbClient }
// add db files exports to the local export
Object.keys(dbItems).forEach(e => { defaultExports[e] = dbItems[e] })
Object.keys(dbUsers).forEach(e => { defaultExports[e] = dbUsers[e] })
Object.keys(dbRegistrants).forEach(e => { defaultExports[e] = dbRegistrants[e] })
Object.keys(dbSettings).forEach(e => { defaultExports[e] = dbSettings[e] })
Object.keys(dbPlacements).forEach(e => { defaultExports[e] = dbPlacements[e] })

export default defaultExports
