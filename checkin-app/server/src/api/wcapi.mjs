// wcapi.mjs
//
// Functions accessing the woocommerce REST API
//

import debug from 'debug'
import he from 'html-entities'
import striptags from 'striptags'
import config from '../config'
import helpers from '../helpers/helpers'
import WooCommerceAPI from './WooCommerceAPIRetry'

config.debug && debug.enable('wcapi:*')
const log = debug('wcapi:log')
const info = debug('wcapi:info')
const error = debug('wcapi:error')

const WoocommerceAPIObj = Object.keys(config.wcapi_users).reduce((acc, role) => {
  acc[role] = new WooCommerceAPI({
    url: config.url,
    wpAPI: true,
    wpAPIPrefix: config.wcapi_path,
    version: config.wcapi_version,
    consumerKey: config.wcapi_users[role].consumerKey,
    consumerSecret: config.wcapi_users[role].consumerSecret,
    verifySsl: true,
    // if server does not parse Authorization header correctly
    // queryStringAuth: true // Force Basic Authentication as query string true and using under HTTPS
  })
  return acc
}, {})

const WooCommerce = wcinfo => WoocommerceAPIObj[(wcinfo && wcinfo.userRole) || 'default']

// get timestamp of specified order date, or the first day of the 2nd week of last month
const getTimestamp = orderDate => {
  const d = new Date()
  d.setDate(8) // make sure to skip the first Wednesday of the month
  d.setMonth(d.getMonth() - 5) // five months back (to get all summer/resolution swing registrants)
  return orderDate ? `${orderDate}T00:00:00.000Z` : d.toISOString()
}

const webhookPids = []
const dateBounds = ['before', 'after']

