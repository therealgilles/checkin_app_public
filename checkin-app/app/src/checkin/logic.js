import { createLogic } from 'redux-logic'
import debug from 'debug'
import { checkinFulfilled, checkinRejected, CHECKIN_REQUEST, CHECKIN_CANCEL } from './actions'

debug.enable('checkin/logic:*')
// const log = debug('checkin/logic:log')
// const info = debug('checkin/logic:info')
const error = debug('checkin/logic:error')

// const delay = 4 // 4s delay for interactive use of cancel/take latest

export const checkinLogic = createLogic({
  type: CHECKIN_REQUEST,
  cancelType: CHECKIN_CANCEL,
  // latest: true, // take latest only

  // use axios injected as httpClient from configureStore logic deps
  // we also have access to getState and action in the first argument
  // but they were not needed for this particular code
  async process({ httpClient, getState, action }, dispatch, done) {
    const idx = action.payload[0]
    const regId = action.payload[1] // registrant ID
    const checkinData = action.payload[2]
    const checkinUndo = action.payload[3]
    const clearSearchOnCheckIn = action.payload[4]
    // log('checkinLogic index', idx)
    // log('checkinLogic checkinData', checkinData)
    // log('checkinLogic checkinUndo', checkinUndo)
    try {
      await httpClient.put(
        `/api/registrants/${encodeURIComponent(btoa(regId))}?reqId=client&filterByItems=true`,
        checkinData
      )
      dispatch(checkinFulfilled(idx, checkinUndo, clearSearchOnCheckIn)) // FIXME? should we check resp?
    } catch (err) {
      error(err) // might be a render err
      dispatch(checkinRejected(idx, checkinUndo, err))
    } finally {
      done()
    }
  },
})

export default [checkinLogic]
