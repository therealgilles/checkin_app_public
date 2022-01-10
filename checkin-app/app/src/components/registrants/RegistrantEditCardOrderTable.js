import React, { useState } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import debug from 'debug'
import {
  Dropdown,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Label,
  Confirm,
  Icon,
  Checkbox,
  TextArea,
  Transition,
} from 'semantic-ui-react'
import { selectors as refreshSelectors, component as Refresh } from '../../refresh'
import { selectors as orderUpdateSelectors, actions as orderUpdateActions } from '../../order'
import OrderNotes from '../ordernotes'
import OrderRefunds from '../orderrefunds'
import {
  getDropDownInfo,
  debounce,
  renderLabel,
  objHasKey,
  getValuesProductsInfo,
  regUserExists,
  getUserRoles,
} from './helpers'

debug.enable('registrants/RegistrantEditCardOrderTable:*')
// const log = debug('registrants/RegistrantEditCardOrderTable:log')
const info = debug('registrants/RegistrantEditCardOrderTable:info')
// const error = debug('registrants/RegistrantEditCardOrderTable:error')

function RegistrantEditCardOrderTable({
  create,
  reg,
  name,
  items,
  allItems,
  users,
  values,
  defaultValues,
  settings,
  orderIds,
  userRoles,
  orderDiscount,
  onOrderTableChange,
  orderUpdateRequest,
  orderUpdateStatus,
}) {
  const [cancelOrderModalOpen, setCancelOrderModalOpen] = useState({})
  const [cancelOrderConfirmOpen, setCancelOrderConfirmOpen] = useState({})
  const [refundOrderModalOpen, setRefundOrderModalOpen] = useState({})
  const [refundOrderConfirmOpen, setRefundOrderConfirmOpen] = useState({})
  const [refundAmount, setRefundAmount] = useState({})
  const [refundReason, setRefundReason] = useState({})
  const [orderNoteModalOpen, setOrderNoteModalOpen] = useState({})
  const [orderNoteContent, setOrderNoteContent] = useState({})
  const [orderNotePublic, setOrderNotePublic] = useState({})
  const [sendStoreCredit, setSendStoreCredit] = useState({})
  const [storeCreditAmount, setStoreCreditAmount] = useState({})
  const [storeCreditMessage, setStoreCreditMessage] = useState({})

  const defaultMessage = 'Hi,\n\n'
    .concat('Here is the store credit for your (now cancelled) registration. ')
    .concat('You can use it towards purchases on our website. It is valid for 6 months.')
    .concat('\n\nThe Staff')
  const discountOptions = [
    { key: 'default', text: 'default', value: 'default' },
    { key: '24__under', text: '24 & under', value: '24__under' },
    { key: 'senior', text: 'senior', value: 'senior' },
  ]

  const onChange = (data, orderId) => {
    const localValues = JSON.parse(JSON.stringify(values)) // deep copy
    if (data) localValues[orderId] = data.value.sort()

    const { orderValues } = getValuesProductsInfo(localValues[orderId], allItems)
    localValues[orderId] = orderValues

    // log('onChange', localValues)
    onOrderTableChange({ values: localValues, userRoles })
  }

  const updateOrderDiscount = orderId =>
    debounce((evt, data) => {
      const discount = data.value
      const newOrderDiscount = { ...orderDiscount }
      if (discount !== '' && !isNaN(discount) && Number(discount) >= 0) {
        newOrderDiscount[orderId] = discount
      } else {
        delete newOrderDiscount[orderId]
        // log(newOrderDiscount)
      }

      onOrderTableChange({ orderDiscount: newOrderDiscount })
      // log('updateOrderDiscount', newOrderDiscount, discount)
    }, 500)

  const modalStateChange = (key, orderId, value) => {
    const obj = { ...[key] }
    obj[orderId] = value

    if (key === 'cancelOrderConfirmOpen') setCancelOrderConfirmOpen(obj)
    if (key === 'cancelOrderModalOpen') setCancelOrderModalOpen(obj)
    if (key === 'refundOrderConfirmOpen') setRefundOrderConfirmOpen(obj)
    if (key === 'refundOrderModalOpen') setRefundOrderModalOpen(obj)
    if (key === 'orderNoteModalOpen') setOrderNoteModalOpen(obj)
  }

  const open = (key, orderId) => modalStateChange(key, orderId, true)
  const close = (key, orderId) => modalStateChange(key, orderId, false)

  const cancelOrder = orderId => {
    info('cancelling order', orderId)
    close('cancelOrderConfirmOpen', orderId)
    close('cancelOrderModalOpen', orderId)

    const storeCredit = {}
    if (sendStoreCredit[orderId]) {
      storeCredit.credit_amount = storeCreditAmount[orderId]
      storeCredit.credit_message = storeCreditMessage[orderId]
      storeCredit.credit_date_expires = dayjs().add(6, 'M').format('YYYY-MM-DD') // 6 months from now
      info('sending store credit', { ...storeCredit })
    }

    orderUpdateRequest(`cancel-${orderId}`, reg.id, {
      orderId,
      order_status: 'cancelled',
      ...storeCredit,
    })
  }

  const updateRefundAmount = (evt, data, orderId) => {
    setRefundAmount({ ...refundAmount, [orderId]: data.value }) // shallow copy is enough
  }

  const updateRefundReason = (evt, data, orderId) => {
    setRefundReason({ ...refundReason, [orderId]: data.value }) // shallow copy is enough
  }

  const refundOrder = orderId => {
    close('refundOrderConfirmOpen', orderId)
    close('refundOrderModalOpen', orderId)
    const refund = {
      amount: refundAmount[orderId],
      reason: refundReason[orderId],
    }
    const refundData = { orderId, refund }
    info('refunding order', orderId, reg.id, refundData)
    orderUpdateRequest(`refund-${orderId}`, reg.id, refundData)
  }

  const updateOrderNoteContent = (evt, data, orderId) => {
    const newOrderNoteContent = { ...orderNoteContent, [orderId]: data.value } // shallow copy is enough
    setOrderNoteContent(newOrderNoteContent)
  }

  const updateOrderNotePublic = (evt, data, orderId) => {
    const newOrderNotePublic = { ...orderNotePublic, [orderId]: data.checked } // shallow copy is enough
    setOrderNotePublic(newOrderNotePublic)
  }

  const addOrderNote = orderId => {
    close('orderNoteModalOpen', orderId)
    const note = orderNoteContent[orderId]
    const customerNote = orderNotePublic[orderId]
    const orderData = {
      orderId,
      order_note: { note, customer_note: customerNote || false },
    }
    info('adding order note', orderId, reg.id, orderData)
    orderUpdateRequest(`addnote-${orderId}`, reg.id, orderData)
  }

  const updateSendStoreCredit = (evt, data, orderId, orderTotal) => {
    setSendStoreCredit({ ...sendStoreCredit, [orderId]: data.checked }) // shallow copy is enough

    if (sendStoreCredit[orderId]) {
      // fill store credit amount if empty
      const newStoreCreditAmount = { ...storeCreditAmount }
      if (!objHasKey(newStoreCreditAmount, orderId)) {
        newStoreCreditAmount[orderId] = orderTotal.toString()
        setStoreCreditAmount(newStoreCreditAmount)
      }

      // fill store credit message if empty
      const newStoreCreditMessage = { ...storeCreditMessage }
      if (!objHasKey(newStoreCreditMessage, orderId)) {
        newStoreCreditMessage[orderId] = defaultMessage
        setStoreCreditMessage(newStoreCreditMessage)
      }
    }
  }

  const updateStoreCreditAmount = (evt, data, orderId) => {
    setStoreCreditAmount({ ...storeCreditAmount, [orderId]: data.value }) // shallow copy is enough
  }

  const updateStoreCreditMessage = (evt, data, orderId) => {
    setStoreCreditMessage({ ...storeCreditMessage, [orderId]: data.value }) // shallow copy is enough
  }

  const discountDropdownChange = (evt, data) => {
    // log('discountDropdownChange', data.value)
    const newUserRoles = data.value === 'default' ? [] : [data.value]
    onOrderTableChange({ values, userRoles: newUserRoles })
  }

  if (!reg) return null

  // log('... reg.items', reg.items)
  // log('... items', items)

  const { dropDownDefaultValue, dropDownOptions, dropDownKey } = getDropDownInfo(
    reg,
    name,
    orderIds,
    create,
    values,
    items,
    allItems
  )

  let discountDefaultValue = 'default'
  let discountDropdownDisabled = false
  if (create) {
    const userExists = regUserExists(reg, users)
    const predefinedUserRoles = getUserRoles(reg, users)
    discountDropdownDisabled = userExists && !!predefinedUserRoles.length

    if (userRoles.includes('24__under')) discountDefaultValue = '24__under'
    if (userRoles.includes('senior')) discountDefaultValue = 'senior'
    // log('discountDefaultValue', userRoles, discountDefaultValue)
  }

  return (
    <Table
      collapsing
      structured
      celled
      compact
      textAlign="center"
      className="registrant-edit-card-order-table"
    >
      <Table.Header>
        <Table.Row>
          {create ? null : (
            <Table.HeaderCell className="table-order-id">Order&nbsp;ID</Table.HeaderCell>
          )}
          <Table.HeaderCell className="table-order-items">Items</Table.HeaderCell>
          <Table.HeaderCell className="table-order-total">Total</Table.HeaderCell>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {Object.keys(reg.total)
          .filter(orderId => orderIds.indexOf(orderId) !== -1)
          .map(orderId => {
            const rows = [
              <Table.Row key={orderId}>
                {orderId === '999999' ? null : (
                  <Table.Cell>
                    <div className="cell-with-button">
                      <div className="cell-with-button-text">
                        {`#${orderId}`}
                        &nbsp;&nbsp;
                        <Refresh
                          componentType="circular button"
                          idx={`#${orderId}`}
                          refreshEndpoints={[
                            {
                              endpoint: `refresh/orders/${orderId}`,
                              query: 'filterByItems=true',
                            },
                          ]}
                          popupProps={{ offset: [-17, 0], size: 'huge' }}
                        />
                        &nbsp;&nbsp;
                        <Modal
                          open={orderNoteModalOpen[orderId]}
                          onClose={() => close('orderNoteModalOpen', orderId)}
                          trigger={
                            <Icon.Group onClick={() => open('orderNoteModalOpen', orderId)}>
                              <Icon name="sticky note outline" flipped="vertically" fitted />
                              <Icon corner name="add" />
                            </Icon.Group>
                          }
                        >
                          <Modal.Header>{`Add Order Note #${orderId}`}</Modal.Header>
                          <Modal.Content>
                            <Form>
                              <Form.Field>
                                <Checkbox
                                  label="Note to customer"
                                  checked={orderNotePublic[orderId]}
                                  onClick={(evt, data) => updateOrderNotePublic(evt, data, orderId)}
                                />
                              </Form.Field>
                              <Form.Field required>
                                <label htmlFor="order_note_content">Order Note</label>
                                <Input
                                  id="order_note_content"
                                  placeholder="write your note here"
                                  onChange={(evt, data) =>
                                    updateOrderNoteContent(evt, data, orderId)
                                  }
                                />
                              </Form.Field>
                            </Form>
                          </Modal.Content>
                          <Modal.Actions>
                            <Button
                              disabled={!orderNoteContent[orderId]}
                              color="green"
                              onClick={() => addOrderNote(orderId)}
                            >
                              Add Order Note
                            </Button>
                            <Button
                              color="blue"
                              icon="arrow right"
                              labelPosition="right"
                              content="Back"
                              onClick={() => close('orderNoteModalOpen', orderId)}
                            />
                          </Modal.Actions>
                        </Modal>
                      </div>
                      {!reg.cancellable[orderId] || reg.order_status[orderId].match(/trash/) ? (
                        <Button
                          size="huge"
                          compact
                          basic
                          color="red"
                          disabled
                          style={{ display: 'none' }}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <Modal
                          size="fullscreen"
                          open={cancelOrderModalOpen[orderId]}
                          onClose={() => close('cancelOrderModalOpen', orderId)}
                          trigger={
                            <Button
                              size="huge"
                              compact
                              basic
                              color="red"
                              onClick={() => open('cancelOrderModalOpen', orderId)}
                              loading={
                                !!(orderUpdateStatus[`cancel-${orderId}`] || '').match(
                                  /ing/ /* FIXME /ing/ */
                                )
                              }
                            >
                              Cancel
                            </Button>
                          }
                        >
                          <Modal.Header>{`Cancel Order #${orderId}`}</Modal.Header>
                          <Modal.Content>
                            <p>
                              Are you sure you want to cancel this order? Make sure you proceed any
                              refunds first.
                            </p>
                            {!settings.uiRegistrants.supportStoreCredit ? null : (
                              <Form>
                                {Number(reg.total[orderId]) === 0 ? null : (
                                  <Form.Field>
                                    <Checkbox
                                      label="Send store credit to customer"
                                      checked={sendStoreCredit[orderId]}
                                      onClick={(evt, data) =>
                                        updateSendStoreCredit(
                                          evt,
                                          data,
                                          orderId,
                                          reg.total[orderId]
                                        )
                                      }
                                    />
                                  </Form.Field>
                                )}
                                <Transition.Group duration={200}>
                                  {sendStoreCredit[orderId] && (
                                    <div>
                                      <Form.Field required disabled={!sendStoreCredit[orderId]}>
                                        <label htmlFor="store_credit_amount">
                                          Specify the store credit amount
                                        </label>
                                        <Input
                                          labelPosition="left"
                                          placeholder="0.00"
                                          defaultValue={reg.total[orderId]}
                                          onChange={(evt, data) =>
                                            updateStoreCreditAmount(evt, data, orderId)
                                          }
                                        >
                                          <Label basic style={{ paddingTop: '1em' }}>
                                            $
                                          </Label>
                                          <input id="store_credit_amount" />
                                        </Input>
                                      </Form.Field>
                                      <Form.Field required disabled={!sendStoreCredit[orderId]}>
                                        <label htmlFor="store_credit_message">
                                          Store Credit Message
                                        </label>
                                        <TextArea
                                          id="store_credit_message"
                                          placeholder="write your message here"
                                          defaultValue={defaultMessage}
                                          onChange={(evt, data) =>
                                            updateStoreCreditMessage(evt, data, orderId)
                                          }
                                        />
                                      </Form.Field>
                                    </div>
                                  )}
                                </Transition.Group>
                              </Form>
                            )}
                          </Modal.Content>
                          <Modal.Actions>
                            <Button
                              disabled={
                                !sendStoreCredit[orderId]
                                  ? false
                                  : !storeCreditAmount[orderId] ||
                                    Number(storeCreditAmount[orderId]) <= 0 ||
                                    !storeCreditMessage[orderId]
                              }
                              color="red"
                              onClick={() => open('cancelOrderConfirmOpen', orderId)}
                            >
                              Cancel Order
                              {sendStoreCredit[orderId] && ' & Send Credit'}
                            </Button>
                            <Confirm
                              size="fullscreen"
                              content="Are you sure? Cancelling an order does not refund it."
                              open={cancelOrderConfirmOpen[orderId]}
                              onCancel={() => close('cancelOrderConfirmOpen', orderId)}
                              onConfirm={() => cancelOrder(orderId)}
                              confirmButton="Yes, Cancel"
                              cancelButton="No"
                            />
                            <Button
                              color="blue"
                              icon="arrow right"
                              labelPosition="right"
                              content="Back"
                              onClick={() => close('cancelOrderModalOpen', orderId)}
                            />
                          </Modal.Actions>
                        </Modal>
                      )}
                    </div>
                  </Table.Cell>
                )}
                <Table.Cell>
                  {/* added key to trigger render on reg items change */}
                  <Dropdown
                    key={dropDownKey[orderId]}
                    className="registrant-edit-card-dropdown"
                    placeholder="Choose items"
                    multiple
                    scrolling
                    selection
                    fluid
                    closeOnChange
                    search
                    options={dropDownOptions[orderId]}
                    value={dropDownDefaultValue[orderId]}
                    onChange={(evt, data) => onChange(data, orderId)}
                    renderLabel={label => renderLabel(label, orderId, defaultValues[orderId])}
                  />
                </Table.Cell>
                <Table.Cell>
                  <div className="cell-with-button">
                    <div className="cell-with-button-text">
                      <div className="order-total">{`$${reg.total[orderId]}`}</div>
                      {!create ? null : (
                        <Input
                          className="order-discount"
                          label="Discount"
                          labelPosition="left"
                          error={Number(reg.discount_total[orderId]) > Number(reg.total[orderId])}
                          defaultValue={reg.discount_total[orderId]}
                          onChange={updateOrderDiscount(orderId)}
                          input={<input size="3" />}
                          size="small"
                          action={
                            <Dropdown
                              key={discountDefaultValue}
                              button
                              basic
                              floating
                              options={discountOptions}
                              defaultValue={discountDefaultValue}
                              disabled={discountDropdownDisabled}
                              onChange={discountDropdownChange}
                            />
                          }
                        />
                      )}
                    </div>
                    {!reg.refundable[orderId] || reg.refundable[orderId].toString() === '1' ? (
                      ''
                    ) : (
                      <Button size="huge" compact basic disabled>
                        {
                          reg.refundable[orderId].replace(
                            /\s/g,
                            '\u00a0'
                          ) /* keep blank spaces insecable */
                        }
                      </Button>
                    )}
                    {!reg.refundable[orderId] || reg.refundable[orderId].toString() !== '1' ? (
                      ''
                    ) : (
                      <Modal
                        size="fullscreen"
                        open={refundOrderModalOpen[orderId]}
                        onClose={() => close('refundOrderModalOpen', orderId)}
                        trigger={
                          <Button
                            size="huge"
                            compact
                            basic
                            color="green"
                            onClick={() => open('refundOrderModalOpen', orderId)}
                            loading={
                              !!(orderUpdateStatus[`refund-${orderId}`] || '').match(
                                /ing/ /* FIXME /ing/ */
                              )
                            }
                          >
                            Refund
                          </Button>
                        }
                      >
                        <Modal.Header>{`Refund Order #${orderId}`}</Modal.Header>
                        <Modal.Content>
                          <Form>
                            <Form.Field required>
                              <label htmlFor="refund_amount">Specify the refund amount</label>
                              <Input
                                labelPosition="left"
                                placeholder="0.00"
                                onChange={(evt, data) => updateRefundAmount(evt, data, orderId)}
                              >
                                <Label basic style={{ paddingTop: '1em' }}>
                                  $
                                </Label>
                                <input id="refund_amount" />
                              </Input>
                            </Form.Field>
                            <Form.Field required>
                              <label htmlFor="refund_reason">
                                Specify the reason for the refund
                              </label>
                              <Input
                                id="refund_reason"
                                placeholder="reason for the refund"
                                onChange={(evt, data) => updateRefundReason(evt, data, orderId)}
                              />
                            </Form.Field>
                          </Form>
                        </Modal.Content>
                        <Modal.Actions>
                          <Button
                            disabled={
                              !refundAmount[orderId] ||
                              Number(refundAmount[orderId]) <= 0 ||
                              !refundReason[orderId]
                            }
                            color="green"
                            onClick={() => open('refundOrderConfirmOpen', orderId)}
                          >
                            Refund Order
                          </Button>
                          <Confirm
                            size="fullscreen"
                            content="Are you sure you want to refund this order?"
                            open={refundOrderConfirmOpen[orderId]}
                            onCancel={() => close('refundOrderConfirmOpen', orderId)}
                            onConfirm={() => refundOrder(orderId)}
                            confirmButton="Yes, Refund"
                            cancelButton="No"
                          />
                          <Button
                            color="blue"
                            icon="arrow right"
                            labelPosition="right"
                            content="Back"
                            onClick={() => close('refundOrderModalOpen', orderId)}
                          />
                        </Modal.Actions>
                      </Modal>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>,
            ]
            if (reg.refunds[orderId]) {
              rows.push(
                <Table.Row key={reg.refunds[orderId]}>
                  <Table.Cell colSpan="3" className="registrant-edit-card-refunds">
                    <OrderRefunds
                      style={{ marginTop: 0 }}
                      reg={reg}
                      name={name}
                      orderId={orderId}
                      openAccordion
                    />
                  </Table.Cell>
                </Table.Row>
              )
            }
            if (reg.order_notes[orderId]) {
              rows.push(
                <Table.Row key={reg.order_notes[orderId]}>
                  <Table.Cell colSpan="3" className="registrant-edit-card-order-notes">
                    <OrderNotes
                      style={{ marginTop: 0 }}
                      reg={reg}
                      name={name}
                      orderId={orderId}
                      openAccordion
                    />
                  </Table.Cell>
                </Table.Row>
              )
            }
            if (reg.customer_note[orderId]) {
              rows.push(
                <Table.Row key={reg.customer_note[orderId]}>
                  <Table.Cell colSpan="3">
                    Note:&nbsp;
                    {reg.customer_note[orderId]}
                  </Table.Cell>
                </Table.Row>
              )
            }
            return rows
          })}
      </Table.Body>
    </Table>
  )
}

RegistrantEditCardOrderTable.propTypes = {
  items: PropTypes.objectOf(() => true).isRequired,
  allItems: PropTypes.objectOf(() => true).isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
  reg: PropTypes.objectOf(() => true).isRequired,
  name: PropTypes.string.isRequired,
  onOrderTableChange: PropTypes.func.isRequired,
  orderUpdateRequest: PropTypes.func.isRequired,
  orderUpdateStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  create: PropTypes.bool.isRequired,
  userRoles: PropTypes.arrayOf(() => true).isRequired,
  users: PropTypes.objectOf(() => true).isRequired,
  values: PropTypes.objectOf(() => true).isRequired,
  defaultValues: PropTypes.objectOf(() => true).isRequired,
  orderDiscount: PropTypes.objectOf(() => true).isRequired,
  orderIds: PropTypes.arrayOf(() => true).isRequired,
}

const mapStateToProps = state => ({
  items: refreshSelectors.items(state),
  allItems: refreshSelectors.allItems(state),
  settings: refreshSelectors.settings(state),
  orderUpdateStatus: orderUpdateSelectors.orderUpdateStatus(state),
  users: refreshSelectors.users(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      orderUpdateRequest: orderUpdateActions.orderUpdateRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(RegistrantEditCardOrderTable)
