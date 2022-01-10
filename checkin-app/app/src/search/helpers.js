import debug from 'debug'

debug.enable('search/helpers:*')
// const log = debug('search/helpers:log')
// const info = debug('search/helpers:info')
// const error = debug('search/helpers:error')

let searchInputFieldRef

export const onClick = fn => () => fn(null, { value: '' })

export const onKeyDown = fn => ev => {
  if (ev.key === 'Escape' || ev.keyCode === 27) {
    fn(null, { value: '' })
    return
  }
  focusSearchInputField()
}

let searchInputFieldRefTimeout
export const focusSearchInputField = () => {
  searchInputFieldRef &&
    (searchInputFieldRefTimeout = setTimeout(() => searchInputFieldRef.focus(), 100))
}

let focusSearchInputFieldOnStartTimeout
export const focusSearchInputFieldOnStart = input => {
  searchInputFieldRef = input
  input && (focusSearchInputFieldOnStartTimeout = setTimeout(() => input.focus(), 100))
}

export const clearSearchInputFieldTimeouts = () => {
  clearTimeout(searchInputFieldRefTimeout)
  clearTimeout(focusSearchInputFieldOnStartTimeout)
}
