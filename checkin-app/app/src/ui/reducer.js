import {
  key,
  UI_SIDEBAR_TOGGLE_VISIBILITY,
  UI_SIGNED_OUT,
  UI_SAVE_SCROLL_POSITION,
} from './actions'

export const selectors = {
  sidebarVisible: state => state[key].sidebarVisible,
  scrollPosition: state => state[key].scrollPosition,
}

const initialState = {
  sidebarVisible: false,
  scrollPosition: {},
}

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case UI_SIDEBAR_TOGGLE_VISIBILITY:
      return {
        ...state,
        sidebarVisible: !state.sidebarVisible,
      }
    case UI_SIGNED_OUT:
      return {
        ...state,
        sidebarVisible: false,
      }
    case UI_SAVE_SCROLL_POSITION: {
      return {
        ...state,
        scrollPosition: { ...state.scrollPosition, [action.payload[0]]: action.payload[1] },
      }
    }
    default:
      return state
  }
}
