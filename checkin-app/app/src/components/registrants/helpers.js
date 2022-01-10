import debug from 'debug'
import React from 'react'
import { decode as heDecode } from 'html-entities'
import { isBirthdayThisMonth } from '../../metadata/helpers'
import { itemsSelected } from '../../refresh/helpers'
import { isCheckedIn } from '../../checkin/helpers'

debug.enable('registrants/helpers:*')
// const log = debug('registrants/helpers:log')
// const info = debug('registrants/helpers:info')
const error = debug('registrants/helpers:error')

// Registrant item keys whose order is not completed
// eslint-disable-next-line no-extend-native
Array.prototype.filterItemKeysByOrderStatus = function filterItemKeysByOrderStatus(
  regItems,
  status = ['completed']
) {
  return this.filter(key => status.indexOf(regItems[key].status) === -1)
}

export const nameCapitalize = name =>
  name
    .split(' ')
    .map(word => {
      if (word.match(/^(de|von)$/i)) return word.toLowerCase()
      if (word.toUpperCase() === word || word.toLowerCase() === word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
      return word
    })
    .map(word => word.replace(/^(mc|O')(.)/i, (s, m, l) => `${m}${l.toUpperCase()}`))
    .map(word => word.replace(/^(I+|IV|VI+|IX),?$/i, s => s.toUpperCase()))
    .join(' ')

export const getRegistrantNames = (reg, regItemKey) => {
  const names = []
  const keys = regItemKey ? [regItemKey] : Object.keys(reg.items)

  // log('getRegistrantNames', regItemKey)
  keys
    .map(key => reg.items[key])
    .forEach(item => {
      let candidate = nameCapitalize(`${item.lastname.trim()}, ${item.firstname.trim()}`)
      // log('candidate', candidate)
      if (!item.lastname) candidate = `<missing lastname>${candidate}`
      if (!item.firstname) candidate += '<missing firstname>'
      if (names.indexOf(candidate) === -1) names.push(candidate)
    })

  // make sure username appears first if defined
  if (reg.firstname && reg.lastname) {
    const username = nameCapitalize(`${reg.lastname.trim()}, ${reg.firstname.trim()}`)
    const index = names.indexOf(username)
    if (index > 0) {
      names.splice(index, 1)
      names.unshift(username)
    }
  }

  return names
}

const itemMetaDataSort = (a, b) => {
  if (!`${a.key} ${b.key}`.match(/track|placement|role/i)) return 0
  if (a.key.match(/track|placement/i)) return -1
  return 1
}

export const getRegistrantItemAttrs = (reg, regItemKey, filterAttrs) => {
  const itemMetaData = reg.items[regItemKey].item_meta_data
  const itemName = reg.items[regItemKey].item_name
  const attrs = {}
  // Order should be track|placement - role
  itemMetaData.sort(itemMetaDataSort).forEach(meta => {
    const matches = meta.key.replace(/^pa_/, '').match(/^(role|track|placement|days|size|style)$/)
    if (matches && (!filterAttrs || filterAttrs.indexOf(meta.key) !== -1)) {
      const key = matches[1]
      attrs[key] || (attrs[key] = [])
      if (!attrs[key].length) {
        attrs[key].push(meta.value.length <= 3 ? meta.value : nameCapitalize(meta.value))
      }
    }
  })
  if (attrs.track && attrs.track[0].match(/the.music.and.you/i)) {
    attrs.track[0] = 'The Music and You Track'
    delete attrs.placement
  }
  if (attrs.track && attrs.track[0].match(/beginner|newcomer/i)) {
    attrs.track[0] = 'Newcomers Track'
    delete attrs.placement
  }
  if (attrs.track && attrs.track[0].match(/leveled.tracks/i)) {
    delete attrs.track
    if (attrs.placement && attrs.placement[0].match(/M&Y/i))
      attrs.placement[0] = 'Incorrect Placement Track'
  }
  if (attrs.role && attrs.role[0].match(/any/i)) {
    delete attrs.role
  }
  if (!attrs.role && itemName.match(/SATS /)) return attrs
  if (!attrs.role && itemName.match(/class/i)) {
    // FIXME? how to identify solo classes
    attrs.role = ['Solo']
  }
  if (!attrs.role && itemName.match(/\((leader|follower|solo)\)/i)) {
    attrs.role = []
    attrs.role.push(nameCapitalize(itemName.replace(/^.*\((leader|follower|solo)\).*$/i, '$1')))
  }
  // log(attrs)

  return attrs
}

export const getRegistrantItemKeysByName = (regItems, reg, name) =>
  Object.keys(regItems).filter(key => name === getRegistrantNames(reg, key).toString())

export const getRegistrantRegItemsByName = (regItems, reg, name) =>
  getRegistrantItemKeysByName(regItems, reg, name).reduce((acc, key) => {
    acc[key] = regItems[key]
    return acc
  }, {})

export const getRegistrantCheckinsByName = (regCheckins, regItems, reg, name) =>
  getRegistrantItemKeysByName(regItems, reg, name).reduce((acc, key) => {
    // log('getRegistrantCheckinsByName', key, name)
    const checkinKey = regItems[key].checkin_key
    if (objHasKey(regCheckins, checkinKey)) {
      acc[checkinKey] = regCheckins[checkinKey]
    }
    return acc
  }, {})

export const getCheckinWeek = checkinKey => {
  const match = checkinKey ? checkinKey.match(/^.* week(\d+)$/) : []
  if (match && match.length) {
    return `Week ${match[1]}`
  }
  return ''
}

export const getItemId = (slug, items) => {
  const itemValues = Object.values(items)

  for (let i = 0; i < itemValues.length; i++) {
    const item = itemValues[i]
    if (
      (item.product && (slug === item.product.slug || slug === item.product.event_slug)) ||
      (item.event && slug === item.event.slug)
    ) {
      return item.product ? item.product.id : item.event.id
    }
  }
  return undefined
}

export const getProductIdsIfEvent = (slug, allItems) => {
  const pids = {}

  Object.values(allItems).forEach(item => {
    if (item.product && (slug === item.product.slug || slug === item.product.event_slug)) {
      pids[item.product.id] = true
    }
  })

  return pids
}

export const getItemAttributes = (itemIdSlug, items) => {
  const itemsById = {}
  items.forEach(item => {
    // log('item', item, Object.keys(item)[0], itemIdSlug)
    itemsById[Object.keys(item)[0]] = item[Object.keys(item)[0]]
  })

  const itemValue = itemsById[itemIdSlug]

  if (itemValue && itemValue.product && itemValue.product.attributes) {
    const attributes = {}
    itemValue.product.attributes.forEach(attribute => {
      attributes[attribute.name.toLowerCase()] = attribute.options.map(attr => nameCapitalize(attr))
    })
    return attributes
  }

  return []
}

export const getFilteredItemKeys = (reg, productIds, settings) =>
  Object.keys(reg.items)
    .filter(key =>
      Object.keys(productIds).length
        ? productIds[reg.items[key].item_product_id]
        : reg.items[key].valid_product
    )
    // filter out deselected items so that we do not check in for them
    .filter(
      key => !(settings.itemsDeselected && settings.itemsDeselected[reg.items[key].item_product_id])
    )

export const getFilteredItems = (reg, productIds, settings) => {
  const obj = {}
  getFilteredItemKeys(reg, productIds, settings).forEach(key => {
    obj[key] = reg.items[key]
  })
  return obj
}

export const getFilteredReg = (reg, productIds, settings) => {
  const filteredItems = getFilteredItems(reg, productIds, settings)
  if (Object.keys(reg.items).length !== Object.keys(filteredItems).length) {
    return { ...reg, items: filteredItems } // shallow copy is enough
  }
  return reg
}

export const getFilteredRegByItemIds = (reg, itemIds, settings) => {
  const filteredItems = {}
  Object.keys(reg.items)
    .filter(itemId => objHasKey(itemIds, itemId))
    .forEach(itemId => {
      filteredItems[itemId] = reg.items[itemId]
    })

  if (Object.keys(reg.items).length !== Object.keys(filteredItems).length) {
    return { ...reg, items: filteredItems } // shallow copy is enough
  }
  return reg
}

const registrantSearch = (reg, search, user) => {
  if (!search) return true

  // add registrant names to search
  const words = []
  Object.keys(reg.items).forEach(key => {
    const lastname = reg.items[key].lastname
    const firstname = reg.items[key].firstname
    if (lastname && words.indexOf(lastname) === -1) words.push(lastname)
    if (firstname && words.indexOf(firstname) === -1) words.push(firstname)
  })
  if (reg.lastname && words.indexOf(reg.lastname) === -1) words.push(reg.lastname)
  if (reg.firstname && words.indexOf(reg.firstname) === -1) words.push(reg.firstname)
  if (words.length > 2) {
    words.push('multi') // mark card as 'multi' if it has more than one registrant name
  }

  Object.keys(reg.order_status).forEach(orderId => {
    if (words.indexOf(orderId) === -1) words.push(`#${orderId}`)
  })

  // add 'order'/'note' to search if an order note is found
  const orderNotesKeys = Object.keys(reg.order_notes)
  // adding order note content, could slow things down
  orderNotesKeys.forEach(orderId => {
    Object.values(reg.order_notes[orderId]).forEach(note => {
      note.split(' ').forEach(word => {
        words.push(word)
      })
    })
  })
  if (orderNotesKeys.length) {
    words.push('order')
    words.push('notes')
  }

  const orderRefundsKeys = Object.keys(reg.refunds)
  orderRefundsKeys.forEach(orderId => {
    Object.values(reg.refunds[orderId]).forEach(refund => {
      ;(refund.reason || '').split(' ').forEach(word => {
        words.push(word)
      })
    })
  })
  if (orderRefundsKeys.length) {
    words.push('refunds')
  }

  Object.keys(reg.items).forEach(key => {
    const itemName = stripItemName(reg.items[key].item_name, {
      keepAttributes: true,
    })
    if (words.indexOf(itemName) === -1) words.push(itemName)

    Object.keys(reg.items[key].item_meta_data).forEach(k => {
      const metaKey = reg.items[key].item_meta_data[k].key
      if (metaKey && !metaKey.match(/^_|size/)) {
        const metaDataValue = reg.items[key].item_meta_data[k].value
        if (words.indexOf(metaDataValue) === -1) words.push(metaDataValue)
      }
    })
  })

  // add non-completed order status to search
  Object.keys(reg.items)
    .filterItemKeysByOrderStatus(reg.items)
    .forEach(key => {
      if (words.indexOf('order') === -1) words.push('order')
      if (words.indexOf('status') === -1) words.push('status')
      if (words.indexOf(reg.items[key].status)) words.push(reg.items[key].status)
    })

  // customer note
  Object.keys(reg.customer_note).forEach(key => {
    if (reg.customer_note[key].length) {
      if (words.indexOf('customer') === -1) words.push('customer')
      if (words.indexOf('note') === -1) words.push('note')
    }
    if (reg.customer_note[key].match(/manually entered/i)) {
      // log('note', reg.firstname, reg)
      if (words.indexOf('manual') === -1) words.push('manual')
      if (words.indexOf('entered') === -1) words.push('entered')
      if (words.indexOf('front') === -1) words.push('front')
      if (words.indexOf('desk') === -1) words.push('desk')
    }
    if (reg.customer_note[key].match(/volunteer/i)) {
      if (words.indexOf('volunteer') === -1) words.push('volunteer')
    }
  })

  // customer birthday verification
  if (user) {
    if (user.birthday_needs_verification) {
      if (words.indexOf('birthday') === -1) words.push('birthday')
    }
    if (
      user.meta &&
      user.meta.birthday_month_year &&
      isBirthdayThisMonth(user.meta.birthday_month_year)
    ) {
      if (words.indexOf('birthday') === -1) words.push('birthday')
    }
  }

  // run search using regex
  const searchExpr = getQuery(search.replace(/^\s+/, '').replace(/\s+$/, ''))
  let match = 0
  searchExpr.forEach(expr => {
    words.forEach(word => {
      try {
        if (word.match(new RegExp(expr, 'i'))) match += 1
      } catch (err) {
        // not catching regexp errors
      }
    })
  })

  return match >= searchExpr.length
}

export const getQuery = query => {
  const re = /"([^"]+)"|\S+/g
  const res = []
  let m
  while ((m = re.exec(query)) !== null) {
    res.push(m[1] || m[0])
  }
  return res
}

export const getRegistrantsSubheader = (
  checkedInStatus,
  registrantCounts,
  searchString,
  itemId
) => {
  const key = checkedInStatus === 'any' ? 'any' : checkedInStatus ? 'checkedIn' : 'notCheckedIn' // eslint-disable-line no-nested-ternary
  const count = registrantCounts[key]
  const attrsKeys = Object.keys(count.attrs)
  const allAttrs = attrsKeys
    .map(
      attrKey =>
        `${count.attrs[attrKey]} ${attrKey}${itemId ? '' : ' spot'}${
          count.attrs[attrKey] > 1 ? 's' : ''
        }`
    )
    .join(', ')
  return (
    (searchString ? 'found ' : '') + // eslint-disable-line prefer-template
    `${count.main} ` +
    `registrant${itemId ? '' : ' item'}${count.main > 1 ? 's' : ''}` +
    (allAttrs ? ` (${allAttrs})` : '')
  )
}

export const getRegistrantsSubheaderNoneFound = (
  checkedInStatus,
  registrantCounts,
  searchString,
  itemId
) =>
  getRegistrantsSubheader(checkedInStatus, registrantCounts, searchString, itemId).match(
    /(^|\s+)0 registrant/
  )

const arrayToObject = arr => {
  const array = arr.constructor === Array ? arr : [arr]
  return array.reduce((acc, item) => {
    acc[item] = 1
    return acc
  }, {})
}

// Filter registrants
//   if itemId is provided, make sure the registrant has it
//   filter out invalid products
//   filter based on search string
export const getFilteredRegistrants = (registrants, itemId, searchString, users, settings) =>
  Object.values(registrants)
    .map(reg => {
      if (itemId) {
        // check if registrant has the correct item
        const filteredReg = getFilteredReg(reg, arrayToObject(itemId), settings)
        // if not, return filtered registrant (it will be filtered out below)
        // otherwise, return registrant with non-valid items filtered out
        return !Object.keys(filteredReg.items).length
          ? filteredReg
          : getFilteredReg(reg, {}, settings)
      }
      return reg
    })
    .filter(reg => Object.keys(reg.items).length)
    .map(reg => {
      if (!searchString) return reg

      const names = getRegistrantNames(reg)
      if (names.length > 1) {
        let cnt = 0
        let filteredItemsIds = []
        for (const name of names) {
          const itemIds = getRegistrantItemKeysByName(reg.items, reg, name)
          const filteredReg = getFilteredRegByItemIds(reg, arrayToObject(itemIds), settings)
          const filteredRegSearch = registrantSearch(filteredReg, searchString, users[reg.id])
          if (filteredRegSearch) {
            cnt += 1
            filteredItemsIds = filteredItemsIds.concat(itemIds)
          }
        }
        if (cnt !== names.length) {
          const filteredReg = getFilteredRegByItemIds(
            reg,
            arrayToObject(filteredItemsIds),
            settings
          )
          return filteredReg
        }
      }

      return reg
    })
    .filter(reg => registrantSearch(reg, searchString, users[reg.id]))

export const itemIsBundle = item =>
  item.item_meta_data && item.item_meta_data.filter(meta => meta.key === '_bundled_items').length

export const calculateRegistrantCounts = (registrants, itemId, searchString, users, settings) => {
  // count all things and count per attribute set
  const registrantCounts = {
    notCheckedIn: { main: 0, attrs: {} },
    checkedIn: { main: 0, attrs: {} },
    any: { main: 0, attrs: {} },
  }
  const any = registrantCounts.any

  getFilteredRegistrants(registrants, itemId, searchString, users, settings).forEach(reg => {
    let count = {}
    if (isCheckedIn(reg.checkins, reg.items)) {
      count = registrantCounts.checkedIn
    } else {
      count = registrantCounts.notCheckedIn
    }

    const itemKeys = Object.keys(reg.items)
    const filteredItemKeys =
      itemId && itemId.length ? getFilteredItemKeys(reg, arrayToObject(itemId), settings) : itemKeys
    if (!filteredItemKeys.length && itemKeys.length) {
      count.main += 1
    }
    filteredItemKeys
      .filter(regItemKey => (itemId && itemId.length ? true : !itemIsBundle(reg.items[regItemKey])))
      .forEach(regItemKey => {
        const attrs = getRegistrantItemAttrs(reg, regItemKey, ['pa_role'])
        // log('calculateRegistrantCounts', attrs)
        Object.keys(attrs).forEach(key => {
          const attr = attrs[key]
          const attrVal = attr.map(val => (val.length > 1 ? val.toLowerCase() : val)).join('/')
          count.attrs[attrVal] || (count.attrs[attrVal] = 0)
          count.attrs[attrVal] += reg.items[regItemKey].item_quantity
          any.attrs[attrVal] || (any.attrs[attrVal] = 0)
          any.attrs[attrVal] += reg.items[regItemKey].item_quantity
          count.main += reg.items[regItemKey].item_quantity
          // log(reg.items[regItemKey].firstname, reg.items[regItemKey].lastname, role)
        })
        if (!Object.keys(attrs).length) {
          count.main += reg.items[regItemKey].item_quantity
        }
      })
  })

  any.main = registrantCounts.checkedIn.main + registrantCounts.notCheckedIn.main

  return registrantCounts
}

// get item title
export const getItemTitle = (items, { itemId, itemIdSlug }, settings) => {
  // log('getItemTitle', itemId, itemIdSlug)
  const productOrEvent = settings.uiItems && settings.uiItems.itemsWithoutEvents

  return Object.values(items)
    .map(item => (productOrEvent ? item.product : item.event))
    .filter(itemObj => itemId && itemIdSlug === itemObj.slug)
    .map(itemObj => (productOrEvent ? itemObj.name : itemObj.title))
    .join(' ')
}

export const getItemSlug = (items, itemIdSlug) => {
  const itemsKeyValue = Object.keys(items).map(key => ({
    key,
    item: items[key],
  }))

  return itemsKeyValue
    .map(({ key, item }) => ({ key, evt: item.event, product: item.product }))
    .filter(
      ({ key, evt, product }) =>
        (evt && evt.slug === itemIdSlug) ||
        (product && (product.slug === itemIdSlug || product.event_slug === itemIdSlug))
    )
    .map(({ key }) => key)
    .join(' ')
}

export const stripItemName = (name, { keepAttributes } = { keepAttributes: false }) => {
  const strippedName = name.replace(/\s*\([^)]*\)/, '')

  if (keepAttributes) return strippedName

  return (
    strippedName
      .replace(/(\s+(.)(\s+)?|,\s+)(leader|follower|solo).*$/i, '')
      .replace(/(\s+Class Series).*/i, '')
      .replace(/(\s+Series).*/i, '')
      // .replace(/\s+-\s+(Full Weekend|Sunday|Women|Men|Weekend|Saturday \+ Sunday|Saturday|Sunday)/i, '')
      // .replace(/(\s+-|,)\s+(XS|S|M|L|XL|2XL)$/, '')
      .replace(/\s+-.*$/, '')
  )
}

export const getItemAttrsClassName = (reg, key) =>
  stripItemName(reg.items[key].item_name)
    .concat(
      ' ',
      Object.values(getRegistrantItemAttrs(reg, key))
        .map(attrVal => `${attrVal.join('-').replace(/\s+/g, '-')}`)
        .join('–')
    )
    .replace(/\s+/g, '-')
    .toLowerCase()

export const getMatchingUniqueOrderItemKeys = (regItems, reg, name) => {
  const matchingItemKeys = getRegistrantItemKeysByName(
    regItems,
    reg,
    name
  ).filterItemKeysByOrderStatus(regItems)
  if (!matchingItemKeys.length) {
    return []
  }

  const matchingUniqueOrderItemKeys = matchingItemKeys
    .reduce(
      (acc, key) => {
        const orderId = regItems[key].id
        if (!objHasKey(acc[0], orderId)) {
          // if (!(orderId in acc[0])) {
          acc[0][orderId] = 1 // to avoid duplicates
          acc[1].push(key)
        }
        return acc
      },
      [{}, []]
    )
    .reduce((acc, val, idx) => (idx === 1 ? val : acc), []) // get the matching keys

  return matchingUniqueOrderItemKeys
}

export const arrayFlatten = arr =>
  arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? arrayFlatten(val) : val), [])

