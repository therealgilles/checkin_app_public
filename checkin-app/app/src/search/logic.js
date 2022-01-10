import { createLogic } from 'redux-logic'
import debug from 'debug'
import {
  searchUpdateActiveSearchString,
  SEARCH_UPDATE_ACTIVE_SEARCHSTRING_REQUEST,
} from './actions'

debug.enable('search/logic:*')
// const log = debug('search/logic:log')
// const info = debug('search/logic:info')
// const error = debug('search/logic:error')

export const searchLogic = createLogic({
  type: SEARCH_UPDATE_ACTIVE_SEARCHSTRING_REQUEST,
  debounce: 400,
  latest: true, // take latest only

  // validate({ getState, action }, allow, reject) {
  //   if (action.payload) {
  //     allow(action)
  //   } else { // empty request, silently reject
  //     reject()
  //   }
  // },

  process({ action }, dispatch, done) {
    dispatch(searchUpdateActiveSearchString(action.payload))
    done()
  },
})

export default [searchLogic]
