import React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Button, Message, Icon, Grid, Popup } from 'semantic-ui-react'
import debug from 'debug'
import { selectors as refreshSelectors } from './reducer'
import {
  actions as refreshActions,
  stateIndexes,
  refreshEndpoints as refreshEndpointsDefault,
} from './actions'
import { getRefreshButtonMsg } from './helpers'
import './style.css'

debug.enable('refresh/component:*')
// const log = debug('refresh/component:log')
// const info = debug('refresh/component:info')
// const error = debug('refresh/component:error')

function Refresh({
  componentType,
  idx,
  popupProps,
  iconProps,
  buttonProps,
  buttonName,
  refreshStatus,
  refreshRequest,
  refreshCancel,
  refreshDate,
  refreshEndpoints,
  errorData,
}) {
  const onClickFunc = () => {
    // log('onClickFunc', idx, refreshStatus[idx])
    if (refreshStatus[idx] === 'refreshing') {
      refreshCancel(idx)
    } else {
      const refreshType =
        idx === stateIndexes.REFRESH_IDX_BUTTON_REFRESH ? 'refresh' : 'skipRefresh'
      refreshRequest(idx, refreshType, refreshEndpoints)
    }
  }

  const { button, message } = getRefreshButtonMsg(
    idx,
    stateIndexes,
    refreshStatus,
    refreshDate,
    errorData
  )

  if (componentType === 'circular button') {
    return (
      <Popup
        hoverable
        flowing
        on={['click']}
        trigger={
          <Icon
            fitted
            loading={message.loading}
            className="refresh-circular-button"
            {...(message.text.match(/fail|cancel/) && { color: 'red' })}
            {...{ ...{ name: 'refresh' }, ...iconProps }}
          />
        }
        header={message.header}
        content={
          <div>
            <div>{message.text}</div>
            <div style={{ textAlign: 'center', marginTop: '.5em' }}>
              <Button
                size="large"
                {...buttonProps}
                onClick={onClickFunc}
                content={message.loading ? 'Cancel' : buttonName || 'Refresh'}
              />
            </div>
          </div>
        }
        {...popupProps}
      />
    )
  }

  return (
    <Grid container>
      <Grid.Column computer={4} tablet={4} mobile={16} verticalAlign="middle" textAlign="center">
        <Button onClick={onClickFunc} content={button.content[idx]} disabled={button.disabled} />
      </Grid.Column>
      <Grid.Column computer={12} tablet={12} mobile={16}>
        <Message {...message.props} icon>
          {message.loading && <Icon name="circle notched" loading={message.loading} />}
          <Message.Content>
            <Message.Header>{message.header}</Message.Header>
            <p>{message.text}</p>
          </Message.Content>
        </Message>
      </Grid.Column>
    </Grid>
  )
}

Refresh.propTypes = {
  componentType: PropTypes.string,
  idx: PropTypes.string.isRequired,
  popupProps: PropTypes.objectOf(() => true),
  iconProps: PropTypes.objectOf(() => true),
  buttonProps: PropTypes.objectOf(() => true),
  buttonName: PropTypes.string,
  refreshEndpoints: PropTypes.arrayOf(() => true),
  refreshStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  refreshDate: PropTypes.objectOf(PropTypes.string).isRequired,
  errorData: PropTypes.objectOf(PropTypes.string).isRequired,
  refreshRequest: PropTypes.func.isRequired,
  refreshCancel: PropTypes.func.isRequired,
}

Refresh.defaultProps = {
  componentType: '',
  popupProps: {},
  iconProps: {},
  buttonProps: {},
  buttonName: '',
  refreshEndpoints: refreshEndpointsDefault,
}

const mapStateToProps = state => ({
  refreshStatus: refreshSelectors.refreshStatus(state),
  refreshDate: refreshSelectors.refreshDate(state),
  errorData: refreshSelectors.errorData(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      refreshRequest: refreshActions.refreshRequest,
      refreshCancel: refreshActions.refreshCancel,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Refresh)