export const getRegistrantOrderIdsByName = (regItems, reg, name) => {
  const orderIds = {}
  // log('getRegistrantOrderIdsByName regItems', regItems)
  getRegistrantItemKeysByName(regItems, reg, name).forEach(itemKey => {
    const item = regItems[itemKey]
    orderIds[item.id] = 1
  })
  return Object.keys(orderIds)
}

export const getValidProductIdsForCheckin = (allItems, items) => {
  let pids = {}
  Object.keys(items).forEach(slug => {
    pids = Object.assign(pids, getProductIdsIfEvent(slug, allItems))
  })
  return pids
}

export const getRegistrantDropdownValues = (
  regItems,
  reg,
  name,
  orderId,
  create,
  dropDownValues,
  allItems
) => {
  let values = []

  // log('getRegistrantDropdownValues', dropDownValues[orderId], regItems)
  if (dropDownValues[orderId]) {
    // log('getRegistrantDropdownValues getValuesProductsInfo', allItems)
    const { infoByValue } = getValuesProductsInfo(dropDownValues[orderId], allItems)
    values = values.concat(
      dropDownValues[orderId].map(key => ({
        key,
        text: infoByValue[key].text,
        value: key,
      }))
    )
    return values
  }

  // if (create) log('values', values)
  if (create) return values

  // log(regItems, reg, name)
  values = values.concat(
    getRegistrantItemKeysByName(regItems, reg, name)
      .filter(itemKey => !orderId || regItems[itemKey].id.toString() === orderId)
      .map(itemKey => {
        const item = regItems[itemKey]
        const quantity = `${item.item_quantity} x `
        const key = `${quantity}${(item.item_variation_id || item.item_product_id).toString()}`
        // 'values', { key, text: `${quantity}${item.item_name}`, value: key })
        return {
          key,
          text: `${quantity}${stripItemName(item.item_name, {
            keepAttributes: true,
          })}`,
          value: key,
        }
      })
  )

  // log('getRegistrantDropdownValues values', values)
  return values
}

