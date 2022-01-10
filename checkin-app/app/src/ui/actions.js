import { polyfill as smoothScrollPolyfill } from 'smoothscroll-polyfill'
import debug from 'debug'
import { actionTypes as authActionTypes } from '../auth'

debug.enable('ui/actions:*')
// const log = debug('ui/actions:log')
// const info = debug('ui/actions:info')
// const error = debug('ui/actions:error')

export const key = 'ui'

export const UI_SIDEBAR_TOGGLE_VISIBILITY = 'UI_SIDEBAR_TOGGLE_VISIBILITY'
export const UI_SIGNED_OUT = authActionTypes.AUTH_SIGNED_OUT
export const UI_SAVE_SCROLL_POSITION = 'UI_SAVE_SCROLL_POSITION'
export const UI_RESTORE_SCROLL_POSITION = 'UI_RESTORE_SCROLL_POSITION'
export const UI_RESTORE_SCROLL_WRONG_LOCATION = 'UI_RESTORE_SCROLL_WRONG_LOCATION'

export const actionTypes = {
  UI_SIDEBAR_TOGGLE_VISIBILITY,
  UI_SIGNED_OUT,
  UI_SAVE_SCROLL_POSITION,
  UI_RESTORE_SCROLL_POSITION,
  UI_RESTORE_SCROLL_WRONG_LOCATION,
}

const isServer = !process.browser
if (!isServer) smoothScrollPolyfill()

export const sidebarToggleVisibility = () => ({
  type: UI_SIDEBAR_TOGGLE_VISIBILITY,
})
export const saveScrollPosition = (pathname, position) => ({
  type: UI_SAVE_SCROLL_POSITION,
  payload: [pathname, position],
})
export const restoreScrollPosition = (pathname, position) => {
  if (window.location.pathname === pathname) {
    const { x, y } = position || { x: 0, y: 0 }
    // log('scrollTo', x, y)
    window.scrollTo({ top: y, left: x, behavior: 'auto' })
    return { type: UI_RESTORE_SCROLL_POSITION }
  }
  return { type: UI_RESTORE_SCROLL_WRONG_LOCATION }
}

export const actions = {
  sidebarToggleVisibility,
  saveScrollPosition,
  restoreScrollPosition,
}
