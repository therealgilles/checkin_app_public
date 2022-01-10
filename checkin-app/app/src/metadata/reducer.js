import debug from 'debug'
import { key, METADATA_REQUEST, METADATA_CANCEL, METADATA_FULFILLED, METADATA_REJECTED } from './actions'
import { getDate } from './helpers'
import { anyToString } from '../store/helpers'

debug.enable('metadata/reducer:*')
// const log = debug('metadata/reducer:log')
// const info = debug('metadata/reducer:info')
// const error = debug('metadata/reducer:error')

export const selectors = {
  metaDataStatus: state => state[key].metaDataStatus,
  metaDataDate: state => state[key].metaDataDate,
  errorData: state => state[key].errorData,
}

const initialState = {
  metaDataStatus: {},
  metaDataDate: {},
  errorData: {},
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case METADATA_REQUEST: {
      const idx = action.payload[0]
      return {
        ...state,
        metaDataStatus: { ...state.metaDataStatus, [idx]: 'updating metadata' },
        metaDataDate: { ...state.metaDataDate, [idx]: getDate() },
      }
    }
    case METADATA_CANCEL: {
      const idx = action.payload
      return {
        ...state,
        metaDataStatus: { ...state.metaDataStatus, [idx]: 'cancelled' },
        metaDataDate: { ...state.metaDataDate, [idx]: getDate() },
      }
    }
    case METADATA_FULFILLED: {
      const idx = action.payload
      return {
        ...state,
        metaDataStatus: { ...state.metaDataStatus, [idx]: 'metadata updated' },
        metaDataDate: { ...state.metaDataDate, [idx]: getDate() },
      }
    }
    case METADATA_REJECTED: {
      const idx = action.payload[0]
      const err = action.payload[1]
      return {
        ...state,
        metaDataStatus: { ...state.metaDataStatus, [idx]: 'metadata rejected' },
        metaDataDate: { ...state.metaDataDate, [idx]: getDate() },
        errorData: { ...state.errorData, [idx]: anyToString(err) },
      }
    }
    default:
      return state
  }
}