const asyncWrap = async (fn, pn = r => r) => {
  try {
    const res = await fn()
    return pn(res)
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}

const defaultExports = {
  createOrder: orderInfo => asyncWrap(() => WooCommerce(orderInfo).postAsync('orders', orderInfo)),
  createOrderNote: (orderInfo, note) =>
    asyncWrap(() => WooCommerce(orderInfo).postAsync(`orders/${orderInfo.id}/notes`, note)),
  deleteOrderNote: (orderInfo, note) =>
    asyncWrap(() =>
      WooCommerce(orderInfo).deleteAsync(`orders/${orderInfo.id}/notes/${note.id}?force=true`)
    ),
  updateOrder: (orderInfo, dataToUpdate) =>
    asyncWrap(() => WooCommerce(orderInfo).putAsync(`orders/${orderInfo.id}`, dataToUpdate)),
  deleteOrder: (orderInfo, force = 'false') =>
    asyncWrap(() => WooCommerce(orderInfo).deleteAsync(`orders/${orderInfo.id}?force=${force}`)),
  batchOrder: batchOrderInfo =>
    asyncWrap(() => WooCommerce(batchOrderInfo).postAsync('orders/batch', batchOrderInfo)),
  getOrder: orderInfo =>
    asyncWrap(
      () =>
        WooCommerce(orderInfo).getAsync(
          `orders/${orderInfo.id}${helpers.serialize(orderInfo.query, '?')}`
        ),
      resp => helpers.bodyJSONParse(resp)
    ),
  getOrders: async (orderInfo = {}) => {
    try {
      // log('wc-api getOrders')
      if (orderInfo.id) {
        // if order id is provided, return that single order as array
        const order = await defaultExports.getOrder(orderInfo)
        return [order]
      }

      // if query_products is provided, recursively call getOrders for each product ID
      if (orderInfo.query_products && orderInfo.query_products.length) {
        const ordersArray = await Promise.all(
          orderInfo.query_products.map(productId => {
            const orderInfoForProductId = JSON.parse(JSON.stringify(orderInfo)) // deep copy
            delete orderInfoForProductId.query_products
            orderInfoForProductId.query || (orderInfoForProductId.query = {})
            orderInfoForProductId.query.product = productId
            return defaultExports.getOrders(orderInfoForProductId)
          })
        )
        const orders = await helpers.arrayFlatten(ordersArray)
        // remove duplicates
        const uniqueOrders = {}
        orders.forEach(order => {
          uniqueOrders[order.id] = order
        })
        return Object.values(uniqueOrders)
      }

      const query = orderInfo.query ? JSON.parse(JSON.stringify(orderInfo.query)) : {} // deep copy
      query.per_page || (query.per_page = 100)
      dateBounds.forEach(bound => {
        if (query[bound] === 'none') {
          delete query[bound]
        } else {
          query[bound] = getTimestamp(query[bound])
        }
        if (query[bound]) log(`Orders ${bound} timestamp: ${query[bound]}`)
      })

      if (!query.status) query.status = (orderInfo.statuses || config.orders.statuses).join(',')
      log('order statuses', query.status.split(','))

      const orders = await defaultExports.getPaginated(orderInfo, 'orders', query)
      return orders
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  createRefund: (orderInfo, refundInfo) =>
    asyncWrap(() => WooCommerce(orderInfo).postAsync(`orders/${orderInfo.id}/refunds`, refundInfo)),
  getRefund: (orderInfo, refundInfo) =>
    asyncWrap(
      () => WooCommerce(orderInfo).getAsync(`orders/${orderInfo.id}/refunds/${refundInfo.id}`),
      resp => helpers.bodyJSONParse(resp)
    ),
  getRefunds: orderInfo =>
    asyncWrap(
      () => WooCommerce(orderInfo).getAsync(`orders/${orderInfo.id}/refunds`),
      resp => helpers.bodyJSONParse(resp)
    ),
  deleteRefund: (orderInfo, refundInfo) =>
    asyncWrap(() =>
      WooCommerce(orderInfo).deleteAsync(
        `orders/${orderInfo.id}/refunds/${refundInfo.id}?force=true`
      )
    ),

  createProduct: productInfo =>
    asyncWrap(() => WooCommerce(productInfo).postAsync('products', productInfo)),
  updateProduct: (productInfo, dataToUpdate) =>
    asyncWrap(() => WooCommerce(productInfo).putAsync(`products/${productInfo.id}`, dataToUpdate)),
  deleteProduct: (productInfo, force = 'false') =>
    asyncWrap(() =>
      WooCommerce(productInfo).deleteAsync(`products/${productInfo.id}?force=${force}`)
    ),
  batchProduct: batchProductInfo =>
    asyncWrap(() => WooCommerce(batchProductInfo).postAsync('products/batch', batchProductInfo)),
  getProduct: productInfo =>
    asyncWrap(
      () => WooCommerce(productInfo).getAsync(`products/${productInfo.id}`),
      resp => helpers.bodyJSONParse(resp)
    ),
  getProductVariations: async productInfo => {
    try {
      const query = productInfo.query ? JSON.parse(JSON.stringify(productInfo.query)) : {} // deep copy
      query.per_page || (query.per_page = 20)

      let variations = await defaultExports.getPaginated(
        productInfo,
        `products/${productInfo.id}/variations`,
        query
      )
      if (productInfo.variations) {
        variations = variations.filter(myVariation =>
          productInfo.variations.includes(myVariation.id)
        )
      }

      return variations
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },
  getProducts: async (productInfo = {}) => {
    try {
      if (productInfo.id) {
        // if product id is provided, return that single product as array
        const product = await defaultExports.getProduct(productInfo)
        return [product]
      }

      // if query_slugs is provided, recursively call getProducts for each slug
      if (productInfo.query_slugs && productInfo.query_slugs.length) {
        const productsArray = await Promise.all(
          productInfo.query_slugs.map(slug => {
            const productInfoForSlug = JSON.parse(JSON.stringify(productInfo)) // deep copy
            delete productInfoForSlug.query_slugs
            productInfoForSlug.query || (productInfoForSlug.query = {})
            productInfoForSlug.query.slug = slug
            return defaultExports.getProducts(productInfoForSlug)
          })
        )
        return helpers.arrayFlatten(productsArray)
      }

      const query = productInfo.query ? JSON.parse(JSON.stringify(productInfo.query)) : {} // deep copy
      query.per_page || (query.per_page = 20)
      dateBounds.forEach(bound => {
        if (query[bound] === 'none') {
          delete query[bound]
        } else {
          query[bound] = getTimestamp(query[bound])
        }
        if (query[bound]) log(`Products ${bound} timestamp: ${query[bound]}`)
      })
      // log('getProducts query', helpers.serialize(query))

      const products = await defaultExports.getPaginated(productInfo, 'products', query)
      return products
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getWebhook: async webhookInfo =>
    asyncWrap(
      () =>
        WooCommerce(webhookInfo).getAsync(
          `webhooks/${webhookInfo.id}${helpers.serialize(webhookInfo.query, '?')}`
        ),
      resp => helpers.bodyJSONParse(resp)
    ),
  getWebhooks: async (webhookInfo = {}) => {
    try {
      // log('wc-api getOrders')
      if (webhookInfo.id) {
        // if order id is provided, return that single order as array
        const webhook = await defaultExports.getWebhook(webhookInfo)
        return [webhook]
      }

      const query = webhookInfo.query ? JSON.parse(JSON.stringify(webhookInfo.query)) : {} // deep copy
      query.per_page || (query.per_page = 20)
      query.status = 'active'

      const webhooks = await defaultExports.getPaginated(webhookInfo, 'webhooks', query)
      return webhooks
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },
  createWebhook: webhookInfo =>
    asyncWrap(
      () => WooCommerce(webhookInfo).postAsync('webhooks', webhookInfo.data),
      resp => helpers.bodyJSONParse(resp)
    ),
  createWebhooks: batchWebhookInfo =>
    asyncWrap(
      () =>
        WooCommerce(batchWebhookInfo).postAsync('webhooks/batch', {
          create: batchWebhookInfo.data,
        }),
      resp => helpers.bodyJSONParse(resp).then(r => r.create)
    ),
  deleteWebhook: webhookInfo =>
    asyncWrap(() => WooCommerce(webhookInfo).deleteAsync(`webhooks/${webhookInfo.id}?force=true`)),
  deleteWebhooks: webhookInfo =>
    asyncWrap(() =>
      WooCommerce(webhookInfo).postAsync('webhooks/batch', { delete: webhookInfo.ids })
    ),
  updateWebhooks: webhookInfo =>
    asyncWrap(
      () => WooCommerce(webhookInfo).postAsync('webhooks/batch', webhookInfo.data),
      resp => helpers.bodyJSONParse(resp)
    ),

  createCoupon: couponInfo =>
    asyncWrap(
      () => WooCommerce(couponInfo).postAsync('coupons', couponInfo),
      resp => helpers.bodyJSONParse(resp)
    ),

  handleErrorResponse: (fn, resp, data) =>
    new Promise((resolve, reject) => {
      const status = resp.statusCode
      if (status >= 400) {
        let message
        try {
          ;({ message } = JSON.parse(resp.body))
        } catch (parseErr) {
          message = 'Unknown error '
        }
        const err = `${message}${status !== undefined ? ` [${status}]` : ''}`
        error(`${fn} REST WCAPI error`, err)
        reject(new Error(err))
      } else {
        // log(`${fn} REST WCAPI success`, data)
        resolve()
      }
    }),

  deleteWebhooksOnExit: async () => {
    try {
      const pids = []
      while (webhookPids.length) {
        pids.push(webhookPids.pop())
      }
      if (!pids.length) {
        return Promise.resolve()
      }

      info('... deleting created webhooks on process exit')
      return defaultExports.deleteWebhooks({ ids: pids })
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getPaginated: async (reqInfo, url, query) => {
    const resp = await WooCommerce(reqInfo).getAsync(`${url}?${helpers.serialize(query)}`)
    // statusCode: 401 - statusMessage: 'Unauthorized'
    // body: '{"code":"invalid_username","message":"Unknown username. Check again or try your email address.","data":{"status":401}}',
    const totalPages = resp.headers['x-wp-totalpages'] || 0
    log('url =', url, '/ reqInfo =', reqInfo, '/ query =', query)
    log(`... number of pages: ${totalPages}`)

    const pages = [helpers.bodyJSONParse(resp)] // add first response on first page
    for (let i = 2; i <= totalPages; i++) {
      // start on 2nd page
      pages.push(i)
      log('... batch', i)
    }

    const arrayPerPage = await Promise.all(
      pages.map(async (page, idx) => {
        if (idx === 0) return page
        const r = await WooCommerce(reqInfo).getAsync(
          `${url}?${helpers.serialize(Object.assign(query, { page }))}`
        )
        return helpers.bodyJSONParse(r)
      }) // eslint-disable-line function-paren-newline
    )

    return helpers.arrayFlatten(arrayPerPage)
  },
}

const setupWebhooks = async () => {
  try {
    await helpers.waitForInitDone()
    const webhooks = await defaultExports.getWebhooks()
    const re = new RegExp(config.host)
    const ids = webhooks.filter(webhook => webhook.delivery_url.match(re)).map(({ id }) => id)
    if (ids.length) {
      log('Delete existing webhooks...')
      log('... found webhooks to delete', ids)
      await defaultExports.deleteWebhooks({ ids })
    }

    if (config.production) {
      // create webhooks
      await config.webhook_types.forEach(async type => {
        const webhookPort = config.webhook_port ? `:${config.webhook_port}` : ''
        const webhookUrl = `https://${config.host}${webhookPort}/${config.webhook_api_path}/${type}`

        const respArray = await defaultExports.createWebhooks({
          data: ['created', 'updated'].map(action => ({
            name: `${helpers.nameCapitalize(type)} ${action}`,
            topic: `${type}.${action}`,
            delivery_url: webhookUrl,
            status: config.production ? 'active' : 'disabled',
          })),
        })
        respArray.forEach(resp => {
          // log('resp', resp)
          const { id } = resp
          log('webhook id', id)
          if (id !== undefined) {
            webhookPids.push(id)
          }
        })
      })
      log('webhooks created')
    }
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
setupWebhooks()

// For testing:
if (config.self_test) {
  const wcapiTesting = async () => {
    try {
      await helpers.waitForInitDone() // delay testing to make sure all modules are loaded

      // const req = await WooCommerce().getAsync('orders/1834?filter[meta]=true&meta=true')
      // const resp = JSON.parse(req.toJSON().body)
      // // log(resp.line_items[0])
      //
      // const products = await defaultExports.getProducts({ 'after': '2017-04-01' })
      // products.map(product => { log(`Product: ${product.name}`) })
      //
      // const productVariations = await defaultExports.getProductVariations({ 'id': '9987' })
      // productVariations.map(productVariation => { log(`Product variation: ${productVariation.name}`) })
      //
      // const orders = await defaultExports.getOrders({ 'after' : '2017-04-06' })
      // orders.map(order => { log(`Order id: ${order.id}`) })

      // Get orders which contain specific products (by product ID)
      const orders = await defaultExports.getOrders({
        query_products: [config.products.test_product],
        query: { after: 'none' },
      })
      log(`Number of orders found (without duplicates): ${orders.length}`)
      orders.forEach(order => {
        log(`Order id: ${order.id}`)
        order.line_items.forEach(item =>
          log(`... item name: ${striptags(he.decode(helpers.fixItemName(item.name)))}`)
        )
      })
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  }
  wcapiTesting()
}

export default defaultExports
