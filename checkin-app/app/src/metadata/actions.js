// unique key namespace used by combineReducers.
// By convention it will match the directory structure to
// make it easy to locate the src.
// Also action types will prefix with the capitalized version
export const key = 'metaData'

// action type constants
export const METADATA_REQUEST = 'METADATA_REQUEST'
export const METADATA_CANCEL = 'METADATA_CANCEL'
export const METADATA_FULFILLED = 'METADATA_FULFILLED'
export const METADATA_REJECTED = 'METADATA_REJECTED'

export const actionTypes = {
  METADATA_REQUEST,
  METADATA_CANCEL,
  METADATA_FULFILLED,
  METADATA_REJECTED,
}

// action creators
export const metaDataRequest = (idx, userId, metaData) => ({
  type: METADATA_REQUEST,
  payload: [idx, userId, metaData],
})
export const metaDataCancel = idx => ({ type: METADATA_CANCEL, payload: idx })
export const metaDataFulfilled = idx => ({ type: METADATA_FULFILLED, payload: idx })
export const metaDataRejected = (idx, err) => ({ type: METADATA_REJECTED, payload: [idx, err] })

export const actions = {
  metaDataRequest,
  metaDataCancel,
  metaDataFulfilled,
  metaDataRejected,
}