export const getRegistrantDropdownOptions = (
  regItems,
  reg,
  name,
  orderId,
  allItems,
  items,
  create,
  dropDownValues
) => {
  // get all valid product IDs
  const validProductIds = getValidProductIdsForCheckin(allItems, items)
  // Add registrant product IDs to the list of valid product IDs
  Object.keys(regItems).forEach(key => {
    validProductIds[regItems[key].item_product_id] = true
  })
  const isValidProductId = pid => objHasKey(validProductIds, pid)

  const options = getRegistrantDropdownValues(
    regItems,
    reg,
    name,
    orderId,
    create,
    dropDownValues,
    allItems
  ) // get registrant values

  const allItemsProducts = Object.values(allItems)
    .filter(item => item.product)
    .map(item => item.product)
  // log('allItemsProducts', allItemsProducts)

  let counter = 0
  allItemsProducts
    .filter(product => product && isValidProductId(product.id))
    .forEach(product => {
      if (product.product_variations && Object.keys(product.product_variations).length) {
        // log(product.name, product.product_variations)
        Object.keys(product.product_variations).forEach(variationId => {
          const id = variationId.toString()
          const key = product.sold_individually !== true ? `#${counter} - ${id}` : `1 x ${id}`
          // log('product variatio key', product.product_variations[variationId], key)
          const productName = product.product_variations[variationId].name
          const option = {
            key,
            text: stripItemName(productName, { keepAttributes: true }),
            value: key,
          }
          // log('options', JSON.stringify(options))
          // log('option', option, options.findIndex(opt => opt.key === key))
          if (options.findIndex(opt => opt.key === key) === -1) options.push(option)
        })
      } else {
        const id = product.id.toString()
        const key = product.sold_individually !== true ? `#${counter} - ${id}` : `1 x ${id}`
        // log('options', { key, text: product.name, value })
        const option = {
          key,
          text: stripItemName(product.name, { keepAttributes: true }),
          value: key,
        }
        if (options.findIndex(opt => opt.key === key) === -1) options.push(option)
      }
      counter += 1
    })

  // log('options', options)
  return options
}

