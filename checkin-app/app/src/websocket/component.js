import React from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Label, Icon, Popup } from 'semantic-ui-react'
import { selectors as wsSelectors } from './reducer'
import './style.css'

const WebSocketIndicator = ({ wsConnected }) => (
  <Popup
    trigger={
      <Label
        {...{
          as: Icon,
          attached: 'top right',
          size: 'large',
          circular: true,
          inverted: true,
          color: wsConnected ? 'teal' : 'red',
          name: 'rss',
          className: 'ws-indicator',
        }}
      />
    }
    offset={[-3, -10]}
    hoverable
    content={wsConnected ? 'server socket connected' : 'server socket disconnected'}
    position="top right"
    size="large"
    inverted
  />
)

WebSocketIndicator.propTypes = {
  wsConnected: PropTypes.bool.isRequired,
}

const mapStateToProps = state => ({
  wsConnected: wsSelectors.wsConnected(state),
})

export default connect(mapStateToProps)(WebSocketIndicator)
