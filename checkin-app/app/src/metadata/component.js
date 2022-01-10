import React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { Button, Icon, Popup } from 'semantic-ui-react'
import { selectors as refreshSelectors } from '../refresh'
import { selectors as metaDataSelectors } from './reducer'
import { actions as metaDataActions } from './actions'
import { isBirthdayThisMonth } from './helpers'
import './style.css'

debug.enable('metadata/component:*')
const log = debug('metadata/component:log')
// const info = debug('metadata/component:info')
// const error = debug('metadata/component:error')

function MetaData({ userId, metaDataStatus, metaDataRequest, users }) {
  // log('userId', userId)
  if (!userId || isNaN(userId) || !users[Number(userId)]) {
    // not corresponding user
    return null
  }

  const onClickFunc = (e, data) => {
    const idx = userId
    const user = users[userId]
    const birthdayVerified = user.birthday_needs_verification ? 'yes' : ''
    log('metaDataRequest', idx, userId, {
      meta: { birthday_verified: birthdayVerified },
    })
    metaDataRequest(idx, userId, {
      meta: { birthday_verified: birthdayVerified },
    })
  }

  const components = []
  const user = users[Number(userId)]
  // log('user', user)
  const metaData = user.meta

  if (
    metaData &&
    metaData.birthday_month_year &&
    isBirthdayThisMonth(metaData.birthday_month_year)
  ) {
    // display birthday cake icon
    components.push(<Icon key="birthday-cake" name="birthday" color="red" />)
  }

  if (!user.birthday_discount) {
    return !components.length ? null : <div className="metadata">{components}</div> // skip if user does not qualify for discount
  }

  const idx = userId
  const metaDataUpdateStatus = metaDataStatus[idx]
  const loading = !!(metaDataUpdateStatus || '').match(/ing/) // FIXME /ing/

  if (!user.birthday_needs_verification) {
    // birthday is already verified, display gift icon, click means unverifying birthday
    components.push(
      <Popup
        key="id-card"
        hoverable
        flowing
        on={['click']}
        trigger={
          <Icon
            size="large"
            name="id card outline"
            color="blue"
            fitted
            loading={loading}
            className="icon-button id-card-icon"
          />
        }
        header="Eligible for discount"
        content={
          <div>
            <div>Do you want to cancel eligibility?</div>
            <div style={{ textAlign: 'center', marginTop: '.5em' }}>
              <Button size="large" onClick={onClickFunc} color="red" basic content="Yes, Cancel" />
            </div>
          </div>
        }
        offset={[-12, 0]}
        className="id-card-popup"
      />
    )
    return <div className="metadata">{components}</div>
  }

  // birthday needs verification, display birth month/year and button to verify it
  components.push(
    <Button
      key="verify-birthday"
      {...{
        basic: true,
        color: 'red',
        size: 'large',
        compact: true,
        onClick: onClickFunc,
        content: `Verify birthday is ${metaData.birthday_month_year}`,
        loading,
      }}
    />
  )

  return <div className="metadata">{components}</div>
}

MetaData.propTypes = {
  userId: PropTypes.string,
  metaDataStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  metaDataRequest: PropTypes.func.isRequired,
  users: PropTypes.objectOf(() => true).isRequired,
}

MetaData.defaultProps = {
  userId: null,
}

const mapStateToProps = state => ({
  metaDataStatus: metaDataSelectors.metaDataStatus(state),
  // metaDataDate: metaDataSelectors.metaDataDate(state),
  // errorData: metaDataSelectors.errorData(state),
  users: refreshSelectors.users(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      metaDataRequest: metaDataActions.metaDataRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(MetaData)
