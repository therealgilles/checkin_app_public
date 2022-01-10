// dbItems.mjs
//
// Functions to access items
//

import he from 'html-entities'
import debug from 'debug'
import striptags from 'striptags'
import config from '../config'
import tecapi from '../api/tecapi'
import wcapi from '../api/wcapi'
import helpers from '../helpers/helpers'
import websocket from '../websocket/websocket'
import db from './db'

config.debug && debug.enable('dbItems:*')
const log = debug('dbItems:log')
const info = debug('dbItems:info')
const error = debug('dbItems:error')

const slugOfEventItem = {}
const slugOfProductItem = {}
const items = {} // can be a class, a dance pass, a t-shirt...

const defaultExports = {
  slugOfEventItem,
  slugOfProductItem,
  items,

  dbResetItems: async () => {
    try {
      log('Resetting all items')
      return Promise.all(
        ['items', 'slugOfEventItem', 'slugOfProductItem'].map(async objName => {
          await helpers.emptyRedisObject(db, defaultExports[objName], objName)
        })
      )
    } catch (err) {
      throw new Error(err)
    }
  },
  dbUpdateSlugOfEventItem: (eventId, slug) =>
    db.redisDbClient.hsetAsync('slugOfEventItem', eventId, slug),
  dbUpdateSlugOfProductItem: (pids, slug) =>
    Promise.all(pids.map(pid => db.redisDbClient.hsetAsync('slugOfProductItem', pid, slug))),
  dbUpdateItem: (itemId, updatedItem) =>
    db.redisDbClient.hsetAsync('items', itemId, JSON.stringify(updatedItem)),

  refreshItemsMemoized: null,
  refreshItemsCore: async (eventInfo = {}, productInfo = {}) => {
    try {
      log('Starting refreshItems', eventInfo, productInfo)
      const hasEvents = Object.prototype.hasOwnProperty.call(eventInfo, 'hasEvents')
        ? eventInfo.hasEvents
        : config.hasEvents

      // get events from tecapi if config.hasEvents
      await websocket.sendMsg({
        reqId: eventInfo.query ? eventInfo.query.reqId : undefined,
        cmd: eventInfo.id || productInfo.id ? 'updating item' : 'updating items',
        data: { eventInfo, productInfo },
      })

      // no reset when we have a specified event ID or product ID
      if (!(helpers.objHasKey(eventInfo, 'id') || helpers.objHasKey(productInfo, 'id'))) {
        await defaultExports.dbResetItems()
      }

      let status = 'not updated'
      if (hasEvents) {
        const events = await tecapi.getEvents(eventInfo)
        if (
          eventInfo.query &&
          eventInfo.query.reqId &&
          websocket.isCancelledRequestId(eventInfo.query.reqId)
        ) {
          info('Not updating items from events because request was cancelled')
          status += ', request cancelled' // do not update items if the request was cancelled
        } else {
          if (!events) {
            throw new Error(`tecapi.getEvents(${eventInfo}) did not return any events`)
          }
          status = 'updated'
          await Promise.all(
            events.map(e => {
              const slugStartDate = e.start_date.replace(/\s+.*$/, '') // remove time
              const slug = helpers.getSlug(e.title, e.regular_categories, slugStartDate)
              log('refreshItems event slug =', slug)
              items[slug] || (items[slug] = {})
              items[slug].slug = slug
              items[slug].event = {
                id: e.id,
                title: striptags(he.decode(e.title)),
                slug: e.slug,
                start_date: e.start_date,
                end_date: e.end_date,
                week_number: e.series_week_number || e.week_number,
                // add week number and start date for dance party events
                week_numbers: e.series_week_numbers || [e.week_number],
                start_dates: e.series_start_dates || [e.start_date],
                categories: e.regular_categories,
                custom_fields: e.custom_fields,
                description: e.description,
              }
              // log('series_week_number', e.series_week_number)
              slugOfEventItem[e.id] = slug
              return Promise.all([
                defaultExports.dbUpdateSlugOfEventItem(e.id, slug),
                defaultExports.dbUpdateItem(slug, items[slug]),
              ])
            })
          )
        }
      }

      // refresh products (request cancellation handled in refreshProducts)
      const refreshProductsStatus = await defaultExports.refreshProducts(eventInfo, productInfo)
      if (!hasEvents) status = refreshProductsStatus

      const sfx = (!hasEvents || eventInfo.id) && productInfo.id ? '' : 's'
      return await websocket.sendMsg({
        reqId: 'server', // eventInfo.query ? eventInfo.query.reqId : undefined,
        cmd: `item${sfx} ${status}`,
        data: { eventInfo, productInfo },
      })
    } catch (err) {
      throw new Error(err)
    }
  },
  refreshItems: async (eventInfo = {}, productInfo = {}, { keyCheck = false } = {}) => {
    try {
      if (!defaultExports.refreshItemsMemoized) {
        defaultExports.refreshItemsMemoized = helpers.asyncMemoizeUntilDone(
          defaultExports.refreshItemsCore
        )
      }

      const key = `${eventInfo.id ? `${eventInfo.id}-` : ''}${productInfo.id}`
      return defaultExports.refreshItemsMemoized({ key, keyCheck }, eventInfo, productInfo)
    } catch (err) {
      throw new Error(err)
    }
  },

  refreshProductsMemoized: null,
  refreshProductsCore: async (eventInfo = {}, productInfoArg = {}) => {
    try {
      log('Starting refreshProducts', eventInfo, productInfoArg)

      const productInfo = JSON.parse(JSON.stringify(productInfoArg)) // deep copy

      // don't update products if we don't have events and a product ID is not specified
      const hasEvents = Object.prototype.hasOwnProperty.call(eventInfo, 'hasEvents')
        ? eventInfo.hasEvents
        : config.hasEvents
      if (!hasEvents && !helpers.objHasKey(productInfo, 'id')) {
        return 'updated'
      }

      // if id is not specified and we have event items, add array of item/event slugs to the query
      if (hasEvents && !helpers.objHasKey(productInfo, 'id') && Object.keys(items).length) {
        // log('items', items)
        const slugs = []
        Object.keys(items).forEach(slug => {
          if (items[slug].event) {
            slugs.push(slug)

            // use event slug too if it does not match the computed item slug
            if (items[slug].event.slug !== slug) {
              slugs.push(items[slug].event.slug)
            }
          }
        })
        if (config.products && config.products.always_load_slugs) {
          // add slugs we always want to load
          config.products.always_load_slugs.forEach(slug => slugs.push(slug))
        }
        if (slugs.length) {
          // log(`refreshProducts item slugs: ${slugs}`)
          productInfo.query_slugs = slugs
        }

        // make sure query is html-safe
        productInfo.query_slugs = helpers.queryHtmlSafe(productInfo.query_slugs)
      }

      productInfo.query || (productInfo.query = {})

      // We do not specific a time range for products by default.
      // Missed products will be gathered when encountered in orders.
      productInfo.query.after || (productInfo.query.after = 'none')
      productInfo.query.before || (productInfo.query.before = 'none')

      // get products from wcapi for all user types
      const products = {}
      await Promise.all(
        Object.keys(config.wcapi_users).map(async userRole => {
          try {
            products[userRole] = await wcapi.getProducts({ ...productInfo, userRole })
            return Promise.resolve()
          } catch (err) {
            error(err)
            throw new Error(err)
          }
        })
      )

      let savedProductItemSlug
      let status = 'not updated'
      if (
        eventInfo.query &&
        eventInfo.query.reqId &&
        websocket.isCancelledRequestId(eventInfo.query.reqId)
      ) {
        info('Not updating items from products because request was cancelled')
        status += ', request cancelled' // do not update items if the request was cancelled
      } else {
        if (!products) {
          throw new Error(`wcapi.getProducts(${productInfo}) did not return any products`)
        }
        status = 'updated'
        await Promise.all(
          products.default.map(async product => {
            try {
              const slugCategories = product.categories.map(category => category.slug)
              const slugRoot = config.products.use_product_name_as_slug
                ? product.name
                : product.slug
              const slug = helpers.getSlug(slugRoot, slugCategories)
              savedProductItemSlug = slug
              const pids = []
              log('refreshProducts product slug =', slug, '/ id =', product.id)
              items[slug] || (items[slug] = {})
              items[slug].slug = slug
              items[slug].product = {
                id: product.id,
                name: striptags(he.decode(product.name)),
                slug: product.slug,
                event_slug: product.event_slug || '',
                type: product.type,
                status: product.status,
                price: product.price,
                // store the price for all user types
                prices: Object.keys(products).reduce((acc, role) => {
                  acc[role] = `${helpers.getObjFromArrayById(product.id, products[role]).price}`
                  return acc
                }, {}),
                image: helpers.productImageUrl(product.images),
                variations: product.variations || [], // array of variation IDs, empty for solo classes
                attributes: product.attributes, // [{"id":1,"name":"Role",...,"options":["Solo"]}]
                sold_individually: product.sold_individually,
              }
              // log('refreshProducts product =', items[slug].product)
              // log('slugOfProductItem add', product.id)
              slugOfProductItem[product.id] = slug
              pids.push(product.id)

              // process product variations
              if (product.variations && product.variations.length !== 0) {
                log('... product variations', slug, product.variations)
                items[slug].product.product_variations = {} // reset object

                const pVariations = {}
                await Promise.all(
                  Object.keys(config.wcapi_users).map(async userRole => {
                    try {
                      pVariations[userRole] = await wcapi.getProductVariations({
                        id: product.id,
                        variations: productInfo.variations,
                        userRole,
                      })
                      return Promise.resolve()
                    } catch (err) {
                      error(err)
                      throw new Error(err)
                    }
                  })
                )

                pVariations.default.forEach(pVariationArg => {
                  const pVariation = helpers.objValMayBeNumber(pVariationArg, 'id', {
                    isNumber: true,
                  })
                  if (!helpers.itemMatchProductOrVariation(items[slug], pVariation.id)) {
                    throw new Error(
                      'pVariation ID not found in variations',
                      items[slug].product.variations
                    )
                  }
                  slugOfProductItem[pVariation.id] = slug
                  // log('slugOfProductItem add', pVariation.id)
                  pids.push(pVariation.id)
                  items[slug].product.product_variations[pVariation.id] = {
                    // id: pVariation.id,
                    // slug: pVariation.slug,
                    type: pVariation.type, // probably always 'variation'
                    status: pVariation.status,
                    price: pVariation.price,
                    prices: Object.keys(pVariations).reduce((acc, role) => {
                      acc[role] = `${
                        helpers.getObjFromArrayById(pVariation.id, pVariations[role]).price
                      }`
                      return acc
                    }, {}),
                    attributes: pVariation.attributes, // [{"id":1,"name":"Role","option":"Follower"}]
                    name: striptags(
                      he.decode(
                        `${items[slug].product.name} - ${pVariation.attributes
                          .map(a => a.option)
                          .join(', ')}`
                      )
                    ),
                  }
                })

                // log('refreshProducts product variations =', items[slug].product.product_variations)
              }

              log('... updating redis entry for item', slug, '/ IDs =', pids)
              return Promise.all([
                defaultExports.dbUpdateSlugOfProductItem(pids, slug),
                defaultExports.dbUpdateItem(slug, items[slug]),
              ])
            } catch (err) {
              error(err)
              throw new Error(err)
            }
          })
        )
      }

      if (productInfo.sendMsg) {
        // send updated item to client
        await defaultExports.updateItemSendMsg({ id: savedProductItemSlug })
      }
      return status
    } catch (err) {
      throw new Error(err)
    }
  },
  refreshProducts: async (eventInfo = {}, productInfo = {}, { keyCheck = false } = {}) => {
    try {
      if (!defaultExports.refreshProductsMemoized) {
        defaultExports.refreshProductsMemoized = helpers.asyncMemoizeUntilDone(
          defaultExports.refreshProductsCore
        )
      }

      return defaultExports.refreshProductsMemoized(
        { key: productInfo.id, keyCheck },
        eventInfo,
        productInfo
      )
    } catch (err) {
      throw new Error(err)
    }
  },

  getItems: async (itemInfo = {}) => {
    try {
      log('getItems', itemInfo)
      return itemInfo.id ? items[itemInfo.id] : items
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  updateItemSendMsg: async itemInfo => {
    try {
      const item = await defaultExports.getItems(itemInfo)
      return websocket.sendMsg({
        reqId: 'server',
        cmd: 'update item',
        data: { id: itemInfo.id, item },
      })
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  // checkins custom field { key1: value1, key2: value2 }
  //   key identifies order ID, item, item variant (if any), item event date/time (if any), event series week number (if any)
  //     slug  = slugOfProductItem[item.variation_id || item.product_id]
  //     key   = '#' + orderId + ' ' + slug + ' ' + variant + ' ' + items[slug][start_date] + ' week' + series week number
  //     // example: '#8195 december-2016-level-1-class-series leader 2016-12-14 20:15:00 week2'
  //   value records check-in date/time
  //     value = <check-in date/time YYYY-MM-DD HH:MM:SS>
  //     // example: '2016-12-14 20:04:45'
  getCheckinKey: async (orderId, productId, variationId, registrantInfo) => {
    try {
      // Request item is missing
      if (!slugOfProductItem[variationId || productId]) {
        await defaultExports.refreshItems(
          { query: registrantInfo.query, hasEvents: false },
          { id: productId, sendMsg: true }
        )
      } else {
        // wait for item update to be done
        await defaultExports.refreshItems(
          { query: registrantInfo.query, hasEvents: false },
          { id: productId, sendMsg: true },
          { keyCheck: true }
        )
      }

      const slug = slugOfProductItem[variationId || productId]

      if (!helpers.objHasKey(items, slug)) {
        error('checkin key is undefined', orderId, productId, variationId, slug)
        error('slugOfProductItem =', slugOfProductItem)
        return undefined
      }

      let keyPrefix = `#${orderId} ${slug}`

      // try slug without role suffix if we cannot find a corresponding event
      const itemEventSlug = items[slug].event ? slug : slug.replace(/-(follower|leader|solo)/, '')
      // log('getCheckinKey itemEventSlug', itemEventSlug)

      const evt = items[itemEventSlug]?.event
      const variant = helpers.getProductVariants(items[slug].product, variationId).join('-')
      variant && (keyPrefix += ` ${variant}`)
      if (!evt) {
        // log('checkin key prefix', keyPrefix)
        return { single: keyPrefix, all: keyPrefix }
      }

      const checkinKeys = {}
      ;['single', 'all'].forEach(type => {
        const startDates = type === 'all' ? evt.start_dates : [evt.start_date]
        const weekNumbers = type === 'all' ? evt.week_numbers : [evt.week_number]
        const keys = startDates.map(
          (startDate, idx) => `${keyPrefix} ${startDate} week${weekNumbers[idx]}`
        )
        checkinKeys[type] = type === 'all' ? keys : keys[0]
      })

      return checkinKeys
    } catch (err) {
      throw new Error(err)
    }
  },
}

export default defaultExports
