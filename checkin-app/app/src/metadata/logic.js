import { createLogic } from 'redux-logic'
import debug from 'debug'
import { metaDataFulfilled, metaDataRejected, METADATA_REQUEST, METADATA_CANCEL } from './actions'

debug.enable('metadata/logic:*')
// const log = debug('metadata/logic:log')
// const info = debug('metadata/logic:info')
const error = debug('metadata/logic:error')

// const delay = 4 // 4s delay for interactive use of cancel/take latest

export const metaDataLogic = createLogic({
  type: METADATA_REQUEST,
  cancelType: METADATA_CANCEL,
  // latest: true, // take latest only

  // use axios injected as httpClient from configureStore logic deps
  // we also have access to getState and action in the first argument
  // but they were not needed for this particular code
  async process({ httpClient, getState, action }, dispatch, done) {
    const idx = action.payload[0]
    const userId = action.payload[1] // user ID
    const userData = action.payload[2] // user data

    try {
      await httpClient.put(`/api/users/${encodeURIComponent(userId)}?reqId=client`, userData)
      dispatch(metaDataFulfilled(idx)) // FIXME? should we check resp?
    } catch (err) {
      error(err) // might be a render err
      dispatch(metaDataRejected(idx, err))
    } finally {
      done()
    }
  },
})

export default [
  metaDataLogic,
]
