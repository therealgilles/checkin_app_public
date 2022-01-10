// dbRegistrants.mjs
//
// Functions to access registrants
//

import debug from 'debug'
import he from 'html-entities'
import striptags from 'striptags'
import diff from 'deep-diff'
import config from '../config'
import wcapi from '../api/wcapi'
import enqueue from './enqueue'
import helpers from '../helpers/helpers'
import websocket from '../websocket/websocket'
import db from './db'
import dbItems from './dbItems' // we could also just use db
import dbUsers from './dbUsers' // we could also just use db
import dbPlacements from './dbPlacements' // we could also just use db

config.debug && debug.enable('dbRegistrants:*')
const log = debug('dbRegistrants:log')
const info = debug('dbRegistrants:info')
const error = debug('dbRegistrants:error')

const registrants = {}
const orderBillingInfo = {}
const registrantsByEmail = {}

const defaultExports = {
  registrants,
  orderBillingInfo,
  registrantsByEmail,

  dbResetRegistrants: async () => {
    try {
      log('dbResetRegistrants', 'empty registrants objects')
      return Promise.all(
        ['registrants', 'orderBillingInfo', 'registrantsByEmail'].map(async objName => {
          await helpers.emptyRedisObject(db, defaultExports[objName], objName)
        })
      )
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  dbUpdateRegistrant: async (registrantId, updatedRegistrant, orderIds = [], registrantEmail) => {
    try {
      log('dbUpdateRegistrant', orderIds)
      await Promise.all(
        orderIds.map(async orderId =>
          db.redisDbClient.hsetAsync(
            'orderBillingInfo',
            orderId,
            JSON.stringify(orderBillingInfo[orderId])
          )
        )
      )
      if (registrantEmail) {
        await db.redisDbClient.hsetAsync(
          'registrantsByEmail',
          registrantEmail,
          JSON.stringify(registrantsByEmail[registrantEmail])
        )
      }
      return db.redisDbClient.hsetAsync(
        'registrants',
        registrantId,
        JSON.stringify(updatedRegistrant)
      )
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getOrderRegistrantId: order =>
    order.customer_id ||
    (
      order.billing.email ||
      `${order.billing.last_name}, ${order.billing.first_name} [#${order.id}]`
    ).toLowerCase(),

  refreshRegistrants: async (registrantInfoArg = {}, orderInfoArg = {}, orderContent = []) => {
    try {
      const registrantInfo = helpers.objValMayBeNumber(registrantInfoArg, 'id', {
        toLowerCase: true,
      })
      const orderInfo = helpers.objValMayBeNumber(orderInfoArg, 'id', {
        isNumber: true,
        deepCopy: true,
      })
      log('refreshRegistrants', 'registrantInfo', registrantInfo, 'orderInfo', orderInfo)

      if (
        config.use_placements &&
        !helpers.objHasKey(registrantInfo, 'id') &&
        !helpers.objHasKey(orderInfo, 'id')
      ) {
        log('refreshRegistrants', 'getting placement info')
        try {
          await dbPlacements.getPlacements({ refresh: true })
        } catch (err) {
          error(err) // do not throw here, we do not want to stop if placements cannot be loaded
        }
      }

      // If registrant ID is available and order content is provided, save deep copy of registrants[regId] (if it exists)
      // and compare it to the resulting registrant[regId] after the update, to see if we need to send the
      // update to the clients.
      let savedReg
      if (
        helpers.objHasKey(registrantInfo, 'id') &&
        orderContent.length &&
        helpers.objHasKey(registrants, registrantInfo.id)
      ) {
        savedReg = JSON.parse(JSON.stringify(registrants[registrantInfo.id]))
      }

      // if id is not specified and we have items with event and product, add array of product IDs to the query
      if (!helpers.objHasKey(orderInfo, 'id') && Object.keys(dbItems.items).length) {
        // log('items', dbItems.items)
        const productIds = []
        Object.keys(dbItems.items).forEach(slug => {
          if (dbItems.items[slug].event && dbItems.items[slug].product) {
            productIds.push(dbItems.items[slug].product.id)
          }
        })
        if (productIds.length) {
          log(`refreshRegistrants product IDs: ${productIds}`)
          orderInfo.query_products = productIds
        }
      }

      orderInfo.query || (orderInfo.query = {})

      if (!config.hasEvents) {
        // if we are not using events, use date range to find orders
        const settings = await db.getSettings()
        if (settings.events) {
          orderInfo.query.after || (orderInfo.query.after = settings.events.start_date)
          orderInfo.query.before || (orderInfo.query.before = settings.events.end_date)
        }
      }

      orderInfo.query.after || (orderInfo.query.after = 'none')
      orderInfo.query.before || (orderInfo.query.before = 'none')

      // send message that we are starting to update registrants
      await websocket.sendMsg({
        reqId: registrantInfo.query ? registrantInfo.query.reqId : undefined,
        cmd: `${orderInfo.id ? 'updating registrant' : 'updating registrants'}`,
        data: orderInfo.id ? { orderInfo } : {},
      })

      // no reset when we have a specified registrant ID or order ID or a list of orders
      if (
        !helpers.objHasKey(registrantInfo, 'id') &&
        !helpers.objHasKey(orderInfo, 'id') &&
        !orderContent.length
      ) {
        await defaultExports.dbResetRegistrants()
      }

      // do not look up orders by registrant ID as it may not be a customer ID
      // FIXME: we could do a search by registrant ID if we used the order ID when customer/email are not available
      let savedRegistrantId
      const orderArray = orderContent.length ? orderContent : await wcapi.getOrders(orderInfo)
      if (orderArray.length === 1) log('orderArray', orderInfo, orderArray)

      if (
        registrantInfo.query &&
        registrantInfo.query.reqId &&
        websocket.isCancelledRequestId(registrantInfo.query.reqId)
      ) {
        log('Not updating registrants because request was cancelled')
        // do not update users if the request was cancelled
      } else {
        await Promise.all(
          orderArray.map(async order => {
            try {
              let skipOrder = false
              let registrantId
              let registrantEmail
              let orderId

              if (!order) {
                error('Order undefined', registrantInfoArg, orderInfoArg, orderContent)
                return Promise.resolve()
              }

              // Specific order refresh and order was deleted permanently
              if (!order.id && orderInfo.id) {
                skipOrder = true
                orderId = orderInfo.id
                if (helpers.objHasKey(orderBillingInfo, orderId)) {
                  registrantId = orderBillingInfo[orderId].registrantId
                  registrantEmail = orderBillingInfo[orderId].email

                  if (!registrantId) {
                    // try to get the registrant id/email from the registrants object
                    for (const id in registrants) {
                      if (helpers.objHasKey(registrants[id].total, orderId)) {
                        registrantId = id
                        if (isNaN(id) && !id.match(/\s/)) {
                          registrantEmail = registrantId
                        }
                        break
                      }
                    }
                  }

                  savedRegistrantId = registrantId
                  info('deleting order', orderId, registrantId, registrantEmail)
                  await defaultExports.deleteRegistrantOrder(registrantId, registrantEmail, orderId)
                }
              } else {
                orderId = order.id
              }

              log('refreshRegistrants order id =', orderId)

              // do not skip if order has no line items, we probably want it (to re-add items to it)
              if (
                order.line_items &&
                order.line_items.length > 0 &&
                registrantInfo.query.skipIfMissingAllItems
              ) {
                if (
                  order.line_items.length ===
                  order.line_items.filter(item => !dbItems.slugOfProductItem[item.product_id])
                    .length
                ) {
                  // skip order if all line items have no corresponding loaded product items
                  log(
                    '... skip order because all line items have no corresponding loaded product items'
                  )
                  skipOrder = true
                }
              }

              if (!skipOrder) {
                // identify registrant (try id first, then email, then last/first names with order ID)
                //   this allows to group orders per registrant as much as possible
                registrantId = defaultExports.getOrderRegistrantId(order)
                savedRegistrantId = registrantId
                if (helpers.objHasKey(registrantInfo, 'id') && registrantId !== registrantInfo.id) {
                  const err = `refreshRegistrants registrant ID does not match: ${registrantInfo.id} != ${registrantId}`
                  throw new Error(err)
                }
                log('refreshRegistrants registrant id =', registrantId)
                registrants[registrantId] || (registrants[registrantId] = {})
                registrants[registrantId].id = registrantId // FIXME: this is sensitive information
                registrantEmail = order.billing.email && order.billing.email.toLowerCase()

                const userId = order.customer_id

                if (userId !== 0 && userId !== '') {
                  registrants[registrantId].lastname = order.user_lastname
                  registrants[registrantId].firstname = order.user_firstname
                  registrants[registrantId].email = helpers.obscureEmail(order.user_email)
                  try {
                    registrants[registrantId].avatar = await dbUsers.getUserAvatar({
                      query: registrantInfo.query,
                      id: userId,
                      sendMsg: true,
                    })
                  } catch (err) {
                    error(err)
                    error('Avatar not found for user', userId)
                  }
                } else {
                  registrants[registrantId].lastname = order.billing.last_name
                  registrants[registrantId].firstname = order.billing.first_name
                  registrants[registrantId].email = helpers.obscureEmail(registrantEmail) || ''
                }

                // save order billing email for store credit
                orderBillingInfo[order.id] = {
                  email: registrantEmail || 'unknown_email',
                  firstname: order.billing.first_name,
                  lastname: order.billing.last_name,
                  registrantId,
                }
                if (registrantEmail) {
                  registrantsByEmail[registrantEmail] || (registrantsByEmail[registrantEmail] = {})
                  registrantsByEmail[registrantEmail].id = registrantId
                  registrantsByEmail[registrantEmail].orderIds ||
                    (registrantsByEmail[registrantEmail].orderIds = {})
                  registrantsByEmail[registrantEmail].orderIds[order.id] = true
                }

                registrants[registrantId].avatar ||
                  (registrants[registrantId].avatar = dbUsers.defaultAvatar)

                registrants[registrantId].order_notes ||
                  (registrants[registrantId].order_notes = {})
                registrants[registrantId].order_notes[order.id] = {} // clear object
                const regNotes = order.meta_data
                  .filter(metaData => metaData.key.match(/^(order|_billing)_notes$/))
                  .map(metaData => metaData.value)
                  .filter(value => value !== '')
                // use -1 as ID for customer order/registration notes
                regNotes.length &&
                  (registrants[registrantId].order_notes[order.id][-1] = he.decode(
                    regNotes.join(' ')
                  ))
                order.order_notes &&
                  Object.keys(order.order_notes).forEach(noteId => {
                    registrants[registrantId].order_notes[order.id][noteId] = order.order_notes[
                      noteId
                    ].replace(/ \[added (with|by) checkin app\]/, '')
                  })
                registrants[registrantId].customer_note ||
                  (registrants[registrantId].customer_note = {})
                if (order.customer_note) {
                  if (!order.customer_note.match(/manually entered/i)) {
                    // use -2 as ID for customer order/registration notes
                    registrants[registrantId].order_notes[order.id][-2] = he
                      .decode(order.customer_note)
                      .replace(/ \[added (with|by) checkin app\]/, '')
                  } else {
                    registrants[registrantId].customer_note[order.id] = he.decode(
                      order.customer_note
                    )
                  }
                }
                // delete order notes object if they aren't any
                if (!Object.keys(registrants[registrantId].order_notes[order.id]).length)
                  delete registrants[registrantId].order_notes[order.id]

                registrants[registrantId].payment_method ||
                  (registrants[registrantId].payment_method = {})
                registrants[registrantId].payment_method[order.id] = order.payment_method
                registrants[registrantId].total || (registrants[registrantId].total = {})
                registrants[registrantId].total[order.id] = Number(order.total)

                registrants[registrantId].refunds || (registrants[registrantId].refunds = {})
                registrants[registrantId].refunds[order.id] = {} // clear object
                order.refunds &&
                  order.refunds.forEach(refund => {
                    registrants[registrantId].total[order.id] += Number(refund.total)
                    registrants[registrantId].refunds[order.id][refund.id] = refund
                  })
                if (!Object.keys(registrants[registrantId].refunds[order.id]).length)
                  delete registrants[registrantId].refunds[order.id]

                registrants[registrantId].date_paid || (registrants[registrantId].date_paid = {})
                registrants[registrantId].date_paid[order.id] = order.date_paid
                registrants[registrantId].order_status ||
                  (registrants[registrantId].order_status = {})
                registrants[registrantId].order_status[order.id] = order.status
                registrants[registrantId].cancellable ||
                  (registrants[registrantId].cancellable = {})
                registrants[registrantId].cancellable[order.id] =
                  order.status !== 'cancelled' ? 1 : 0
                registrants[registrantId].refundable || (registrants[registrantId].refundable = {})
                if (
                  (registrants[registrantId].customer_note[order.id] || '').match(
                    /manually entered/i
                  )
                ) {
                  registrants[registrantId].refundable[order.id] = 'front desk'
                } else if (registrants[registrantId].total[order.id]) {
                  registrants[registrantId].refundable[order.id] = 1
                } else {
                  registrants[registrantId].refundable[order.id] = 0
                }

                // QUESTION: why group the checkins together instead of separating them by order id?
                registrants[registrantId].checkins || (registrants[registrantId].checkins = {})
                if (order.checkins) {
                  // De-stringify before putting in registrants object
                  const checkins = JSON.parse(order.checkins)
                  Object.keys(checkins).forEach(key => {
                    // merge is safer here
                    registrants[registrantId].checkins[key] =
                      checkins[key] || registrants[registrantId].checkins[key]
                  })
                }

                registrants[registrantId].order_extra ||
                  (registrants[registrantId].order_extra = {})
                if (order.order_extra) {
                  // De-stringify before putting in registrants object
                  const orderExtra = JSON.parse(order.order_extra)
                  registrants[registrantId].order_extra[order.id] ||
                    (registrants[registrantId].order_extra[order.id] = {})
                  Object.keys(orderExtra).forEach(key => {
                    // merge is safer here
                    registrants[registrantId].order_extra[order.id][key] =
                      orderExtra[key] || registrants[registrantId].order_extra[order.id][key]
                  })
                }

                registrants[registrantId].items || (registrants[registrantId].items = {})
                // clear existing items with the same order ID
                const re = new RegExp(`^${order.id}-`)
                Object.keys(registrants[registrantId].items || {}).forEach(key => {
                  if (key.match(re)) delete registrants[registrantId].items[key]
                })

                for (const item of Object.values(order.line_items)) {
                  const orderIdItemId = `${order.id}-${item.id}`

                  registrants[registrantId].items[orderIdItemId] = {
                    id: order.id,
                    status: order.status,
                    lastname: order.billing.last_name,
                    firstname: order.billing.first_name,
                    email: helpers.obscureEmail(registrantEmail) || '',
                    item_id: item.id,
                    item_name: striptags(he.decode(helpers.fixItemName(item.name))),
                    item_product_id: item.product_id,
                    item_variation_id: item.variation_id,
                    item_quantity: item.quantity,
                    item_meta_data: helpers.fixItemAttrs(item.meta_data), // [{ id: 35109, key: 'pa_role', value: 'Follower' }]
                    item_total: item.total,
                    checkin_key: undefined,
                    checkin_keys: undefined,
                  }

                  try {
                    // eslint-disable-next-line no-await-in-loop
                    const { single: checkinKey, all: checkinKeys } = await dbItems.getCheckinKey(
                      order.id,
                      item.product_id,
                      item.variation_id,
                      registrantInfo
                    )
                    registrants[registrantId].items[orderIdItemId].checkin_key = checkinKey
                    registrants[registrantId].items[orderIdItemId].checkin_keys = checkinKeys
                  } catch (err) {
                    error(err)
                    error(
                      `Could not get checkin keys for user ${registrantId}`,
                      `/ order = ${orderIdItemId}`,
                      `/ product = ${item.product_id} / variation = ${item.variation_id}`
                    )
                  }

                  if (config.use_placements) {
                    const track = dbPlacements.getTrack(
                      {
                        email: registrantEmail,
                        firstname: orderBillingInfo[order.id].firstname,
                        lastname: orderBillingInfo[order.id].lastname,
                      },
                      order.id,
                      item
                    )

                    if (track) {
                      const regItem = registrants[registrantId].items[orderIdItemId]
                      regItem.item_meta_data || (regItem.item_meta_data = [])
                      const ids = {}
                      regItem.item_meta_data.forEach(metaData => {
                        ids[metaData.id] = true
                      })
                      let id = helpers.generateItemMetaId()
                      while (ids[id]) {
                        id = helpers.generateItemMetaId() // make sure it's unique
                      }
                      // log({ id: Number(id), key: 'pa_track', value: track })
                      regItem.item_meta_data.push({
                        id: Number(id),
                        key: 'pa_placement',
                        value: track,
                      })
                    }
                  }
                }

                if (registrants[registrantId].refunds[order.id]) {
                  // load refunds to see if some item quantities/total were changed
                  const refunds = await wcapi.getRefunds({ id: order.id })
                  refunds.forEach(refund => {
                    // log('refund', refund, registrants[registrantId].items)
                    refund.line_items.forEach(refundItem => {
                      // find item matching the refund item
                      const matchingItems = Object.keys(registrants[registrantId].items).filter(
                        key =>
                          registrants[registrantId].items[key].id === order.id &&
                          registrants[registrantId].items[key].item_product_id ===
                            refundItem.product_id &&
                          registrants[registrantId].items[key].item_variation_id ===
                            refundItem.variation_id
                      )
                      if (matchingItems.length) {
                        const regItem = registrants[registrantId].items[matchingItems[0]]
                        regItem.item_quantity += refundItem.quantity
                        regItem.total = (
                          Number(regItem.item_total) + Number(refundItem.total)
                        ).toFixed(2)
                      }
                    })
                  })
                }

                await defaultExports.dbUpdateRegistrant(
                  registrantId,
                  registrants[registrantId],
                  [order.id],
                  registrantEmail
                )
              } // if (!skipOrder)...

              if (registrantInfo.sendMsg) {
                // the registrant ID is not necessarily set in registrantInfo
                const localRegistrantInfo = {
                  id: registrantId,
                  ...registrantInfo,
                }

                // only proceed if we have a registrant matching the registrant ID
                if (
                  localRegistrantInfo.id &&
                  helpers.objHasKey(registrants, localRegistrantInfo.id)
                ) {
                  if (savedReg && !diff(savedReg, registrants[localRegistrantInfo.id])) {
                    localRegistrantInfo.sendMsg = false
                    if (localRegistrantInfo.id === savedRegistrantId) savedRegistrantId = null
                  }
                  await defaultExports.updateRegistrantSendMsg(localRegistrantInfo)
                }
              }

              return savedRegistrantId
            } catch (err) {
              error(err)
              throw new Error(err)
            }
          })
        ) // await Promise.all(
      }

      await websocket.sendMsg({
        reqId: 'server', // registrantInfo.query ? registrantInfo.query.reqId : undefined,
        cmd: `${savedRegistrantId ? '' : 'no '}${
          orderInfo.id ? 'registrant updated' : 'registrants updated'
        }`,
        data: orderInfo.id ? { orderInfo, registrantId: savedRegistrantId } : {},
      })

      return savedRegistrantId
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getRegistrants: async (registrantInfoArg = {}) => {
    try {
      const registrantInfo = helpers.objValMayBeNumber(registrantInfoArg, 'id', {
        toLowerCase: true,
      })
      log('getRegistrants', registrantInfo)

      // log('getRegistrants')
      const regs = {}
      const filterByItems = registrantInfo.query ? registrantInfo.query.filterByItems : undefined
      const validProductsById =
        filterByItems === 'true' ? helpers.getValidProductsById(dbItems.items) : {}

      // FIXME: should we filter the registrants object in refreshRegistrants instead?
      Object.keys(registrantInfo.id ? { [registrantInfo.id]: 1 } : registrants).forEach(regId => {
        const reg = helpers.getFilteredRegistrant(
          regId,
          registrants,
          filterByItems,
          validProductsById
        )
        // filter registrant to remove unapplicable orders (which means items/order notes)
        if (reg) regs[regId] = reg
      })

      log('getRegistrants length =', Object.keys(regs).length)
      return registrantInfo.id ? regs[registrantInfo.id] : regs
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  // registrantInfo provides registrant id - newData provides order id, checkin info
  updateRegistrant: async (registrantInfoArg, newDataToUpdate) => {
    try {
      const registrantInfo = helpers.objValMayBeNumber(registrantInfoArg, 'id', {
        toLowerCase: true,
      })
      log('updateRegistrant', registrantInfo)

      if (!newDataToUpdate) return Promise.resolve()

      // check if we have a stored ID for the registrantInfo.id (useful to new order)
      const registrantId = registrantInfo.id
      const orderIds = []
      const orders = {}
      const newOrders = {}
      const userRoles = {}
      const newDataArray =
        newDataToUpdate.constructor === Array ? newDataToUpdate : [newDataToUpdate]
      const dataToUpdate = {}
      const regInfo = {
        query: { ...registrantInfo.query, reqId: 'server' },
        id: registrantId,
        sendMsg: true,
      }

      // make sure order IDs are numbers
      newDataArray.forEach(data => {
        data.orderId = Number(data.orderId) // eslint-disable-line no-param-reassign
      })
      log('newDataArray =', newDataArray)

      // gather all orders and check for checkins/order_extra update
      let hasCheckinsUpdate = false
      let hasOrderExtraUpdate = false
      newDataArray.forEach(data => {
        const orderId = data.orderId
        orderIds[orderId] = orderId
        orders[orderId] || (orders[orderId] = {})
        if (Object.keys(data.checkins || {}).length) hasCheckinsUpdate = true
        if (Object.keys(data.order_extra || {}).length) hasOrderExtraUpdate = true
        if (data.create) {
          newOrders[orderId] = true
          const roles = (data.userRoles || [])
            .concat(helpers.objHasKey(db.users, registrantId) ? db.users[registrantId].roles : [])
            .concat(['default'])
          userRoles[orderId] = [...new Set(roles)] // uniquify
        }
      })

      // preserve existing order checkins if any
      if (hasCheckinsUpdate) {
        Object.keys(registrants[registrantId].checkins).forEach(key => {
          const orderId = key.replace(/^#(\d+).*$/, '$1')
          if (helpers.objHasKey(orders, orderId)) {
            orders[orderId].checkins || (orders[orderId].checkins = {})
            orders[orderId].checkins[key] = registrants[registrantId].checkins[key]
          }
        })
      }

      // preserve existing order extras if any
      if (hasOrderExtraUpdate) {
        Object.keys(registrants[registrantId].order_extra).forEach(orderId => {
          Object.keys(registrants[registrantId].order_extra[orderId]).forEach(key => {
            if (helpers.objHasKey(orders, orderId)) {
              orders[orderId].order_extra || (orders[orderId].order_extra = {})
              orders[orderId].order_extra[key] = registrants[registrantId].order_extra[orderId][key]
            }
          })
        })
      }

      await Promise.all(
        newDataArray.map(async data => {
          try {
            const orderId = data.orderId

            // Order checkins
            Object.keys(data.checkins || {}).forEach(key => {
              // update local data
              registrants[registrantId].checkins || (registrants[registrantId].checkins = {})
              registrants[registrantId].checkins[key] = data.checkins[key]

              orders[orderId].checkins || (orders[orderId].checkins = {})
              orders[orderId].checkins[key] = data.checkins[key]

              dataToUpdate[orderId] || (dataToUpdate[orderId] = {})
              dataToUpdate[orderId].order || (dataToUpdate[orderId].order = {})
              dataToUpdate[orderId].order.checkins = JSON.stringify(orders[orderId].checkins)
            })

            // Order extras
            Object.keys(data.order_extra || {}).forEach(key => {
              // update local data
              registrants[registrantId].order_extra || (registrants[registrantId].order_extra = {})
              registrants[registrantId].order_extra[orderId] ||
                (registrants[registrantId].order_extra[orderId] = {})
              registrants[registrantId].order_extra[orderId][key] = data.order_extra[key]

              orders[orderId].order_extra || (orders[orderId].order_extra = {})
              orders[orderId].order_extra[key] = data.order_extra[key]

              dataToUpdate[orderId] || (dataToUpdate[orderId] = {})
              dataToUpdate[orderId].order || (dataToUpdate[orderId].order = {})
              dataToUpdate[orderId].order.order_extra = JSON.stringify(orders[orderId].order_extra)
            })

            // Order status update
            if (data.order_status) {
              dataToUpdate[orderId] || (dataToUpdate[orderId] = {})
              dataToUpdate[orderId].order || (dataToUpdate[orderId].order = {})
              dataToUpdate[orderId].order.status = data.order_status

              // store credit
              if (config.support_store_credit) {
                if (data.credit_amount && data.credit_message && data.credit_date_expires) {
                  const billingInfo = orderBillingInfo[orderId]
                  dataToUpdate[orderId].credit || (dataToUpdate[orderId].credit = {})
                  dataToUpdate[orderId].credit.discount_type = 'smart_coupon'
                  dataToUpdate[orderId].credit.code = helpers.generateCouponCode()
                  dataToUpdate[orderId].credit.amount = data.credit_amount
                  dataToUpdate[orderId].credit.message = data.credit_message
                  dataToUpdate[orderId].credit.date_expires = data.credit_date_expires
                  dataToUpdate[orderId].credit.email_restrictions = [billingInfo.email]
                  dataToUpdate[orderId].credit.meta_data = []
                  dataToUpdate[orderId].credit.meta_data.customer_email =
                    dataToUpdate[orderId].credit.email_restrictions
                  dataToUpdate[
                    orderId
                  ].credit.receiver_name = `${billingInfo.firstname} ${billingInfo.lastname}`
                  log('updateRegistrant credit', dataToUpdate[orderId].credit)
                }
              }
            }

            // Order note
            if (data.order_note) {
              dataToUpdate[orderId] || (dataToUpdate[orderId] = {})
              dataToUpdate[orderId].order || (dataToUpdate[orderId].order = {})
              dataToUpdate[orderId].order.note = data.order_note
              if (data.order_note.note) {
                dataToUpdate[
                  orderId
                ].order.note.note = `${data.order_note.note} [added with checkin app]`
              }
              if (data.order_note.id) {
                dataToUpdate[orderId].order.note.id = Number(data.order_note.id) // make sure the note ID is a number
              }
              log('Order note update', dataToUpdate[orderId])
            }

            // Order refund (partial or full)
            if (data.refund) {
              dataToUpdate[orderId] || (dataToUpdate[orderId] = {})
              dataToUpdate[orderId].refund = {}
              if (data.refund.amount) {
                const refundAmount = Number(data.refund.amount) // make sure the refund amount is a number
                if (
                  registrants[registrantId].refundable[orderId] &&
                  registrants[registrantId].total[orderId] >= refundAmount
                ) {
                  dataToUpdate[orderId].refund.amount = data.refund.amount
                  dataToUpdate[orderId].refund.reason = data.refund.reason || ''
                }
              }
              if (data.refund.id) {
                dataToUpdate[orderId].refund.id = Number(data.refund.id) // make sure the refund ID is a number
              }
            }

            // New order name/email
            if (newOrders[orderId]) {
              dataToUpdate[orderId] || (dataToUpdate[orderId] = {})
              dataToUpdate[orderId].order || (dataToUpdate[orderId].order = {})
              dataToUpdate[orderId].order.billing || (dataToUpdate[orderId].order.billing = {})
              const user = data.user.id ? dbUsers.users[Number(data.user.id)] : data.user
              dataToUpdate[orderId].order.customer_id = data.user.id ? Number(data.user.id) : 0
              dataToUpdate[orderId].order.billing.first_name = user.firstname
              dataToUpdate[orderId].order.billing.last_name = user.lastname
              data.user.id || (dataToUpdate[orderId].order.billing.email = user.email) // do not send obfuscated email
              dataToUpdate[orderId].order.payment_method = 'cod'
              if (data.set_paid) dataToUpdate[orderId].order.set_paid = true
              if (data.discount_total)
                dataToUpdate[orderId].order.discount_total = Number(data.discount_total)
              const importantUserRoles = userRoles[orderId].filter(role => role !== 'default')
              if (importantUserRoles.length) {
                const s = importantUserRoles.length > 1 ? 's' : ''
                dataToUpdate[
                  orderId
                ].order.customer_note = `Applied user role${s}: ${importantUserRoles.join(', ')}`
                  .concat(' [added by checkin app]')
                  .replace(/24__under/, '24 & under')
              }
            }

            // Order items update
            if (data.items) {
              const orderInfo = { id: orderId }

              // due to UI limitations, we can only have:
              //   complete line items being removed
              //   multiple items being added
              //   items being unchanged (quantity is zero)
              const add = {}
              const remove = {}
              const changes = data.items.changes
              Object.keys(changes).forEach(itemKey => {
                const quantity = Number(changes[itemKey])
                if (quantity > 0) {
                  add[itemKey] = quantity
                } else if (quantity < 0) {
                  remove[itemKey] = -quantity
                } // ignore zero quantity
              })

              dataToUpdate[orderId] || (dataToUpdate[orderId] = {})
              dataToUpdate[orderId].order || (dataToUpdate[orderId].order = {})

              const getItemToAdd = (addId, quantity, itemBeingRemoved) => {
                const items = Object.values(dbItems.items).filter(item =>
                  helpers.itemMatchProductOrVariation(item, addId)
                )
                if (items.length !== 1) {
                  const err = `Item product/variation ID to add not found ${addId}`
                  return { err }
                }

                // existing matching line item?
                const matchingItems = order.line_items.filter(item =>
                  helpers.lineItemMatchProductOrVariation(item, addId)
                )

                let itemToAdd
                if (matchingItems.length) {
                  // existing line item
                  itemToAdd = matchingItems[0]
                  itemToAdd.quantity += quantity
                } else {
                  const item = items[0]
                  itemToAdd = {
                    quantity,
                    name: item.product.name,
                    product_id: item.product.id,
                    variation_id: 0,
                    meta_data: [],
                  }

                  let subtotal = 0
                  let total = 0

                  if (item.product.id !== addId) {
                    // product variation
                    itemToAdd.variation_id = addId
                    const variationKeys = Object.keys(item.product.product_variations)
                      .map(pVariationId => Number(pVariationId)) // make sure variation ID is a number
                      .filter(pVariationId => pVariationId === addId)

                    if (variationKeys.length !== 1) {
                      const err = `Item variation ID to add not found ${addId}`
                      return { err }
                    }

                    const variation = item.product.product_variations[variationKeys[0]]
                    itemToAdd.name += ' - '
                    itemToAdd.name += variation.attributes.map(attr => attr.option).join(', ')
                    variation.attributes.forEach(attr =>
                      itemToAdd.meta_data.push({
                        key: `pa_${attr.name.toLowerCase()}`,
                        value: attr.option.toLowerCase(),
                      })
                    )
                  }

                  if (newOrders[orderId]) {
                    // add product price for new orders
                    const quantityPrice = Number(data.items.prices[addId]) * quantity
                    subtotal += quantityPrice
                    total += quantityPrice
                  }

                  if (itemBeingRemoved) {
                    // add removed item price
                    subtotal += Number(itemBeingRemoved.subtotal)
                    total += Number(itemBeingRemoved.total)
                  }

                  if (newOrders[orderId] && dataToUpdate[orderId].order.discount_total) {
                    // subtract discount
                    const sub = Math.min(subtotal, dataToUpdate[orderId].order.discount_total)
                    subtotal -= sub
                    total -= sub
                    dataToUpdate[orderId].order.discount_total -= sub
                    if (dataToUpdate[orderId].order.discount_total === 0)
                      delete dataToUpdate[orderId].order.discount_total
                  }

                  // format subtotal/total
                  itemToAdd.subtotal = subtotal.toFixed(2).toString()
                  itemToAdd.total = total.toFixed(2).toString()
                }

                return { itemToAdd }
              }

              // unless it's a new order, get order to get line items
              const order = !newOrders[orderId]
                ? await wcapi.getOrder(orderInfo)
                : { line_items: [] }
              // set to current order line items
              dataToUpdate[orderId].order.line_items = JSON.parse(JSON.stringify(order.line_items)) // deep copy (shallow copy may be enough)
              dataToUpdate[orderId].order.line_items ||
                (dataToUpdate[orderId].order.line_items = [])
              // process items to remove first
              Object.keys(remove)
                .map(removeId => Number(removeId))
                .forEach(removeId => {
                  const quantity = remove[removeId]
                  const itemsToRemove = dataToUpdate[orderId].order.line_items.filter(item =>
                    helpers.lineItemMatchProductOrVariation(item, removeId)
                  )

                  // check that the item selected has the corresponding quantity
                  let itemToRemove
                  for (let i = 0; i < itemsToRemove.length; i += 1) {
                    if (itemsToRemove[i].quantity >= quantity) {
                      itemToRemove = itemsToRemove[i]
                      break
                    }
                  }
                  if (!itemToRemove) {
                    throw new Error(
                      `Line item product/variation ID to remove not found in existing line items ${quantity} x ${removeId}`
                    )
                  }

                  // log('itemToRemove', itemToRemove)
                  itemToRemove.quantity -= quantity

                  // if we are only changing quantity, the item subtotal/total will still be the same and we are done
                  // otherwise we reassign to subtotal/total to added/remaining items (if any)
                  if (itemToRemove.quantity === 0) {
                    if (Object.keys(add).length) {
                      // replace removed item by added item and give the new item the subtotal/total to keep the total the same
                      const addId = Number(Object.keys(add)[0])
                      const { itemToAdd, err } = getItemToAdd(addId, add[addId], itemToRemove)
                      if (err) throw new Error(err)
                      delete add[addId] // remove key from object
                      dataToUpdate[orderId].order.line_items.push(itemToAdd) // add new line item to order
                    } else {
                      // if we are not adding another item, we need to put any subtotal/total into another item to keep the total the same
                      const itemsNotBeingRemoved = Object.keys(remove)
                        .map(rId => Number(rId))
                        .reduce(
                          (acc, rId) =>
                            acc.filter(item => !helpers.lineItemMatchProductOrVariation(item, rId)), // eslint-disable-line no-param-reassign
                          dataToUpdate[orderId].order.line_items
                        )

                      if (itemsNotBeingRemoved.length) {
                        const subtotal =
                          Number(itemsNotBeingRemoved[0].subtotal) + Number(itemToRemove.subtotal)
                        const total =
                          Number(itemsNotBeingRemoved[0].total) + Number(itemToRemove.total)
                        itemsNotBeingRemoved[0].subtotal = subtotal.toFixed(2).toString()
                        itemsNotBeingRemoved[0].total = total.toFixed(2).toString()
                      }
                    }

                    // finally we mark the item for removal
                    itemToRemove.product_id = null
                  }
                })
              // next process items to add (if any are remaining)
              Object.keys(add)
                .map(addId => Number(addId))
                .forEach(addId => {
                  const { itemToAdd, err } = getItemToAdd(addId, add[addId])
                  if (err) throw new Error(err)
                  dataToUpdate[orderId].order.line_items.push(itemToAdd) // add new line item to order
                })
            }
          } catch (err) {
            error(err)
            throw new Error(err)
          }
        })
      )

      // For checkins & order_extra: we make the change locally first, then we enqueue the change to send it to the server
      // For others (refunds, order status change...): we send the request to the server, then refresh the registrant info
      if (hasCheckinsUpdate || hasOrderExtraUpdate) {
        await defaultExports.dbUpdateRegistrant(registrantId, registrants[registrantId], orderIds)
        await defaultExports.updateRegistrantSendMsg(registrantInfo)
      }

      return Promise.all(
        orderIds.map(async orderId => {
          try {
            // log('update order id =', orderId)
            const orderInfo = { id: orderId }

            return Promise.all(
              Object.keys(dataToUpdate[orderId]).map(async key => {
                try {
                  if (key === 'refund') {
                    const { refund } = dataToUpdate[orderId]
                    const resp = await defaultExports.updateRefund(orderInfo, refund)
                    // refetch order using orderId, this will update the local data and send updated data to the client
                    await defaultExports.refreshRegistrants(regInfo, orderInfo)
                    return wcapi.handleErrorResponse('updateRefund', resp, refund)
                  }

                  if (key === 'credit') {
                    const { credit } = dataToUpdate[orderId]
                    if (credit) {
                      const resp = await wcapi.createCoupon(credit)
                      return wcapi.handleErrorResponse('createCoupon', resp, credit)
                    }
                    return Promise.resolve()
                  }

                  if (key === 'order') {
                    // log(orders[orderId]['checkins'])
                    const { order } = dataToUpdate[orderId]

                    // checkins or order_extra only
                    if (
                      helpers.objHasKey(order, ['checkins', 'order_extra']) &&
                      Object.keys(order).length === 1
                    ) {
                      const filterByItems = registrantInfo.query
                        ? registrantInfo.query.filterByItems
                        : undefined
                      return enqueue.enqueue({
                        cmd: 'updateOrder',
                        data: {
                          registrantId,
                          orderId,
                          filterByItems,
                          dataToUpdate: order,
                        },
                      })
                    }

                    // all other order updates
                    // order note uses a different endpoint
                    let resp
                    if (order.note) {
                      resp = await defaultExports.updateOrderNote(orderInfo, order.note)
                    } else if (newOrders[orderId]) {
                      log('createOrder', order)
                      resp = await wcapi.createOrder(order)
                      try {
                        await wcapi.handleErrorResponse('createOrder', resp, order)
                        // get orderId from resp
                        log('created order', resp.body)
                        const newOrder = JSON.parse(resp.body)
                        orderInfo.id = newOrder.id
                        // check if we have a customer id
                        if (newOrder.customer_id) regInfo.id = newOrder.customer_id
                      } catch (err) {
                        error(err, resp.body) // the error will be caught below
                      }
                    } else {
                      resp = await wcapi.updateOrder(orderInfo, order)
                    }

                    if (orderInfo.id !== 999999) {
                      // refetch order using orderId, this will update the local data and send updated data to the client
                      await defaultExports.refreshRegistrants(regInfo, orderInfo)
                    }

                    return wcapi.handleErrorResponse(
                      newOrders[orderId] ? 'createOrder' : 'updateOrder',
                      resp,
                      order
                    )
                  }

                  return Promise.reject(new Error(`Unknown dataToUpdate key: ${key}`))
                } catch (err) {
                  error(err)
                  throw new Error(err)
                }
              })
            )
          } catch (err) {
            error(err)
            throw new Error(err)
          }
        })
      )
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  updateOrderNote: async (orderInfo, note) => {
    try {
      log('updateOrderNote', orderInfo, note)

      if (note.note) {
        return wcapi.createOrderNote(orderInfo, note)
      }
      if (note.id) {
        return wcapi.deleteOrderNote(orderInfo, note)
      }

      return Promise.resolve()
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  updateRefund: async (orderInfo, refund) => {
    try {
      log('updateRefund', orderInfo, refund)

      if (refund.amount) {
        return wcapi.createRefund(orderInfo, refund)
      }
      if (refund.id) {
        return wcapi.deleteRefund(orderInfo, refund)
      }

      return Promise.resolve()
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  updateRegistrantSendMsg: async registrantInfoArg => {
    try {
      const registrantInfo = helpers.objValMayBeNumber(registrantInfoArg, 'id', {
        toLowerCase: true,
      })

      if (registrantInfo.sendMsg === false) {
        info('Not sending update registrant message as it has not changed', registrantInfo.id)
        return Promise.resolve()
      }

      if (!helpers.objHasKey(registrantInfo, 'id')) {
        return Promise.reject(new Error('registrant id undefined'))
      }

      const reg = await defaultExports.getRegistrants(registrantInfo)
      if (!reg) {
        return Promise.reject(new Error('registrant id not part of registrants', registrantInfo.id))
      }

      return websocket.sendMsg({
        reqId: 'server',
        cmd: 'update registrant',
        data: { id: registrantInfo.id, reg },
      })
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  deleteRegistrantOrder: async (registrantId, registrantEmail, orderId) => {
    // let hasOtherOrders = false
    Object.keys(registrants[registrantId]).forEach(key => {
      if (helpers.objHasKey(registrants[registrantId][key], orderId)) {
        delete registrants[registrantId][key][orderId]
      }
      // if (Object.keys(registrants[registrantId][key]).length) {
      //   hasOtherOrders = true
      // }
    })

    const re = new RegExp(`^${orderId}-`)
    Object.keys(registrants[registrantId].items || {}).forEach(itemId => {
      if (itemId.match(re)) delete registrants[registrantId].items[itemId]
    })

    await db.redisDbClient.hsetAsync(
      'registrants',
      registrantId,
      JSON.stringify(registrants[registrantId])
    )

    // log('registrants[registrantId] items', registrants[registrantId].items)

    if (helpers.objHasKey(orderBillingInfo, orderId)) {
      delete orderBillingInfo[orderId]
      await db.redisDbClient.hdelAsync('orderBillingInfo', orderId)
    }
    // log('registrantsByEmail[registrantEmail]', registrantEmail, registrantsByEmail[registrantEmail])
    if (registrantEmail && registrantsByEmail[registrantEmail]) {
      if (
        helpers.objHasKey(registrantsByEmail[registrantEmail], 'orderIds') &&
        helpers.objHasKey(registrantsByEmail[registrantEmail].orderIds, orderId)
      ) {
        delete registrantsByEmail[registrantEmail].orderIds[orderId]
      }
      await db.redisDbClient.hsetAsync(
        'registrantsByEmail',
        registrantEmail,
        JSON.stringify(registrantsByEmail[registrantEmail])
      )
    }

    // This would disrupt the front-end app
    // if (!hasOtherOrders) {
    //   delete registrants[registrantId]
    //   delete registrantsByEmail[registrantEmail]
    //   await Promise.all([
    //     db.redisDbClient.hdelAsync('registrants', registrantId),
    //     db.redisDbClient.hdelAsync('registrantsByEmail', registrantEmail),
    //   ])
    // }
  },
}

export default defaultExports
