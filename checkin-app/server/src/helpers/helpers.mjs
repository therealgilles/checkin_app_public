// helpers.mjs
//
// Helper functions
//

import debug from 'debug'
import he from 'html-entities'
import striptags from 'striptags'
import config from '../config'

config.debug && debug.enable('helpers:*')
// const log = debug('helpers:log')
const info = debug('helpers:info')
const error = debug('helpers:error')

const redisDone = {
  db: false,
  dequeue: false,
  enqueue: false,
}
let serverStarted = false
let initDone = false

const defaultExports = {
  // massage slug for events and products
  getSlug: (name, categories = [], startDate) => {
    let slug = striptags(he.decode(name.toLowerCase())) // decode html, remove html tags
    slug = slug
      .replace(/(series|drop-?in class|DJ Dance|Live Music).*$/i, '$1')
      .replace(/[–]+/g, '-')
    slug = slug
      .replace(/^.*(DJ Dance).*$/i, 'DJ Dance Party')
      .replace(/^.*(Live Music).*/i, 'Live Music Dance Party')
    slug = slug.replace(/\s*\([^)]*\)/, '') // remove everything inside parenthesis
    slug = slug.replace(/[()]/g, '') // remove extra parenthesis
    // log('categories', categories)
    if (categories.includes('dj-dance') && !slug.match(/DJ Dance Party/i)) {
      slug = 'DJ Dance Party'
    }
    if (categories.includes('live-music') && !slug.match(/Live Music Dance Party/i)) {
      slug = 'Live Music Dance Party'
    }
    if (slug.match(/drop-?in class|(DJ|Live Music) Dance Party/i) && startDate) {
      slug += ` ${startDate}` // add start date for drop-in class, DJ Dance Party, or Live Music Dance Party
    }
    slug = slug.replace(/\s+/g, '-').replace(/[-]+/g, '-').toLowerCase()
    return slug
  },

  queryHtmlSafe: obj => {
    let safeObj

    if (Array.isArray(obj)) {
      safeObj = []
      obj.forEach((val, idx) => {
        safeObj[idx] = defaultExports.queryHtmlSafe(val)
      })
    } else if (typeof obj === 'object') {
      safeObj = {}
      Object.entries(obj).forEach(([subkey, val]) => {
        safeObj[subkey] = defaultExports.queryHtmlSafe(val)
      })
    } else {
      safeObj = he.encode(obj)
    }

    return safeObj
  },

  getProductVariants: (product, variationId) => {
    const variants = []
    if (variationId) {
      // variable product
      const attributes = product.product_variations[variationId].attributes
      attributes.forEach(attr => {
        if (attr.name.match(/role|size|style/i)) {
          variants.push(attr.option.toLowerCase())
        }
      })
    } else if (product.attributes) {
      // simple product
      product.attributes.forEach(attr => {
        if (attr.name.match(/role|size|style/i)) {
          variants.push(attr.options[0].toLowerCase())
        }
      })
    }
    return variants
  },

  arrayFlatten: arr =>
    arr.reduce(
      (acc, val) => acc.concat(Array.isArray(val) ? defaultExports.arrayFlatten(val) : val),
      []
    ),

  emptyObject: obj =>
    Object.keys(obj).forEach(key => {
      delete obj[key] // eslint-disable-line no-param-reassign
    }),

  getValidProductsById: items => {
    const validProductsById = {}
    Object.keys(items).forEach(itemKey => {
      // if we do not have event, select items with product
      // otherwise select items with product and either event or product event slug corresponding to valid item with event
      const productEventSlug = items[itemKey].product
        ? items[itemKey].product.event_slug
        : undefined
      if (
        items[itemKey].product &&
        (!config.hasEvents ||
          items[itemKey].event ||
          (items[productEventSlug] && items[productEventSlug].event))
      ) {
        validProductsById[items[itemKey].product.id] = 1
      }
    })
    return validProductsById
  },

  registrantsWithValidItems: (reg, validProductsById) => {
    const items = reg.items
    for (const key of items) {
      if (validProductsById[items[key].item_product_id]) return true
    }
    return false
  },

  serialize: (queryObj, prefix = '', safeEncode = false) => {
    if (queryObj) {
      const encode = x => (safeEncode ? encodeURIComponent(x) : x)
      const queryString = Object.keys(queryObj)
        .map(k => `${encode(k)}=${encode(queryObj[k])}`)
        .join('&')
      return queryString ? `${prefix}${queryString}` : ''
    }
    return ''
  },

  getFilteredRegistrant: (regId, registrants, filterByItems = 'false', validProductsById = {}) => {
    if (!defaultExports.objHasKey(registrants, regId)) {
      return undefined
    }

    if (typeof filterByItems === 'boolean') {
      const err = `getFilteredRegistrant: filterByItems is a boolean = ${
        filterByItems ? 'true' : 'false'
      }`
      throw err
    }

    if (filterByItems !== 'true') {
      return registrants[regId]
    }

    const reg = JSON.parse(JSON.stringify(registrants[regId])) // deep copy

    // get valid order IDs
    const validOrderIds = {}
    Object.keys(reg.items).forEach(itemKey => {
      const item = reg.items[itemKey]
      if (defaultExports.objHasKey(validProductsById, item.item_product_id)) {
        // log('validOrderIds', item.id)
        validOrderIds[item.id] = 1
        item.valid_product = 1 // FIXME: is it a good idea to modify line items here?
      }
    })

    // remove items from non-valid orders
    Object.keys(reg.items).forEach(itemKey => {
      const orderId = reg.items[itemKey].id
      if (!defaultExports.objHasKey(validOrderIds, orderId)) {
        // if (!(orderId in validOrderIds)) {
        // log('delete reg.items', itemKey)
        delete reg.items[itemKey]
      }
    })

    // remove data related to non-valid orders
    if (reg.total) {
      Object.keys(reg.total).forEach(orderId => {
        if (!defaultExports.objHasKey(validOrderIds, orderId)) {
          // if (!(orderId in validOrderIds)) {
          delete reg.total[orderId]
          delete reg.date_paid[orderId]
          delete reg.order_notes[orderId]
          delete reg.customer_note[orderId]
        }
      })
    }

    reg.valid_orders = Object.keys(validOrderIds) // FIXME: is it a good idea to modify reg here?

    if (Object.keys(reg.items).length) {
      return reg
    }

    return undefined
  },

  nameCapitalize: name =>
    name
      .split(' ')
      .map(word => {
        if (word.match(/^(de|von)$/i)) return word.toLowerCase()
        if (word.toUpperCase() === word || word.toLowerCase() === word) {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        }
        return word
      })
      .join(' '),

  redisRestoreObj: (result, hash) => {
    if (result) {
      Object.keys(result).forEach(key => {
        hash[key] = result[key] // eslint-disable-line no-param-reassign
      })
    }
  },

  redisRestoreHash: (result, hash, { merge, override } = {}) => {
    if (result) {
      const savedHash = JSON.parse(JSON.stringify(hash))

      Object.keys(result).forEach(key => {
        try {
          hash[key] = JSON.parse(result[key]) // eslint-disable-line no-param-reassign
        } catch (err) {
          // error(result[key], err)
        }
      })

      if (merge) {
        // merge settings that may not be in redis yet
        Object.keys(savedHash).forEach(key => {
          hash[key] || (hash[key] = savedHash[key]) // eslint-disable-line no-param-reassign
          Object.keys(savedHash[key]).forEach(subKey => {
            defaultExports.objHasKey(hash[key], subKey) ||
              (hash[key][subKey] = savedHash[key][subKey]) // eslint-disable-line no-param-reassign
          })
        })
      }

      if (override) {
        Object.keys(override).forEach(key => {
          Object.keys(override[key]).forEach(subKey => {
            hash[key][subKey] = override[key][subKey] // eslint-disable-line no-param-reassign
          })
        })
      }
    }
  },

  obscureEmail: email =>
    email ? email.replace(/^(.)[^@]*(.*)$/, '$1••••$2').toLowerCase() : undefined,

  objHasKey: (obj, key) =>
    (Array.isArray(key) ? key : [key]).reduce(
      (acc, k) =>
        acc ||
        Object.prototype.hasOwnProperty.call(obj, k) ||
        (typeof object === 'object' && k in obj && Object.getPrototypeOf(obj) === null),
      false
    ),

  bodyJSONParse: resp =>
    new Promise((resolve, reject) => {
      if (!resp) {
        reject(new Error('Missing response'))
        return
      }

      try {
        resolve(JSON.parse(resp.toJSON().body))
      } catch (err) {
        error(resp.toJSON().body)
        reject(new Error(err))
      }
    }),

  lineItemMatchProductOrVariation: (item, id) =>
    (item.product_id === id && item.variation_id === 0) || item.variation_id === id,

  itemMatchProductOrVariation: (item, id) =>
    item.product && (item.product.id === id || item.product.variations.indexOf(id) >= 0),

  objValMayBeNumber: (
    obj,
    key,
    { isNumber, deepCopy, toLowerCase } = { isNumber: false, deepCopy: false, toLowerCase: false }
  ) => {
    if (defaultExports.objHasKey(obj, key)) {
      const objCopy = deepCopy ? JSON.parse(JSON.stringify(obj)) : { ...obj }

      if (isNumber ? true : !isNaN(obj[key])) {
        objCopy[key] = Number(objCopy[key])
        return objCopy
      }

      if (toLowerCase && obj[key] !== obj[key].toLowerCase()) {
        objCopy[key] = objCopy[key].toLowerCase()
        return objCopy
      }
    }

    return obj // return unchanged object
  },

  setRedisDone: fn => {
    info(`Redis ${fn} is up.`)
    redisDone[fn] = true
  },

  isRedisDone: () => Object.values(redisDone).reduce((acc, val) => acc && val, true),

  setServerStarted: () => {
    info('Server is up.')
    serverStarted = true
  },

  setInitDone: () => {
    info('Init is done.')
    initDone = true
  },

  waitForRedisDone: () =>
    new Promise(resolve => {
      const wait = () => {
        if (defaultExports.isRedisDone()) resolve()
        else setTimeout(wait, 100) // wait for 100s if redisDone is not set
      }
      setTimeout(wait, 0) // wait till all modules have been loaded
    }),

  waitForServerStarted: () =>
    new Promise(resolve => {
      const wait = () => {
        if (serverStarted) resolve()
        else setTimeout(wait, 100) // wait for 100s if serverStarted is not set
      }
      setTimeout(wait, 0) // wait till all modules have been loaded
    }),

  waitForInitDone: () =>
    new Promise(resolve => {
      const wait = () => {
        if (initDone) resolve()
        else setTimeout(wait, 100) // wait for 100s if initDone is not set
      }
      setTimeout(wait, 0) // wait till all modules have been loaded
    }),

  generateCouponCode: () => {
    let code = ''
    const possible = 'abcdefghijklmnopqrstuvwxyz123456789'

    for (let i = 0; i < 13; i++) {
      code += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return code
  },

  generateItemMetaId: () => {
    let id = ''
    const possible = '123456789'

    for (let i = 0; i < 5; i++) {
      id += possible.charAt(Math.floor(Math.random() * possible.length))
    }

    return id
  },

  emptyRedisObject: async (db, obj, objName) => {
    try {
      await Promise.all(Object.keys(obj).map(async key => db.redisDbClient.hdelAsync(objName, key)))
      await db.redisDbClient.delAsync(objName)
      defaultExports.emptyObject(obj)
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getObjFromArrayById: (id, arr) => {
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i].id === id) return arr[i]
    }
    return {}
  },

  productImageUrl: images => {
    if (images && images.length) {
      let url = images[0].src
      // add site url prefix if url is a relative path
      if (url.match(/^\//)) url = `${config.url}${url}`
      return url
    }

    return ''
  },

  // SATS 2020: fix attributes for T-Shirt style
  itemAttrsNameFix: style => {
    if (style === 'Women') return 'Fitted Cut'
    if (style === 'Men') return 'Straight Cut'
    return style
  },

  fixItemName: name =>
    name.replace(
      /(T-Shirt - )(Women|Men)/i,
      (match, p1, p2) => p1 + defaultExports.itemAttrsNameFix(p2)
    ),

  fixItemAttrs: attrs =>
    attrs.map(attr => {
      // { id: 30464, key: 'style', value: 'Men' }
      if (attr.key === 'style')
        return { ...attr, value: defaultExports.itemAttrsNameFix(attr.value) }
      return attr
    }),

  // Memoize async function until it's done
  //   Concurrent calls to an ongoing function will be returned the function promise
  //   and therefore will wait till it's done but won't rerun it.
  //   We delete the cache key on done so that the function can be rerun.
  asyncMemoizeUntilDone: asyncFn => {
    const cache = {}

    return async ({ key: cacheKey, keyCheck }, ...args) => {
      try {
        const key = cacheKey || JSON.stringify(args)
        if (keyCheck && !(key in cache)) return false
        cache[key] = cache[key] || asyncFn(...args).finally(() => delete cache[key])
        return cache[key]
      } catch (err) {
        throw new Error(err)
      }
    }
  },
}

export default defaultExports
