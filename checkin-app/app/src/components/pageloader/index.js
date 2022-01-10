import React from 'react'
import PropTypes from 'prop-types'
import { Loader } from 'semantic-ui-react'

const PageLoader = ({ message }) => (
  <div style={{ width: '100%', height: '100vh' }}>
    <Loader
      active
      inline="centered"
      size="large"
      style={{ zIndex: 3, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}
    >
      {message}
    </Loader>
  </div>
)

PageLoader.propTypes = {
  message: PropTypes.string,
}

PageLoader.defaultProps = {
  message: 'Loading...',
}

export default PageLoader
