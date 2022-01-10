import debug from 'debug'
import { key, ORDER_UPDATE_REQUEST, ORDER_UPDATE_FULFILLED, ORDER_UPDATE_REJECTED } from './actions'
import { getDate } from './helpers'
import { anyToString } from '../store/helpers'

debug.enable('order/reducer:*')
// const log = debug('order/reducer:log')
// const info = debug('order/reducer:info')
// const error = debug('order/reducer:error')

export const selectors = {
  orderUpdateStatus: state => state[key].orderUpdateStatus,
  orderUpdateDate: state => state[key].orderUpdateDate,
  errorData: state => state[key].errorData,
}

const initialState = {
  orderUpdateStatus: { 999999: 'new' },
  orderUpdateDate: {},
  errorData: {},
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case ORDER_UPDATE_REQUEST: {
      const idx = action.payload[0]
      return {
        ...state,
        orderUpdateStatus: { ...state.orderUpdateStatus, [idx]: 'processing order update' },
        orderUpdateDate: { ...state.orderUpdateDate, [idx]: getDate() },
      }
    }
    case ORDER_UPDATE_FULFILLED: {
      const idx = action.payload
      return {
        ...state,
        orderUpdateStatus: { ...state.orderUpdateStatus, [idx]: 'order update succeeded' },
        orderUpdateDate: { ...state.orderUpdateDate, [idx]: getDate() },
      }
    }
    case ORDER_UPDATE_REJECTED: {
      const idx = action.payload[0]
      const err = action.payload[1]
      return {
        ...state,
        orderUpdateStatus: { ...state.orderUpdateStatus, [idx]: 'order update rejected' },
        orderUpdateDate: { ...state.orderUpdateDate, [idx]: getDate() },
        errorData: { ...state.errorData, [idx]: anyToString(err) },
      }
    }
    default:
      return state
  }
}
