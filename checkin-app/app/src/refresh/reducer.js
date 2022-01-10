import diff from 'deep-diff'
import debug from 'debug'
import {
  key,
  stateIndexes,
  REFRESH_REQUEST,
  REFRESH_CANCEL,
  REFRESH_FULFILLED,
  REFRESH_REJECTED,
  REFRESH_MSG_RECEIVED,
  REFRESH_UPDATE_INFO,
} from './actions'
import { getDate, itemsSelectedIfEvent } from './helpers'
import { objHasKey } from '../components/registrants/helpers'
import { anyToString } from '../store/helpers'

debug.enable('refresh/reducer:*')
const log = debug('refresh/reducer:log')
// const info = debug('refresh/reducer:info')
// const error = debug('refresh/reducer:error')

export const selectors = {
  items: state => state[key].items,
  allItems: state => state[key].allItems,
  // validProductIdsForCheckin: state => state[key].validProductIdsForCheckin,
  registrants: state => state[key].registrants,
  users: state => state[key].users,
  settings: state => state[key].settings,
  refreshStatus: state => state[key].refreshStatus,
  refreshDate: state => state[key].refreshDate,
  errorData: state => state[key].errorData,
}

export const initialItem = {
  // Fake initial item
  1: {
    slug: 'item-slug',
    event: {
      id: 1,
      title: 'Items (classes/dance passes) need to be loaded...',
      slug: 'item-event-slug',
    },
  },
}

