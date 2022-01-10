// dequeue.mjs
//
// Functions to dequeue commands from the redis queue
//

import debug from 'debug'
import redis from 'redis'
import bluebird from 'bluebird'
import config from '../config'
import wcapi from '../api/wcapi'
import db from './db'
import helpers from '../helpers/helpers'

// promisify redis with bluebird
bluebird.promisifyAll(redis.RedisClient.prototype)
bluebird.promisifyAll(redis.Multi.prototype)

config.debug && debug.enable('dequeue:*')
const log = debug('dequeue:log')
const info = debug('dequeue:info')
const error = debug('dequeue:error')

const redisReadClient = redis.createClient({
  port: config.redis_port,
  host: config.redis_host,
  prefix: config.redis_prefix,
})

const launchDequeue = () => setTimeout(defaultExports.dequeue, 0)

const defaultExports = {
  dequeue: async () => {
    try {
      // pop cmd from head of the command list (blocking ie wait if list is empty)
      log('waiting on command list...')
      const replies = await redisReadClient.blpopAsync('cmdList', 0)
      log('dequeue:', replies[1])
      const msg = JSON.parse(replies[1])

      if (msg.cmd === 'updateOrder') {
        const registrantInfo = {
          query: { reqId: 'server' },
          id: msg.data.registrantId,
          sendMsg: true,
        }
        if (msg.data.filterByItems) {
          registrantInfo.query.filterByItems = msg.data.filterByItems
        }
        const orderInfo = { id: msg.data.orderId }

        log('... updateOrder', registrantInfo, orderInfo, msg.data.dataToUpdate)

        const updateOrder = async () => {
          try {
            const resp = await wcapi.updateOrder(orderInfo, msg.data.dataToUpdate)
            return wcapi.handleErrorResponse('dequeue updateOrder', resp, msg.data.dataToUpdate)
          } catch (err) {
            error('dequeue updateOrder REST WCAPI error', err)
            // handle updateOrder error here
            //   refetch order using orderId, this will update the local data and send updated data to the client
            return db.refreshRegistrants(registrantInfo, orderInfo)
          }
        }
        await updateOrder()
      } else {
        error('... unrecognized command', msg.cmd)
      }
    } catch (err) {
      error(err)
      // throw new Error(err) // FIXME: what should we do in case of errors?
    } finally {
      launchDequeue() // always relaunch dequeueing
    }
  },
}

const connectRedisRead = async () => {
  try {
    await redisReadClient.onAsync('connect')
    info('redis server read client connected')
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
connectRedisRead()

const waitRedisReadDequeue = async () => {
  try {
    await redisReadClient.onAsync('ready')
    info('redis server read client ready')
    await helpers.setRedisDone('dequeue')
    info('redis dequeue ready')
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
waitRedisReadDequeue()

const startDequeue = async () => {
  try {
    await helpers.waitForInitDone()
    launchDequeue() // launch dequeue once init is done
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
startDequeue()

export default defaultExports
