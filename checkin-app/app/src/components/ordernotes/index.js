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

debug.enable('ordernotes/component:*')
// const log = debug('ordernotes/component:log')
// const info = debug('ordernotes/component:info')
// const error = debug('ordernotes/component:error')

function OrderNotes({
  reg,
  name,
  orderId: sOrderId,
  orderUpdateRequest,
  openAccordion,
  activeSearchString,
}) {
  const onClick = (orderId, noteId) => {
    const idx = `deletenote-${orderId}-${noteId}`
    // log('orderUpdateRequest', idx, reg.id, { orderId, order_note: { id: noteId } })
    orderUpdateRequest(idx, reg.id, { orderId, order_note: { id: noteId } })
  }

  const orderIds = Object.keys(reg.order_notes)
    .filter(orderId => !sOrderId || orderId === sOrderId)
    .filter(orderId => getRegistrantOrderIdsByName(reg.items, reg, name).indexOf(orderId) !== -1)
    .sort((a, b) => a - b)

  return (
    <div>
      {orderIds.map(orderId => (
        <Accordion
          key={`accordion-notes-${orderId}`}
          style={{ lineHeight: '1.4em' }}
          defaultActiveIndex={openAccordion || activeSearchString ? [0] : []}
          exclusive={false}
          panels={[
            {
              key: `order-notes-${orderId}`,
              title: `ORDER ${orderIds.length > 1 ? `#${orderId} ` : ''}NOTES`,
              content: {
                content: (
                  <List>
                    {Object.keys(reg.order_notes[orderId])
                      .sort((a, b) => a - b)
                      .map(noteId => (
                        <List.Item key={noteId}>
                          <Modal
                            trigger={
                              <Icon
                                name={noteId >= 0 ? 'close' : 'circle'}
                                size={noteId >= 0 ? 'small' : 'mini'}
                              />
                            }
                            header="Delete Note"
                            content={
                              <div className="content">
                                Do you want to delete this note?
                                <div style={{ marginTop: '1em' }}>
                                  {reg.order_notes[orderId][noteId]}
                                </div>
                              </div>
                            }
                            actions={[
                              'No',
                              {
                                key: 'delete-note',
                                content: 'Yes, delete it',
                                negative: true,
                                onClick: () => onClick(orderId, noteId),
                              },
                            ]}
                          />
                          <List.Content key={noteId}>
                            {reg.order_notes[orderId][noteId]}
                          </List.Content>
                        </List.Item>
                      ))}
                  </List>
                ),
              },
            },
          ]}
          className="order-notes-accordion"
        />
      ))}
    </div>
  )
}

OrderNotes.propTypes = {
  reg: PropTypes.objectOf(() => true).isRequired,
  name: PropTypes.string.isRequired,
  orderId: PropTypes.string,
  activeSearchString: PropTypes.string.isRequired,
  openAccordion: PropTypes.bool,
  orderUpdateRequest: PropTypes.func.isRequired,
}

OrderNotes.defaultProps = {
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

export default connect(mapStateToProps, mapDispatchToProps)(OrderNotes)
