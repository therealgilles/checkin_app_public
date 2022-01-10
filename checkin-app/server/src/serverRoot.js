import debug from 'debug'
import React from 'react'
import { Provider } from 'react-redux'
import { StaticRouter } from 'react-router'
import PropTypes from 'prop-types'
import config from './config'
import App from 'AppSrc/components/app'
import 'AppSrc/index.css'

config.debug && debug.enable('serverRoot:*')
// const log = debug('serverRoot:log')
// const info = debug('serverRoot:info')
// const error = debug('serverRoot:error')

const ServerRoot = ({ store, context, location }) => (
  <Provider store={store}>
    <StaticRouter context={context} location={location}>
      <App />
    </StaticRouter>
  </Provider>
)

ServerRoot.propTypes = {
  store: PropTypes.objectOf(() => true).isRequired,
  context: PropTypes.objectOf(() => true).isRequired,
  location: PropTypes.string.isRequired,
}

export default ServerRoot
