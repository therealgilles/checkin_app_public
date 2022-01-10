// unique key namespace used by combineReducers.
// By convention it will match the directory structure to
// make it easy to locate the src.
// Also action types will prefix with the capitalized version
export const key = 'order'

// action type constants
export const ORDER_UPDATE_REQUEST = 'ORDER_UPDATE_REQUEST'
export const ORDER_UPDATE_FULFILLED = 'ORDER_UPDATE_FULFILLED'
export const ORDER_UPDATE_REJECTED = 'ORDER_UPDATE_REJECTED'

export const actionTypes = {
  ORDER_UPDATE_REQUEST,
  ORDER_UPDATE_FULFILLED,
  ORDER_UPDATE_REJECTED,
}

// action creators
export const orderUpdateRequest = (idx, regId, orderUpdateData) => ({ type: ORDER_UPDATE_REQUEST, payload: [idx, regId, orderUpdateData] })
export const orderUpdateFulfilled = idx => ({ type: ORDER_UPDATE_FULFILLED, payload: idx })
export const orderUpdateRejected = (idx, err) => ({ type: ORDER_UPDATE_REJECTED, payload: [idx, err] })

export const actions = {
  orderUpdateRequest,
  orderUpdateFulfilled,
  orderUpdateRejected,
}
