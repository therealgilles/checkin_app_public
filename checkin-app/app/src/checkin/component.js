import React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { Button } from 'semantic-ui-react'
import { selectors as refreshSelectors } from '../refresh'
import { selectors as checkinSelectors } from './reducer'
import { actions as checkinActions } from './actions'
import { processCheckinRequest, getCheckinInfo } from './helpers'
import './style.css'

debug.enable('checkin/component:*')
// const log = debug('checkin/component:log')
// const info = debug('checkin/component:info')
// const error = debug('checkin/component:error')

function Checkin({ name, regId, checkins, checkinItems, checkinRequest, checkinStatus, settings }) {
  const { idx, content, checkedIn } = getCheckinInfo({
    name,
    regId,
    checkins,
    checkinItems,
  })

  return (
    <Button
      {...{
        basic: checkedIn,
        color: checkedIn ? 'grey' : 'green',
        size: checkedIn ? 'huge' : 'massive',
        compact: true,
        onClick: () =>
          processCheckinRequest({
            name,
            regId,
            checkins,
            checkinItems,
            checkinRequest,
            settings,
          }),
        content,
        loading: !!(checkinStatus[idx] || '').match(/ing/), // FIXME /ing/
        className: 'check-in-button',
      }}
    />
  )
}

Checkin.propTypes = {
  name: PropTypes.string.isRequired,
  regId: PropTypes.string.isRequired,
  checkins: PropTypes.arrayOf(() => true).isRequired,
  checkinItems: PropTypes.arrayOf(() => true).isRequired,
  checkinStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  checkinRequest: PropTypes.func.isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
}

const mapStateToProps = state => ({
  checkinStatus: checkinSelectors.checkinStatus(state),
  // checkinDate: checkinSelectors.checkinDate(state),
  // errorData: checkinSelectors.errorData(state),
  settings: refreshSelectors.settings(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      checkinRequest: checkinActions.checkinRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Checkin)