export const objHasKey = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj, key) ||
  (typeof object === 'object' && key in obj && Object.getPrototypeOf(obj) === null)

export const renderLabel = (label, orderId, defaultValues) => {
  // log('renderLabel', defaultValues, label)
  const existingValue =
    !defaultValues || !defaultValues.length || defaultValues.indexOf(label.value) !== -1
  return {
    color: existingValue ? undefined : 'green',
    content: label.text,
    // icon: 'check',
  }
}

export const itemsKeysSort = regItems => (a, b) => {
  if (regItems[a].item_name < regItems[b].item_name) return -1
  if (regItems[a].item_name > regItems[b].item_name) return 1
  return 0
}

export const getItemInfo = ({ items, allItems, settings, match }) => {
  const itemIdSlug = match.params.itemId
  const itemId = isNaN(itemIdSlug) ? getItemId(itemIdSlug, items) : itemIdSlug
  const itemSlug = getItemSlug(items, itemIdSlug)

  const itemTitle = getItemTitle(items, { itemId, itemIdSlug }, settings)

  // For summer/resolution swing 2018 and earlier, there were no single event/product item.
  // The event was associated with two different products (one for each role).
  const productIdsIfEvent = getProductIdsIfEvent(itemSlug, allItems)
  // log('itemId', itemId, itemSlug, Object.keys(productIdsIfEvent).join(','))

  let itemIdArray

  if (!itemId) {
    // all registrants
    // skip deselected items
    const selectedItems = Object.values(allItems)
      .filter(itemsSelected(settings))
      .reduce((acc, item) => {
        acc[item.slug] = item
        return acc
      }, {})
    // log('selectedItems', selectedItems)
    const itemIdObj = getValidProductIdsForCheckin(selectedItems, items)
    itemIdArray = Object.keys(itemIdObj)
  } else if (
    itemId === Object.keys(productIdsIfEvent).join(',') ||
    !Object.keys(productIdsIfEvent).length
  ) {
    // FIXME: not sure if this case is still necessary?
    itemIdArray = [itemId]
  } else {
    itemIdArray = Object.keys(productIdsIfEvent)
  }

  return { itemId, itemTitle, itemIdArray }
}

