import { store } from '../store'
import { actions as searchActions, selectors as searchSelectors } from '../search'
import { getCheckinData } from './helpers'

// unique key namespace used by combineReducers.
// By convention it will match the directory structure to
// make it easy to locate the src.
// Also action types will prefix with the capitalized version
export const key = 'checkin'

// action type constants
export const CHECKIN_REQUEST = 'CHECKIN_REQUEST'
export const CHECKIN_CANCEL = 'CHECKIN_CANCEL'
export const CHECKIN_FULFILLED = 'CHECKIN_FULFILLED'
export const CHECKIN_REJECTED = 'CHECKIN_REJECTED'

export const actionTypes = {
  CHECKIN_REQUEST,
  CHECKIN_CANCEL,
  CHECKIN_FULFILLED,
  CHECKIN_REJECTED,
}

// action creators
export const checkinRequest = (
  idx,
  regId,
  { checkinUndo, clearSearchOnCheckIn, settings, ...checkinData }
) => ({
  type: CHECKIN_REQUEST,
  payload: [
    idx,
    regId,
    getCheckinData({ checkinUndo, settings, ...checkinData }),
    checkinUndo,
    clearSearchOnCheckIn,
  ],
})
export const checkinCancel = (idx, props) => ({
  type: CHECKIN_CANCEL,
  payload: idx,
})
export const checkinFulfilled = (idx, checkinUndo, clearSearchOnCheckIn) => {
  if (clearSearchOnCheckIn) {
    // clear search on successful checkin if search string is set
    if (searchSelectors.activeSearchString(store.getState()) !== '') {
      store.dispatch(searchActions.searchUpdateSearchString(null, { value: '' }))
    }
  }
  return { type: CHECKIN_FULFILLED, payload: [idx, checkinUndo] }
}
export const checkinRejected = (idx, checkinUndo, err) => ({
  type: CHECKIN_REJECTED,
  payload: [idx, checkinUndo, err],
})

export const actions = {
  checkinRequest,
  checkinCancel,
  checkinFulfilled,
  checkinRejected,
}
