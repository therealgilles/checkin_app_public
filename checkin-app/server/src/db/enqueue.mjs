// enqueue.mjs
//
// Functions to enqueue commands into the redis queue
//

import debug from 'debug'
import redis from 'redis'
import bluebird from 'bluebird'
import config from '../config'
import helpers from '../helpers/helpers'

// promisify redis with bluebird
bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

config.debug && debug.enable('enqueue:*')
const log = debug('enqueue:log')
const info = debug('enqueue:info')
const error = debug('enqueue:error')

const redisWriteClient = redis.createClient({
  port: config.redis_port,
  host: config.redis_host,
  prefix: config.redis_prefix,
})

export default {
  enqueue: cmdInfo => {
    // add cmd to end of command list
    const msg = JSON.stringify(cmdInfo)
    log('enqueue:', msg)
    return redisWriteClient.rpushAsync(['cmdList', msg])
  },
}

const connectRedisWrite = async () => {
  try {
    await redisWriteClient.onAsync('connect')
    info('redis server write client connected')
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
connectRedisWrite()

const waitRedisWriteEnqueue = async () => {
  try {
    await redisWriteClient.onAsync('ready')
    info('redis server write client ready')
    await helpers.setRedisDone('enqueue')
    info('redis enqueue ready')
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
waitRedisWriteEnqueue()