const initialState = {
  items: initialItem,
  allItems: initialItem,
  // validProductIdsForCheckin: {},
  registrants: {},
  users: {},
  settings: {
    // this must match what's on the server
    app: {
      version: undefined,
    },
    events: {
      start_date: null,
      end_date: null,
    },
    itemsDeselected: {},
    uiRegistrants: {
      separateCheckedIn: false,
      clearSearchOnCheckIn: true,
      hideEmailAddress: false,
      hideOrderStatusWhenPaid: true,
    },
    uiItems: {
      itemsWithoutEvents: false,
      itemsShowDescription: false,
    },
    uiUsers: {
      skipUnusedUsers: false,
      skipUnusedUsersOptions: {
        defaultValue: null,
        options: {},
      },
    },
  },
  refreshStatus: {},
  refreshDate: {},
  errorData: {},
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case REFRESH_REQUEST: {
      const idx = action.payload[0]
      const refreshEndpoints = action.payload[2]
      const refreshStatus = { ...state.refreshStatus }
      refreshStatus[idx] = 'refreshing'
      const refreshDate = { ...state.refreshDate }
      refreshDate[idx] = getDate()
      if (idx === stateIndexes.REFRESH_IDX_BUTTON_REFRESH) {
        const autoIdx = stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST
        refreshStatus[autoIdx] = refreshStatus[idx]
        refreshDate[autoIdx] = refreshDate[idx]
      }
      refreshEndpoints
        .map(i => i.endpoint)
        .forEach(group => {
          refreshStatus[group] = refreshStatus[idx]
          refreshDate[group] = refreshDate[idx]
        })
      return {
        ...state,
        refreshStatus,
        refreshDate,
      }
    }
    case REFRESH_CANCEL: {
      const idx = action.payload
      const refreshStatus = { ...state.refreshStatus }
      refreshStatus[idx] = 'cancelled'
      const refreshDate = { ...state.refreshDate }
      refreshDate[idx] = getDate()
      if (idx === stateIndexes.REFRESH_IDX_BUTTON_REFRESH) {
        const autoIdx = stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST
        refreshStatus[autoIdx] = refreshStatus[idx]
        refreshDate[autoIdx] = refreshDate[idx]
      }
      return {
        ...state,
        refreshStatus,
        refreshDate,
      }
    }
    case REFRESH_FULFILLED: {
      const idx = action.payload[0]
      const refreshData = action.payload[1]
      const refreshGroups = action.payload[2]
      // log('REFRESH_FULFILLED', idx)

      const refreshStatus = { ...state.refreshStatus }
      refreshStatus[idx] = 'refreshed'
      const refreshDate = { ...state.refreshDate }
      refreshDate[idx] = getDate()
      // if (idx === stateIndexes.REFRESH_IDX_BUTTON_REFRESH) {
      //   const autoIdx = stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST
      //   refreshStatus[autoIdx] = refreshStatus[idx]
      //   refreshDate[autoIdx] = refreshDate[idx]
      // }

      const itemsIndex = refreshGroups.indexOf('items')
      const registrantsIndex = refreshGroups.indexOf('registrants')
      const usersIndex = refreshGroups.indexOf('users')
      //
      const items = itemsIndex >= 0 ? {} : state.items
      const allItems = itemsIndex >= 0 ? refreshData[itemsIndex] : state.allItems
      if (itemsIndex >= 0) {
        Object.values(allItems)
          .filter(itemsSelectedIfEvent(state.settings))
          .reduce((acc, item) => {
            acc[item.slug] = item
            return acc
          }, items)
      }
      // const validProductIdsForCheckin = (itemsIndex >= 0) ? getValidProductIdsForCheckin(allItems, items) : state.validProductIdsForCheckin
      const registrants = registrantsIndex >= 0 ? refreshData[registrantsIndex] : state.registrants
      const users = usersIndex >= 0 ? refreshData[usersIndex] : state.users
      refreshGroups.forEach(group => {
        refreshStatus[group] = refreshStatus[idx]
        refreshDate[group] = refreshDate[idx]
      })
      refreshGroups && (refreshStatus[idx] += ` ${refreshGroups.join('/')}`)
      return {
        ...state,
        refreshStatus,
        refreshDate,
        items,
        allItems,
        // validProductIdsForCheckin,
        registrants,
        users,
      }
    }
    case REFRESH_REJECTED: {
      const idx = action.payload[0]
      const refreshGroups = action.payload[1]
      const err = action.payload[2]
      log('REFRESH_REJECTED', idx, err)
      const refreshStatus = { ...state.refreshStatus }
      refreshStatus[idx] = 'rejected'
      const refreshDate = { ...state.refreshDate }
      refreshDate[idx] = getDate()
      const errorData = { ...state.errorData }
      errorData[idx] = anyToString(err)
      refreshGroups.forEach(group => {
        refreshStatus[group] = refreshStatus[idx]
        refreshDate[group] = refreshDate[idx]
        errorData[group] = errorData[idx]
      })
      // if (idx === stateIndexes.REFRESH_IDX_BUTTON_REFRESH) {
      //   const autoIdx = stateIndexes.REFRESH_IDX_MSGREC_DISPATCH_REFRESH_REQUEST
      //   refreshStatus[autoIdx] = refreshStatus[idx]
      //   refreshDate[autoIdx] = refreshDate[idx]
      //   errorData[autoIdx] = errorData[idx]
      // }
      return {
        ...state,
        refreshStatus,
        refreshDate,
        errorData,
      }
    }
    case REFRESH_MSG_RECEIVED: {
      const idx = stateIndexes.REFRESH_IDX_MSG_RECEIVED
      const refreshStatus = { ...state.refreshStatus }
      const refreshDate = { ...state.refreshDate }
      const { cmd, data } = action.payload
      let registrants = state.registrants
      let items = state.items
      let allItems = state.allItems
      let users = state.users
      let settings = state.settings

      if (cmd === 'update registrant') {
        const id = data.id
        // log('id index', id, index)
        if (!objHasKey(registrants, id) || diff(data.reg, registrants[id])) {
          // log('existing registrant', registrants[id])
          log('receive update registrant', id)
          registrants = { ...state.registrants, [id]: data.reg } // shallow copy is enough
          refreshStatus[idx] = `updated registrant ${id}`
          refreshDate[idx] = getDate()
        } else {
          log('not updating registrant', id)
        }
      } else if (cmd === 'update user') {
        const id = data.id
        if (!objHasKey(users, id) || diff(data.userData, users[id])) {
          users = { ...state.users, [id]: data.userData } // shallow copy is enough
          refreshStatus[idx] = `updated user ${id}`
          refreshDate[idx] = getDate()
        } else {
          log('not updating user', id)
        }
      } else if (cmd === 'update item') {
        const id = data.id
        if (!objHasKey(allItems, id) || diff(data.item, allItems[id])) {
          // updating both allItems and items
          allItems = { ...state.allItems, [id]: data.item } // shallow copy is enough
          items = { ...state.items, [id]: data.item } // shallow copy is enough
          refreshStatus[idx] = `updated item ${id}`
          refreshDate[idx] = getDate()
        } else {
          log('not updating item', id)
        }
      } else if (cmd === 'update settings') {
        if (diff(settings, data.settings)) {
          settings = { ...state.settings, ...data.settings } // shallow copy is enough
          refreshStatus[idx] = 'updated settings'
          refreshDate[idx] = getDate()
          log('updated settings')

          // update items as settings may have changed
          items = Object.values(state.allItems)
            .filter(itemsSelectedIfEvent(settings))
            .reduce((acc, item) => {
              acc[item.slug] = item
              return acc
            }, {})
        } else {
          log('not updating settings')
        }
      } else if (cmd === 'version check') {
        if (diff(settings.app.version, data.version)) {
          const app = { ...settings.app }
          app.version = data.version
          settings = { ...state.settings, app }
          log('updated settings app version', app.version)
        }
      }
      return {
        ...state,
        registrants,
        items,
        allItems,
        users,
        settings,
        refreshStatus,
        refreshDate,
      }
    }
    case REFRESH_UPDATE_INFO: {
      const status = action.payload[0]
      const refreshGroups = action.payload[1]
      const refreshStatus = { ...state.refreshStatus }
      const refreshDate = { ...state.refreshDate }
      const d = getDate()
      refreshGroups.forEach(group => {
        refreshStatus[group] = status
        refreshDate[group] = d
      })
      return {
        ...state,
        refreshStatus,
        refreshDate,
      }
    }
    default:
      return state
  }
}
