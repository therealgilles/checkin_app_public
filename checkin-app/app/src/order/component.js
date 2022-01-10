import React from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { Button, Icon, Popup } from 'semantic-ui-react'
import { selectors as orderSelectors } from './reducer'
import { actions as orderActions } from './actions'
import './style.css'

debug.enable('order/component:*')
const log = debug('order/component:log')
// const info = debug('order/component:info')
// const error = debug('order/component:error')

function OrderStatus({ reg, orderId, orderUpdateStatus, orderUpdateRequest, hideWhenPaid }) {
  const onClickFunc = (e, data) => {
    const idx = `orderstatus-${orderId}`
    const status = reg.order_status[orderId] === 'completed' ? 'processing' : 'completed'
    log('orderUpdateRequest', idx, reg.id, { orderId, order_status: status })
    orderUpdateRequest(idx, reg.id, { orderId, order_status: status })
  }

  const components = []
  const orderStatus = reg.order_status[orderId]
  const orderPayByCash = (reg.payment_method[orderId] || '').match(/cod/i)
  const multipleOrders = Object.keys(reg.order_status).length > 1
  const orderCompleted = !!orderStatus.match(/completed/i)

  if (((hideWhenPaid || !orderPayByCash) && orderCompleted) || orderStatus === 'new') {
    return null
  }

  const idx = `orderstatus-${orderId}`
  const loading = !!(orderUpdateStatus[idx] || '').match(/ing/) // FIXME /ing/

  if (orderCompleted) {
    const iconName = orderPayByCash ? 'money' : 'list'

    components.push(
      <Popup
        key="order-status"
        hoverable
        flowing
        on={['click']}
        trigger={
          <Icon
            size="large"
            name={iconName}
            color="green"
            fitted
            loading={loading}
            className="icon-button order-status-icon"
          />
        }
        header={`Order ${orderStatus.toLowerCase()}`}
        content={
          <div>
            <div>Do you want to change the order status to processing?</div>
            <div style={{ textAlign: 'center', marginTop: '.5em' }}>
              <Button
                size="large"
                onClick={onClickFunc}
                color="red"
                basic
                content="Yes, change to processing"
              />
            </div>
          </div>
        }
        offset={[-12, 0]}
        className="order-status-popup"
      />
    )
    return <div className="order-status">{components}</div>
  }

  const content = orderCompleted
    ? 'Change to processing'
    : `${multipleOrders ? `Order #${orderId}: mark as paid` : 'Mark as paid'}`

  components.push(
    <Button
      key="order-status-button"
      {...{
        basic: true,
        color: 'red',
        size: 'large',
        compact: true,
        onClick: onClickFunc,
        content,
        loading,
      }}
    />
  )

  return <div className="order-status">{components}</div>
}

OrderStatus.propTypes = {
  reg: PropTypes.objectOf(() => true).isRequired,
  orderId: PropTypes.number.isRequired,
  orderUpdateStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  orderUpdateRequest: PropTypes.func.isRequired,
  hideWhenPaid: PropTypes.bool,
}

OrderStatus.defaultProps = {
  hideWhenPaid: false,
}

const mapStateToProps = state => ({
  orderUpdateStatus: orderSelectors.orderUpdateStatus(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      orderUpdateRequest: orderActions.orderUpdateRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(OrderStatus)
