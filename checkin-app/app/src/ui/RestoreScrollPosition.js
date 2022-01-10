import { useState, useLayoutEffect } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { actions as uiActions } from './actions'
import { selectors as uiSelectors } from './reducer'
import { selectors as authSelectors } from '../auth'
import { store } from '../store'

debug.enable('ui/RestoreScrollPosition:*')
// const log = debug('ui/RestoreScrollPosition:log')
// const info = debug('ui/RestoreScrollPosition:info')
// const error = debug('ui/RestoreScrollPosition:error')

function RestoreScrollPosition({ scrollPosition, saveScrollPosition, restoreScrollPosition }) {
  const [pathname, setPathName] = useState('')

  useLayoutEffect(() => {
    const windowPathname = window.location.pathname
    // log('restore', windowPathname, scrollPosition[windowPathname])
    restoreScrollPosition(windowPathname, scrollPosition[windowPathname])
    // log('save pathname', windowPathname)
    setPathName(windowPathname)

    return () => {
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      const position = { x: scrollX, y: scrollY }
      // log('saveScrollPosition', pathname, position)
      const authenticated = authSelectors.authenticated(store.getState())
      if (authenticated) saveScrollPosition(pathname, position)
    }
  }, [pathname, restoreScrollPosition, saveScrollPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

RestoreScrollPosition.propTypes = {
  saveScrollPosition: PropTypes.func.isRequired,
  restoreScrollPosition: PropTypes.func.isRequired,
  scrollPosition: PropTypes.objectOf(() => true).isRequired,
}

const mapStateToProps = state => ({
  scrollPosition: uiSelectors.scrollPosition(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      saveScrollPosition: uiActions.saveScrollPosition,
      restoreScrollPosition: uiActions.restoreScrollPosition,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(RestoreScrollPosition)
