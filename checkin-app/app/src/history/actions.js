import debug from 'debug'

debug.enable('history/actions:*')
// const log = debug('history/actions:log')
// const info = debug('history/actions:info')
// const error = debug('history/actions:error')

export const key = 'history'

export const HISTORY_SAVE_ITEM_PATHNAME = 'HISTORY_SAVE_ITEM_PATHNAME'

export const actionTypes = {
  HISTORY_SAVE_ITEM_PATHNAME,
}

export const historySaveItemPathname = pathname => ({ type: HISTORY_SAVE_ITEM_PATHNAME, payload: pathname })

export const actions = {
  historySaveItemPathname,
}
