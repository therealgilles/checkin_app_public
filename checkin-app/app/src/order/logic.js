import { createLogic } from 'redux-logic'
import debug from 'debug'
import { orderUpdateFulfilled, orderUpdateRejected, ORDER_UPDATE_REQUEST } from './actions'
import { httpRequestErrorMessage } from '../store/helpers'

debug.enable('order/logic:*')
const log = debug('order/logic:log')
// const info = debug('order/logic:info')
// const error = debug('order/logic:error')

export const orderUpdateLogic = createLogic({
  type: ORDER_UPDATE_REQUEST,

  async process({ httpClient, getState, action }, dispatch, done) {
    const idx = action.payload[0]
    const regId = action.payload[1] // registrant ID
    const orderUpdateData = action.payload[2]
    log('orderUpdateLogic', action.payload)

    try {
      const resp = await httpClient.put(
        `/api/registrants/${encodeURIComponent(btoa(regId))}?reqId=client&filterByItems=true`,
        orderUpdateData
      )
      log('orderUpdateLogic then', resp)
      dispatch(orderUpdateFulfilled(idx)) // FIXME? should we check the resp?
      if (orderUpdateData.create) {
        if (`${regId}` !== '0' && !isNaN(regId)) {
          window.location.assign(`/registrants/${encodeURIComponent(regId)}`)
        } else {
          window.location.assign('/registrants')
        }
      }
    } catch (err) {
      const errorMessage = httpRequestErrorMessage('orderUpdateLogic', err)
      dispatch(orderUpdateRejected(idx, errorMessage))
    } finally {
      done()
    }
  },
})

export default [orderUpdateLogic]
