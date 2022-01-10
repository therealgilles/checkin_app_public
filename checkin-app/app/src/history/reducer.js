import { key, HISTORY_SAVE_ITEM_PATHNAME } from './actions'

export const selectors = {
  historyLastItemPathname: state => state[key].historyLastItemPathname,
}

const initialState = {
  historyLastItemPathname: '/',
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case HISTORY_SAVE_ITEM_PATHNAME: {
      return {
        ...state,
        historyLastItemPathname: action.payload,
      }
    }
    default:
      return state
  }
}
