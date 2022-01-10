import React from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Item, Icon } from 'semantic-ui-react'
import { selectors as orderUpdateSelectors } from '../../order'
import { getMatchingUniqueOrderItemKeys } from './helpers'

const RegistrantEditCardItemExtra = ({ reg, name, orderUpdateStatus, orderUpdateErrorData }) => {
  const matchingUniqueOrderItemKeys = getMatchingUniqueOrderItemKeys(reg.items, reg, name)
  if (!matchingUniqueOrderItemKeys.length) {
    return null
  }

  return (
    <Item.Extra>
      {matchingUniqueOrderItemKeys.map(key => (
        <div key={key}>
          {!!(orderUpdateStatus[`cancel-${reg.items[key].id}`] || '').match(/rejected/) && (
            <div style={{ color: 'red' }}>
              <Icon name="exclamation triangle" color="red" />
              CANCEL FAILED:
              {orderUpdateErrorData[`cancel-${reg.items[key].id}`]}
            </div>
          )}
          {!!(orderUpdateStatus[`refund-${reg.items[key].id}`] || '').match(/rejected/) && (
            <div style={{ color: 'red' }}>
              <Icon name="exclamation triangle" color="red" />
              REFUND FAILED:
              {orderUpdateErrorData[`refund-${reg.items[key].id}`]}
            </div>
          )}
          {!!(orderUpdateStatus[`items-${reg.items[key].id}`] || '').match(/rejected/) && (
            <div style={{ color: 'red' }}>
              <Icon name="exclamation triangle" color="red" />
              UPDATE FAILED:
              {orderUpdateErrorData[`items-${reg.items[key].id}`]}
            </div>
          )}
          {!!(orderUpdateStatus[`note-${reg.items[key].id}`] || '').match(/rejected/) && (
            <div style={{ color: 'red' }}>
              <Icon name="exclamation triangle" color="red" />
              ORDER NOTE FAILED:
              {orderUpdateErrorData[`note-${reg.items[key].id}`]}
            </div>
          )}
        </div>
      ))}
    </Item.Extra>
  )
}

RegistrantEditCardItemExtra.propTypes = {
  reg: PropTypes.objectOf(() => true).isRequired,
  name: PropTypes.string.isRequired,
  orderUpdateStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  orderUpdateErrorData: PropTypes.objectOf(PropTypes.string).isRequired,
}

const mapStateToProps = state => ({
  orderUpdateStatus: orderUpdateSelectors.orderUpdateStatus(state),
  orderUpdateErrorData: orderUpdateSelectors.errorData(state),
})

export default connect(mapStateToProps)(RegistrantEditCardItemExtra)