export const getRegistrantCountsGroups = ({
  registrants,
  itemIdArray,
  activeSearchString,
  users,
  settings,
}) => {
  // get registrants counts
  const registrantCounts = calculateRegistrantCounts(
    registrants,
    itemIdArray,
    activeSearchString,
    users,
    settings
  )
  const registrantGroups = []
  if (settings.uiRegistrants && settings.uiRegistrants.separateCheckedIn) {
    if (registrantCounts.notCheckedIn.main)
      registrantGroups.push({
        checkedInStatus: false,
        header: 'Registrants to check-in',
      })
    if (registrantCounts.checkedIn.main)
      registrantGroups.push({
        checkedInStatus: true,
        header: 'Checked-in registrants',
      })
  } else if (registrantCounts.any.main) {
    registrantGroups.push({ checkedInStatus: 'any', header: 'Registrants' })
  }
  // log('registrantCounts', registrantCounts)

  return { registrantCounts, registrantGroups }
}

export const newRegInfo = {
  id: 0,
  email: 'no email yet',
  avatar: 'https://secure.gravatar.com/avatar/08eb813fff818a069e7f798f5574a7c7?f=y&s=96&d=mm&r=g',
  items: {
    '999999-888888': {
      id: 999999,
      item_id: 888888,
      status: 'new',
      firstname: 'or pick',
      lastname: 'Enter name',
    },
  },
  order_status: { 999999: 'new' },
  refundable: { 999999: 0 },
  cancellable: { 999999: 0 },
  refunds: {},
  order_notes: {},
  customer_note: {},
  total: { 999999: 0 },
  payment_method: { 999999: 'cod' },
  discount_total: { 999999: 0 },
}

