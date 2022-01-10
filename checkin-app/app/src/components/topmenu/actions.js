// unique key namespace used by combineReducers.
// By convention it will match the directory structure to
// make it easy to locate the src.
// Also action types will prefix with the capitalized version
export const key = 'topmenu'

// action type constants
export const TOPMENU_UPDATE_CONTENT = 'TOPMENU_UPDATE_CONTENT'

export const actionTypes = {
  TOPMENU_UPDATE_CONTENT,
}

// action creators
export const updateTopMenuContent = content => ({ type: TOPMENU_UPDATE_CONTENT, payload: content })

export const actions = {
  updateTopMenuContent,
}
