import debug from 'debug'
import { key, SEARCH_UPDATE_SEARCHSTRING, SEARCH_UPDATE_ACTIVE_SEARCHSTRING } from './actions'

debug.enable('search/reducer:*')
// const log = debug('search/reducer:log')
// const info = debug('search/reducer:info')
// const error = debug('search/reducer:error')

export const selectors = {
  searchString: state => state[key].searchString,
  activeSearchString: state => state[key].activeSearchString,
}

const initialState = {
  searchString: '',
  activeSearchString: '',
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case SEARCH_UPDATE_SEARCHSTRING: {
      return {
        ...state,
        searchString: action.payload,
      }
    }
    case SEARCH_UPDATE_ACTIVE_SEARCHSTRING: {
      return {
        ...state,
        activeSearchString: action.payload,
      }
    }
    default:
      return state
  }
}
