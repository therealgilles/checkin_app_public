import debug from 'debug'
import { key, CHECKIN_REQUEST, CHECKIN_CANCEL, CHECKIN_FULFILLED, CHECKIN_REJECTED } from './actions'
import { getDate } from './helpers'
import { anyToString } from '../store/helpers'

debug.enable('checkin/reducer:*')
// const log = debug('checkin/reducer:log')
// const info = debug('checkin/reducer:info')
// const error = debug('checkin/reducer:error')

export const selectors = {
  checkinStatus: state => state[key].checkinStatus,
  checkinDate: state => state[key].checkinDate,
  errorData: state => state[key].errorData,
}

const initialState = {
  checkinStatus: {},
  checkinDate: {},
  errorData: {},
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case CHECKIN_REQUEST: {
      const idx = action.payload[0]
      const checkinUndo = action.payload[3]
      return {
        ...state,
        checkinStatus: { ...state.checkinStatus, [idx]: checkinUndo ? 'undoing checkin' : 'checking in' },
        checkinDate: { ...state.checkinDate, [idx]: getDate() },
      }
    }
    case CHECKIN_CANCEL: {
      const idx = action.payload
      return {
        ...state,
        checkinStatus: { ...state.checkinStatus, [idx]: 'cancelled' },
        checkinDate: { ...state.checkinDate, [idx]: getDate() },
      }
    }
    case CHECKIN_FULFILLED: {
      const idx = action.payload[0]
      const checkinUndo = action.payload[1]
      return {
        ...state,
        checkinStatus: { ...state.checkinStatus, [idx]: checkinUndo ? 'not checked in' : 'checked in' },
        checkinDate: { ...state.checkinDate, [idx]: getDate() },
      }
    }
    case CHECKIN_REJECTED: {
      const idx = action.payload[0]
      const checkinUndo = action.payload[1]
      const err = action.payload[2]
      return {
        ...state,
        checkinStatus: { ...state.checkinStatus, [idx]: checkinUndo ? 'undo checkin rejected' : 'checkin rejected' },
        checkinDate: { ...state.checkinDate, [idx]: getDate() },
        errorData: { ...state.errorData, [idx]: anyToString(err) },
      }
    }
    default:
      return state
  }
}
