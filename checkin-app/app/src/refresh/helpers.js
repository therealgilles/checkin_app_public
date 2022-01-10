import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import debug from 'debug'

dayjs.extend(relativeTime)

debug.enable('refresh/helpers:*')
// const log = debug('refresh/helpers:log')
// const info = debug('refresh/helpers:info')
const error = debug('refresh/helpers:error')

export const getDate = date => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

// get items/registrants/users ID
//   ID can be a number or a string
export const getId = obj => Object.keys(obj)[0]

// Sort item by event start date if available
//   if they have the same start date, sort by name
export const itemsSort = (a, b) => {
  if (a.event && b.event) {
    const aEventStartDate = a.event.start_date
    const bEventStartDate = b.event.start_date
    const dateDiff = dayjs(aEventStartDate).diff(dayjs(bEventStartDate))
    if (dateDiff < 0) return -1
    if (dateDiff > 0) return 1
    if (a.event.title < b.event.title) return -1
    if (a.event.title > b.event.title) return 1
  }

  if (a.product && b.product) {
    const aName = a.product.name
    const bName = b.product.name
    if (aName < bName) return -1
    if (aName > bName) return 1
  }

  return 0
}

// Sort registrants by last/first names
export const registrantSort = (a, b) => {
  if (!a.lastname && !a.firstname) {
    error('registrantSort: missing first/last names', a)
    return 0
  }
  if (!b.lastname && !b.firstname) {
    error('registrantSort: missing first/last names', b)
    return 0
  }
  if (!a.lastname || !a.firstname) {
    return -1 // put registrants with missing first/last names on top
  }
  if (!b.lastname || !b.firstname) {
    return 1 // put registrants with missing first/last names on top
  }
  const aName = (a.lastname + a.firstname).toLowerCase()
  const bName = (b.lastname + b.firstname).toLowerCase()

  if (aName < bName) return -1
  if (aName > bName) return 1
  return 0
}

export const itemsWithEvent = item => !!item.event
export const itemsSelected = settings => item =>
  !settings.itemsDeselected || !settings.itemsDeselected[item.slug]
export const itemsIfEvent = settings => item =>
  settings.uiItems && settings.uiItems.itemsWithoutEvents ? true : itemsWithEvent(item)

export const itemsSelectedIfEvent = settings => item =>
  itemsIfEvent(settings)(item) && itemsSelected(settings)(item)

export const getRefreshButtonMsg = (idx, stateIndexes, refreshStatus, refreshDate, errorData) => {
  const localRefreshStatus = refreshStatus[idx]
  const localRefreshDate = refreshDate[idx]
  const localErrorData = errorData[idx]

  // Set button & message based on refresh status
  const button = {
    content: {
      [stateIndexes.REFRESH_IDX_BUTTON_REFRESH]: 'Refresh data on server',
      [stateIndexes.REFRESH_IDX_BUTTON_GET_DATA]: 'Get data from server',
      [stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST]: 'Auto data update',
    },
    disabled: idx === stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST,
  }

  const message = {
    header: 'Nothing yet:',
    text: `No ${(button.content[idx] || 'refresh').toLowerCase()} started yet.`,
    props: { hidden: false },
    loading: false,
  }

  // log('getRefreshButtonMsg', idx, localRefreshStatus)
  if (localRefreshStatus === 'refreshing') {
    button.content[stateIndexes.REFRESH_IDX_BUTTON_REFRESH] = 'Refreshing...'
    button.content[stateIndexes.REFRESH_IDX_BUTTON_GET_DATA] = 'Getting Data...'
    button.content[stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST] = 'Data Updating...'
    if (idx !== stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST) {
      message.header = 'Just a second...'
      message.text = 'Wait while refresh is ongoing.'
      message.loading = true
    } else {
      message.header = 'Waiting for data...'
      message.text = `Refresh started ${dayjs(localRefreshDate).fromNow()}.`
    }
    message.props.hidden = false
    message.props.info = true
  } else if (localRefreshStatus === 'rejected') {
    message.header = 'A problem occured:'
    message.text = `Last refresh failed ${dayjs(localRefreshDate).fromNow()}. ${localErrorData}`
    message.props.hidden = false
    message.props.error = true
  } else if (localRefreshStatus && localRefreshStatus.match(/refreshed/)) {
    const m = localRefreshStatus.match(/^refreshed (.*)$/)
    message.header = !m || m[1].match(/refresh/i) ? 'All done' : `${m[1]} updated`
    message.text = `Refreshed ${dayjs(localRefreshDate).fromNow()}.`
    message.props.hidden = false
    message.props.success = true
  } else if (localRefreshStatus === 'cancelled') {
    if (idx !== stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST) {
      message.header = 'You did it:'
      message.text = `Last refresh was cancelled ${dayjs(localRefreshDate).fromNow()}.`
    } else {
      message.header = 'Last refresh cancelled'
      message.text = 'Data may still arrive...'
    }
    message.props.hidden = false
    message.props.info = true
  }

  return { button, message }
}

export const objectToArray = obj => Object.keys(obj).map(key => ({ [key]: obj[key] }))
