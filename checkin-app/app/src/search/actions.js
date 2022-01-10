import debug from 'debug'
import { store } from '../store'
import { focusSearchInputField } from './helpers'

debug.enable('search/actions:*')
// const log = debug('search/actions:log')
// const info = debug('search/actions:info')
// const error = debug('search/actions:error')

// unique key namespace used by combineReducers.
// By convention it will match the directory structure to
// make it easy to locate the src.
// Also action types will prefix with the capitalized version
export const key = 'search'

// action type constants
export const SEARCH_UPDATE_SEARCHSTRING = 'SEARCH_UPDATE_SEARCHSTRING'
export const SEARCH_UPDATE_ACTIVE_SEARCHSTRING_REQUEST =
  'SEARCH_UPDATE_ACTIVE_SEARCHSTRING_REQUEST'
export const SEARCH_UPDATE_ACTIVE_SEARCHSTRING =
  'SEARCH_UPDATE_ACTIVE_SEARCHSTRING'

export const actionTypes = {
  SEARCH_UPDATE_SEARCHSTRING,
  SEARCH_UPDATE_ACTIVE_SEARCHSTRING_REQUEST,
  SEARCH_UPDATE_ACTIVE_SEARCHSTRING,
}

// action creators
export const searchUpdateSearchString = (ev, { value }) => {
  store.dispatch({
    type: SEARCH_UPDATE_ACTIVE_SEARCHSTRING_REQUEST,
    payload: value,
  })
  focusSearchInputField()
  return {
    type: SEARCH_UPDATE_SEARCHSTRING,
    payload: value, // search string
  }
}
export const searchUpdateActiveSearchString = value => ({
  type: SEARCH_UPDATE_ACTIVE_SEARCHSTRING,
  payload: value, // active search string
})

export const actions = {
  searchUpdateSearchString,
  searchUpdateActiveSearchString,
}