export const getRegInfo = (
  regId,
  locationIndex,
  newReg,
  items,
  registrants,
  users,
  { updateNewReg } = { updateNewReg: false }
) => {
  let reg
  if (!newReg) {
    objHasKey(registrants, regId) && (reg = registrants[regId])
  } else if (!updateNewReg) {
    reg = newReg
  } else {
    reg = JSON.parse(JSON.stringify(newRegInfo)) // deep copy

    if (objHasKey(users, regId)) {
      reg.id = isNaN(regId) ? regId : Number(regId)
      reg.email = users[regId].email
      reg.avatar = users[regId].avatar
      Object.keys(reg.items).forEach(itemId => {
        reg.items[itemId].firstname = users[regId].firstname
        reg.items[itemId].lastname = users[regId].lastname
      })
    }
  }

  let regName = ''
  if (reg && Object.keys(items).length) {
    regName = getRegistrantNames(reg)
      .filter((name, index) => index === locationIndex)
      .map((name, index) => name)
      .toString()
  }

  const userRoles = getUserRoles(reg, users)

  return { reg, regName, userRoles }
}

export const regUserExists = (reg, users) => reg && objHasKey(users, reg.id)
export const getRegUser = (reg, users) => regUserExists(reg, users) && users[reg.id]
export const getUserRoles = (reg, users) => (getRegUser(reg, users) || { roles: [] }).roles

