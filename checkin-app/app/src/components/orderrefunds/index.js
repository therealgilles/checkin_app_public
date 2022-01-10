import React from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { List, Accordion, Icon, Modal } from 'semantic-ui-react'
import { selectors as searchSelectors } from '../../search'
import { actions as orderUpdateActions } from '../../order'
import { getRegistrantOrderIdsByName } from '../registrants/helpers'
import './style.css'

debug.enable('orderrefunds/component:*')
// const log = debug('orderrefunds/component:log')
// const info = debug('orderrefunds/component:info')
// const error = debug('orderrefunds/component:error')

function OrderRefunds({
  reg,
  name,
  orderId: sOrderId,
  orderUpdateRequest,
  openAccordion,
  activeSearchString,
}) {
  const onClick = (orderId, refundId) => {
    const idx = `deleterefund-${orderId}-${refundId}`
    // log('orderUpdateRequest', idx, reg.id, { orderId, refund: { id: refundId } })
    orderUpdateRequest(idx, reg.id, { orderId, refund: { id: refundId } })
  }

  const orderIds = Object.keys(reg.refunds)
    .filter(orderId => !sOrderId || orderId === sOrderId)
    .filter(orderId => getRegistrantOrderIdsByName(reg.items, reg, name).indexOf(orderId) !== -1)
    .sort((a, b) => a - b)

  return (
    <div>
      {orderIds.map(orderId => (
        <Accordion
          key={`accordion-refunds-${orderId}`}
          style={{ lineHeight: '1.4em' }}
          defaultActiveIndex={openAccordion || activeSearchString ? [0] : []}
          exclusive={false}
          panels={[
            {
              key: `order-refunds-${orderId}`,
              title: `REFUNDS${orderIds.length > 1 ? ` #${orderId}` : ''}`,
              content: {
                content: (
                  <List>
                    {Object.keys(reg.refunds[orderId])
                      .sort((a, b) => a - b)
                      .map(refundId => (
                        <List.Item key={refundId}>
                          <Modal
                            trigger={
                              <Icon
                                name={refundId >= 0 ? 'close' : 'circle'}
                                size={refundId >= 0 ? 'small' : 'mini'}
                              />
                            }
                            header="Delete Refund"
                            content={
                              <div className="content">
                                Do you want to delete this refund?
                                <div style={{ marginTop: '1em' }}>
                                  {reg.refunds[orderId][refundId]}
                                </div>
                              </div>
                            }
                            actions={[
                              'No',
                              {
                                key: 'delete-refund',
                                content: 'Yes, delete it',
                                negative: true,
                                onClick: () => onClick(orderId, refundId),
                              },
                            ]}
                          />
                          <List.Content key={refundId}>
                            <em>
                              ${reg.refunds[orderId][refundId].total}
                              {reg.refunds[orderId][refundId].refund
                                ? ` - ${reg.refunds[orderId][refundId].refund}`
                                : ''}
                            </em>
                          </List.Content>
                        </List.Item>
                      ))}
                  </List>
                ),
                key: 'order-refunds',
              },
            },
          ]}
          className="order-refunds-accordion"
        />
      ))}
    </div>
  )
}

OrderRefunds.propTypes = {
  reg: PropTypes.objectOf(() => true).isRequired,
  name: PropTypes.string.isRequired,
  orderId: PropTypes.string,
  activeSearchString: PropTypes.string.isRequired,
  openAccordion: PropTypes.bool,
  orderUpdateRequest: PropTypes.func.isRequired,
}

OrderRefunds.defaultProps = {
  openAccordion: false,
  orderId: null,
}

const mapStateToProps = state => ({
  activeSearchString: searchSelectors.activeSearchString(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      orderUpdateRequest: orderUpdateActions.orderUpdateRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(OrderRefunds)
