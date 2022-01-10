// serverDebug.mjs
//
// Server debug utilities
//

import debug from 'debug'
import asyncHandler from 'express-async-handler'
import config from './config'
import wcapi from './api/wcapi'
import tecapi from './api/tecapi'
import wpapi from './api/wpapi'

config.debug && debug.enable('serverDebug:*')
// const log = debug('serverDebug:log')
// const info = debug('serverDebug:info')
// const error = debug('serverDebug:error')

export default {
  addDebugRoutes: (expressServer, db) => {
    if (config.self_test) {
      // API calls for testing only
      expressServer.get(
        '/api/debug/orders',
        asyncHandler(async (req, res, next) => {
          const orders = await wcapi.getOrders()
          res.json(orders)
        })
      )
      expressServer.get(
        '/api/debug/orders/:orderId',
        asyncHandler(async (req, res, next) => {
          const orders = await wcapi.getOrder({ id: decodeURIComponent(req.params.orderId) })
          res.json(orders)
        })
      )
      expressServer.get(
        '/api/debug/products',
        asyncHandler(async (req, res, next) => {
          const products = await wcapi.getProducts()
          res.json(products)
        })
      )
      expressServer.get(
        '/api/debug/products/:productId',
        asyncHandler(async (req, res, next) => {
          const products = await wcapi.getProduct({ id: decodeURIComponent(req.params.productId) })
          res.json(products)
        })
      )
      expressServer.get(
        '/api/debug/events',
        asyncHandler(async (req, res, next) => {
          const events = await tecapi.getEvents()
          res.json(events)
        })
      )
      expressServer.get(
        '/api/debug/events/:eventId',
        asyncHandler(async (req, res, next) => {
          const evt = await tecapi.getEvent({ id: decodeURIComponent(req.params.eventId) })
          res.json(evt)
        })
      )
      expressServer.get(
        '/api/debug/users',
        asyncHandler(async (req, res, next) => {
          const users = await wpapi.getUsers()
          res.json(users)
        })
      )
      expressServer.get(
        '/api/debug/users/:userId',
        asyncHandler(async (req, res, next) => {
          const user = await wpapi.getUser({ id: decodeURIComponent(req.params.userId) })
          res.json(user)
        })
      )

      expressServer.get(
        '/api/debug/testUpdateRegistrant',
        asyncHandler(async (req, res, next) => {
          const query = { reqId: 'server-testing', filterByItems: 'true' }
          const orderInfo = { id: 8195 } // get specific order
          const eventInfo = { id: 8144, query } // get specific event
          const productInfo = { id: 8192, variations: [8194] } // get specific product and product variation
          // const registrantInfo = { id: config.gilles.users } // user/registrant
          await db.refreshItems(eventInfo, productInfo)
          const registrantId = await db.refreshRegistrants({ query }, orderInfo)

          const checkins = {}
          const { single: checkinKey } = db.getCheckinKey(
            orderInfo.id,
            productInfo.id,
            productInfo.variations[0]
          )
          checkins[checkinKey] = '' // '2016-12-14 20:04:45'
          const dataToUpdate = { orderId: orderInfo.id, checkins }

          await db.updateRegistrant({ id: registrantId }, dataToUpdate) // update check-in status
          res.sendStatus(200)
        })
      )
    }
  },
}