const getProductFromId = (id, items) => {
  // id is a string
  for (const slug of Object.keys(items)) {
    if (items[slug].product) {
      if (id === items[slug].product.id.toString()) return items[slug].product
      const variations = items[slug].product.product_variations || {}
      for (const pId of Object.keys(variations)) {
        if (id === pId) return variations[pId]
      }
    }
  }
  return null
}

// FIXME: hardcoding series pricing based on user role
// There is no easy way to query product pricing rules.
const pricingTable = {
  series: {
    // regexp matching product name
    // weeks: { role: [1x price, 2x price] }
    3: { default: [40, 35], '24__under': [30, 30], senior: [30, 30] }, // 3-week series
    4: { default: [60, 45], '24__under': [30, 30], senior: [30, 30] }, // 4-week series
    5: { default: [65, 50], '24__under': [35, 35], senior: [35, 35] }, // 5-week series
  },
}

const getEventFromProductId = (productId, items) => {
  for (const item of Object.values(items)) {
    if (item.product && productId === item.product.id.toString()) {
      if (item.event) return item.event
    }
  }

  return null
}

const getProductPrice = (productId, userRoles, productsInfo, items) => {
  const product = getProductFromId(productId, items)
  let pricesByRole = role => Number(product.prices[role])

  // check if product has corresponding event
  const event = getEventFromProductId(productId, items)
  if (event) {
    // get corresponding pricing table key
    let key
    for (const regex of Object.keys(pricingTable)) {
      if (product.name.match(new RegExp(regex, 'i'))) {
        key = regex
        break
      }
    }

    // count how many products match the pricing table key
    let count = 0
    if (key) {
      Object.keys(productsInfo).forEach(pId => {
        const p = getProductFromId(pId, items)
        if (p.name.match(new RegExp(key, 'i'))) {
          count += productsInfo[pId].quantity
        }
      })

      const weeks = event.week_numbers?.length
      if (weeks) {
        pricesByRole = role => pricingTable[key][weeks][role][Math.min(count - 1, 1)]
      } else {
        error('No week numbers info found for event ID', event.id)
      }
    }
  }

  return userRoles
    .concat(['default'])
    .reduce((p, role) => Math.min(p, pricesByRole(role)), pricesByRole('default'))
}

export const getValuesProductsInfo = (orderValues = [], items, userRoles = []) => {
  const productsInfo = {}
  const productsInfoByValue = {}
  let orderTotal = 0

  orderValues.forEach(value => {
    let productId = value
    const matches = value.match(/^((-?\d+) x|#(\d+) -) (\d+)$/)
    let quantity = 0
    if (matches) {
      productId = matches[4]
      if (matches[1].match(/^#/)) {
        quantity += 1
      } else {
        quantity += Number(matches[2])
      }
    } else {
      quantity += 1
    }

    const product = getProductFromId(productId, items)
    if (product) {
      productsInfo[productId] || (productsInfo[productId] = {})
      productsInfo[productId].quantity || (productsInfo[productId].quantity = 0)
      productsInfo[productId].quantity += quantity
      productsInfoByValue[value] || (productsInfoByValue[value] = {})
      productsInfoByValue[value].text = `${productsInfo[productId].quantity} x ${stripItemName(
        product.name,
        { keepAttributes: true }
      )}`
    } else {
      error('No product found for ID', productId, 'within', items)
    }
  })

  const updatedOrderValues = []
  Object.keys(productsInfo).forEach(productId => {
    productsInfo[productId].price = getProductPrice(productId, userRoles, productsInfo, items)
    orderTotal += productsInfo[productId].price * productsInfo[productId].quantity
    updatedOrderValues.push(`${productsInfo[productId].quantity} x ${productId}`)
  })

  return {
    info: productsInfo,
    infoByValue: productsInfoByValue,
    orderValues: updatedOrderValues.sort(),
    orderTotal,
  }
}

export const getRegistrantNamesForLocationIndex = (reg, create, locationIndex) =>
  getRegistrantNames(reg).filter((name, index) => create || index === locationIndex)

export const getDropDownInfo = (reg, name, orderIds, create, values, items, allItems) => {
  const getDropDownDefaultValue = (orderId, noDropDownValues = false) =>
    getRegistrantDropdownValues(
      reg.items,
      reg,
      name,
      orderId,
      create,
      noDropDownValues ? {} : values,
      allItems
    )
      .map(({ key, text, value }) => value)
      .sort()
  const getDropDownOptions = orderId =>
    getRegistrantDropdownOptions(reg.items, reg, name, orderId, allItems, items, create, values)

  const dropDownDefaultValue = {}
  const dropDownDefaultValueAll = {}
  const dropDownOptions = {}
  const dropDownKey = {}
  orderIds.forEach(orderId => {
    dropDownDefaultValue[orderId] = getDropDownDefaultValue(orderId)
    dropDownDefaultValueAll[orderId] = getDropDownDefaultValue(orderId, true)
    dropDownOptions[orderId] = getDropDownOptions(orderId)
    dropDownKey[orderId] = JSON.stringify(reg.items)
      .concat(JSON.stringify(dropDownDefaultValueAll[orderId])) // FIXME: do we need the 'All' version here?
      .concat(JSON.stringify(dropDownOptions[orderId]))
  })

  return {
    dropDownDefaultValue,
    dropDownDefaultValueAll,
    dropDownOptions,
    dropDownKey,
  }
}

export const updateTopMenuTitle = (fn, title) =>
  fn(<div className="top-menu-title">{heDecode(title)}</div>)

/* eslint-disable */
export function debounce(a, b, c) {
  var d, e
  return function () {
    function h() {
      ;(d = null), c || (e = a.apply(f, g))
    }
    var f = this,
      g = arguments
    return clearTimeout(d), (d = setTimeout(h, b)), c && !d && (e = a.apply(f, g)), e
  }
}
/* eslint-enable */
