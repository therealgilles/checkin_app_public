import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Prompt } from 'react-router'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { Grid, Card, Item, Button, Icon, Confirm, Form } from 'semantic-ui-react'
import queryString from 'query-string'
import { decode as heDecode } from 'html-entities'
import diff from 'deep-diff'
import { selectors as refreshSelectors } from '../../refresh'
import { selectors as historySelectors } from '../../history'
import {
  selectors as orderUpdateSelectors,
  actions as orderUpdateActions,
  component as OrderStatus,
} from '../../order'
import { actions as topMenuActions } from '../topmenu'
import { component as MetaData } from '../../metadata'
import RegistrantCardItemExtra from './RegistrantCardItemExtra'
import RegistrantEditCardItemExtra from './RegistrantEditCardItemExtra'
import RegistrantEditCardOrderTable from './RegistrantEditCardOrderTable'
import BottomMenu from '../bottommenu'
import PageLoader from '../pageloader'
import {
  getRegistrantNamesForLocationIndex,
  getRegistrantOrderIdsByName,
  updateTopMenuTitle,
  objHasKey,
  getRegInfo,
  newRegInfo,
  getValuesProductsInfo,
  debounce,
  getDropDownInfo,
} from './helpers'
import './style.css'

debug.enable('registrants/RegistrantEditCard:*')
// const log = debug('registrants/RegistrantEditCard:log')
const info = debug('registrants/RegistrantEditCard:info')
// const error = debug('registrants/RegistrantEditCard:error')

function RegistrantEditCard({
  items,
  allItems,
  registrants,
  users: propsUsers,
  settings,
  refreshStatus,
  match,
  location,
  historyLastItemPathname,
  orderUpdateRequest,
  orderUpdateStatus,
  updateTopMenuContent,
}) {
  const create = match.path === '/register'
  const defaultRegId = create ? newRegInfo.id : decodeURIComponent(match.params.registrantId)
  const newRegInit = create ? newRegInfo : null
  const query = queryString.parse(location.search)
  const locationIndex = Number(query.index) || 0

  const { reg: defaultReg, regName: defaultRegName, userRoles: defaultUserRoles } = getRegInfo(
    defaultRegId,
    locationIndex,
    newRegInit,
    items,
    registrants,
    propsUsers,
    {
      updateNewReg: true,
    }
  )

  const [loadingExpired, setLoadingExpired] = useState(!create)
  const [loadingTimeout, setLoadingTimeout] = useState(null)
  const [dropDownLoading, setDropDownLoading] = useState(create)
  const [updateDisabledUser, setUpdateDisabledUser] = useState(create)
  const [updateDisabledDiscount, setUpdateDisabledDiscount] = useState(false)
  const [values, setValues] = useState({})
  const [defaultValues, setDefaultValues] = useState({})
  const [orderDiscount, setOrderDiscount] = useState({})
  const [updateRegistrantConfirmOpen, setUpdateRegistrantConfirmOpen] = useState(false)
  const [regId, setRegId] = useState(defaultRegId)
  const [regName, setRegName] = useState(defaultRegName)
  const [userRoles, setUserRoles] = useState(defaultUserRoles)
  const [newReg, setNewReg] = useState(create ? defaultReg : null)
  const [newUser, setNewUser] = useState({
    firstname: null,
    lastname: null,
    email: null,
  })
  const [users, setUsers] = useState({})
  const [usersOptions, setUsersOptions] = useState([])
  const [prevRefreshStatus, setPrevRefreshStatus] = useState(refreshStatus)
  const pageLoadingDelay = 2000

  const defaultNewReg = create ? newReg : null

  useEffect(() => {
    // log('useEffect #1')
    const { reg } = getRegInfo(regId, locationIndex, defaultNewReg, items, registrants, propsUsers)

    if (reg) {
      const names = getRegistrantNamesForLocationIndex(reg, create, locationIndex)
      const newDefaultValues = {}
      names.forEach(name => {
        const orderIds = getRegistrantOrderIdsByName(reg.items, reg, name)
        const { dropDownDefaultValueAll } = getDropDownInfo(
          reg,
          name,
          orderIds,
          create,
          {},
          items,
          allItems
        )
        Object.keys(dropDownDefaultValueAll).forEach(orderId => {
          newDefaultValues[orderId] = dropDownDefaultValueAll[orderId]
        })
      })

      if (diff(defaultValues, newDefaultValues)) {
        // log('useEffect: new defaultValues/values', newDefaultValues)
        // If default values have changed (from a props update), we reset values to match
        setDefaultValues(newDefaultValues)
        setValues(newDefaultValues)
      }
    }
  })

  useEffect(() => {
    if (!create) return

    // log('useEffect setDropdownUsersOptions')
    const newUsersOptions = Object.keys(propsUsers)
      .filter(userId => propsUsers[userId].firstname && propsUsers[userId].lastname)
      .sort((a, b) => {
        const userA = propsUsers[a]
        const userB = propsUsers[b]
        const userBName = `${userA.lastname}, ${userA.firstname} / ${userA.email}`.toLowerCase()
        const userAName = `${userB.lastname}, ${userB.firstname} / ${userB.email}`.toLowerCase()
        return userAName > userBName ? -1 : 0
      })
      .map((userId, index) => {
        const user = propsUsers[userId]
        return {
          key: index,
          value: userId,
          text: heDecode(`${user.lastname}, ${user.firstname} / ${user.email}`),
        }
      })

    setUsers(propsUsers)
    setUsersOptions(newUsersOptions)
    setDropDownLoading(false)
  }, [propsUsers, create])

  useEffect(() => {
    // log('useEffect #2')
    updateTopMenuTitle(updateTopMenuContent, regName)
    if (!loadingExpired) {
      setLoadingTimeout(
        setTimeout(() => loadingTimeout && setLoadingExpired(true), pageLoadingDelay)
      )
    }

    return () => {
      clearTimeout(loadingTimeout)
      setLoadingTimeout(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // log('useEffect #3')
    const { regName: newRegName } = getRegInfo(
      regId,
      locationIndex,
      newReg,
      items,
      registrants,
      propsUsers
    )
    // log('useEffect', regId, regName, newReg)
    updateTopMenuTitle(updateTopMenuContent, newRegName)

    // If we have an order status update, reset corresponding values to defaultValues
    const orderIds = []
    const newRefreshStatus = { ...prevRefreshStatus }
    for (const orderId of Object.keys(defaultValues)) {
      const refreshStatusId = `#${orderId}`
      if (diff(prevRefreshStatus[refreshStatusId], refreshStatus[refreshStatusId])) {
        orderIds.push(orderId)
        newRefreshStatus[refreshStatusId] = refreshStatus[refreshStatusId]
      }
    }
    if (orderIds.length) {
      const newValues = JSON.parse(JSON.stringify(values)) // deep copy
      orderIds.forEach(orderId => {
        newValues[orderId] = defaultValues[orderId]
      })
      // log('useEffect', newValues)
      setValues(newValues)
      setPrevRefreshStatus(newRefreshStatus)
    }
  })

  const getTotal = ({ localReg, localValues, localUserRoles }) => {
    const orderId = Object.keys(localReg.total)[0]
    // log('getTotal getValuesProductsInfo', allItems, userRoles)
    const { orderTotal } = getValuesProductsInfo(localValues[orderId], allItems, localUserRoles)
    return { orderId, orderTotal }
  }

  const onOrderTableChange = ({
    values: localValues,
    orderDiscount: localOrderDiscount,
    userRoles: localUserRoles,
  }) => {
    // log('RegistrantEditCard onOrderTableChange', { localValues })

    if (create) {
      const localReg = { ...newReg }

      if (localValues) {
        // log('newReg', newReg)
        const { orderId, orderTotal } = getTotal({ localReg, localValues, localUserRoles })
        if (orderTotal !== localReg.total[orderId]) localReg.total = { [orderId]: orderTotal }
      }

      if (localOrderDiscount) {
        const orderId = Object.keys(localReg.discount_total)[0]
        localReg.discount_total = {}
        localReg.discount_total[orderId] = localOrderDiscount[orderId] || '0'
        const localUpdateDisabledDiscount =
          objHasKey(localReg.total, orderId) &&
          Number(localReg.discount_total[orderId]) > localReg.total[orderId]
        setUpdateDisabledDiscount(localUpdateDisabledDiscount)
        setOrderDiscount(localOrderDiscount)
      }

      setNewReg(localReg)
    }

    if (localValues) setValues(localValues)
    if (localUserRoles) setUserRoles(localUserRoles)
  }

  const updateRegistrantConfirmShow = () => {
    setUpdateRegistrantConfirmOpen(true)
  }

  const updateRegistrantConfirmHide = () => {
    setUpdateRegistrantConfirmOpen(false)
  }

  const updateRegistrant = () => {
    // defaultValues: original items ('quantity x productId')
    // values: updated items (either 'quantity x productId' or '#number productId')
    // log('updateRegistrant', defaultValues, values)
    const changes = {}
    const prices = {}

    // gather original values
    Object.keys(defaultValues).forEach(orderId => {
      // log('updateRegistrant getValuesProductsInfo 1', allItems)
      const { info: productsInfo } = getValuesProductsInfo(
        defaultValues[orderId],
        allItems,
        userRoles
      )
      changes[orderId] || (changes[orderId] = {})
      prices[orderId] || (prices[orderId] = {})
      Object.keys(productsInfo).forEach(productId => {
        changes[orderId][productId] || (changes[orderId][productId] = 0)
        changes[orderId][productId] -= productsInfo[productId].quantity
        prices[orderId][productId] = productsInfo[productId].price
      })
    })

    // process updated values (subtract from original quantities)
    Object.keys(values).forEach(orderId => {
      // log('updateRegistrant getValuesProductsInfo 2', allItems)
      const { info: productsInfo } = getValuesProductsInfo(values[orderId], allItems, userRoles)
      changes[orderId] || (changes[orderId] = {})
      prices[orderId] || (prices[orderId] = {})
      Object.keys(productsInfo).forEach(productId => {
        changes[orderId][productId] || (changes[orderId][productId] = 0)
        changes[orderId][productId] += productsInfo[productId].quantity
        prices[orderId][productId] = productsInfo[productId].price
      })
      Object.keys(changes[orderId]).forEach(productId => {
        if (changes[orderId][productId] === 0) {
          delete changes[orderId][productId]
          delete prices[orderId][productId]
        }
      })
    })

    Object.keys(changes).forEach(orderId => {
      if (!Object.keys(changes[orderId]).length) {
        delete changes[orderId]
        delete prices[orderId]
      }
    })
    // log('updateRegistrant', changes, prices)

    let orderCreate
    let registrantId = regId
    if (create) {
      let user
      if (objHasKey(propsUsers, regId)) {
        user = { id: regId }
      } else {
        user = { ...newUser }
        registrantId = user.email.toLowerCase() // force user email to lowercase
      }
      orderCreate = {
        create,
        user,
        userRoles,
      }
    }

    Object.keys(changes).forEach(orderId => {
      let localOrderCreate
      if (orderCreate) {
        localOrderCreate = JSON.parse(JSON.stringify(orderCreate)) // deep copy
        localOrderCreate.total = newReg.total[orderId]
        if (Number(newReg.total[orderId]) === Number(newReg.discount_total[orderId])) {
          localOrderCreate.set_paid = true
        }
        if (newReg.discount_total[orderId] && Number(newReg.discount_total[orderId])) {
          localOrderCreate.discount_total = newReg.discount_total[orderId]
        }
      }
      info(
        'Order update request: orderId',
        orderId,
        'changes',
        changes[orderId],
        prices[orderId],
        localOrderCreate
      )
      orderUpdateRequest(`items-${orderId}`, registrantId, {
        orderId,
        items: {
          changes: changes[orderId],
          prices: prices[orderId],
        },
        ...localOrderCreate,
      })
    })

    updateRegistrantConfirmHide()
  }

  const userDropdownChange = (evt, data) => {
    const newRegId = data.value || newRegInfo.id // reset ID if dropdown value is empty

    const { reg, regName: newRegName, userRoles: newUserRoles } = getRegInfo(
      newRegId,
      locationIndex,
      newReg,
      items,
      registrants,
      propsUsers,
      {
        updateNewReg: true,
      }
    )
    const localUpdateDisabledUser = reg.id === newRegInfo.id
    // restore discount
    reg.discount_total = JSON.parse(JSON.stringify(newReg.discount_total))
    // recalculate total based on user roles
    // log('userDropdownChange', values)
    const { orderId, orderTotal } = getTotal({
      localReg: newReg,
      localValues: values,
      localUserRoles: newUserRoles,
    })
    reg.total = { [orderId]: orderTotal }
    const localUpdateDisabledDiscount = Number(reg.discount_total[orderId]) > reg.total[orderId]

    // log('userDropdownChange', regName, userRoles)
    updateTopMenuTitle(updateTopMenuContent, newRegName)

    setRegId(newRegId)
    setRegName(newRegName)
    setNewReg(reg)
    setUpdateDisabledUser(localUpdateDisabledUser)
    setUpdateDisabledDiscount(localUpdateDisabledDiscount)
    setUserRoles(newUserRoles)
  }

  const onUserChange = field =>
    debounce((evt, data) => {
      const localNewUser = { ...newUser, [field]: data.value }
      const localUpdateDisabledUser = !(
        localNewUser.firstname &&
        localNewUser.lastname &&
        localNewUser.email
      )
      setNewUser(localNewUser)
      setUpdateDisabledUser(localUpdateDisabledUser)
    }, 500)

  if (!loadingExpired && Object.keys(registrants).length === 0) {
    return (
      <Grid
        textAlign="center"
        verticalAlign="middle"
        style={{ height: '100vh', alignItems: 'center' }}
      >
        <PageLoader />
      </Grid>
    )
  }

  const { reg } = getRegInfo(regId, locationIndex, defaultNewReg, items, registrants, users)

  if (!reg) return null

  // FIXME: this can probably be done better
  const regItems = reg.items // no filtering here
  const orderUpdateStatuses = name => {
    const orderIds = getRegistrantOrderIdsByName(regItems, reg, name)
    return orderIds.map(orderId => orderUpdateStatus[`items-${orderId}`]).join('')
  }

  const hideEmail = settings.uiRegistrants && settings.uiRegistrants.hideEmailAddress
  const updateDisabledItems = !diff(values, defaultValues)
  const updateDisabled = updateDisabledItems || updateDisabledUser || updateDisabledDiscount
  const usersDefaultValue = objHasKey(users, regId) ? regId : null

  const names = getRegistrantNamesForLocationIndex(reg, create, locationIndex)

  return (
    <div className={create ? 'registrant-edit-card-create' : 'registrant-edit-card'}>
      <Grid
        container
        verticalAlign="middle"
        style={{
          minHeight: '100vh',
          marginTop: 'auto',
          marginBottom: 'auto',
          paddingTop: '5rem',
          paddingBottom: '5rem',
        }}
        className="registrant-edit-card-grid grid-container-wide"
      >
        <Prompt
          when={!updateDisabled}
          message="You have unsaved changes. Are you sure you want to leave?"
        />
        <Grid.Row>
          <Grid.Column width={16}>
            <Card fluid raised>
              <Card.Content>
                <Grid
                  container
                  verticalAlign="middle"
                  divided="vertically"
                  className="registrant-edit-card-content-grid"
                >
                  {names.map(name => (
                    <Grid.Row key={create ? 'create' : name}>
                      <Grid.Column width={16}>
                        <Item.Group>
                          <Item>
                            <Item.Image
                              size="small"
                              shape="circular"
                              src={reg.avatar}
                              as={Link}
                              to={historyLastItemPathname}
                            />
                            <Item.Content
                              verticalAlign="middle"
                              className="registrant-card-content"
                            >
                              <Button
                                floated="right"
                                color="green"
                                size="massive"
                                compact
                                disabled={updateDisabled}
                                onClick={updateRegistrantConfirmShow}
                                loading={
                                  !!(orderUpdateStatuses(name) || '').match(/ing/) /* FIXME /ing/ */
                                }
                                className="update-button"
                              >
                                <Icon name="save" />
                                {`${create ? 'Create' : 'Update'}`}
                              </Button>
                              <Confirm
                                size="fullscreen"
                                content={`Are you sure you want to ${
                                  create ? 'create this order' : 'update the registrant order(s)'
                                }?`}
                                open={updateRegistrantConfirmOpen}
                                onCancel={updateRegistrantConfirmHide}
                                onConfirm={updateRegistrant}
                                confirmButton={`Yes, ${create ? 'Create' : 'Update'}`}
                                cancelButton="No"
                              />
                              <Item.Header style={{ width: '80%' }}>
                                <div className="registrant-name-form">
                                  <Form size="big">
                                    <Form.Group>
                                      {!create || usersDefaultValue ? (
                                        <Form.Field width={8}>
                                          <div className="registrant-name">{heDecode(name)}</div>
                                        </Form.Field>
                                      ) : (
                                        [1].map(() => {
                                          const rows = [
                                            <Form.Input
                                              width={4}
                                              key="firstname"
                                              placeholder="First name"
                                              onChange={onUserChange('firstname')}
                                              tabIndex={0}
                                            />,
                                            <Form.Input
                                              width={4}
                                              key="lastname"
                                              placeholder="Last name"
                                              onChange={onUserChange('lastname')}
                                              tabIndex={0}
                                            />,
                                          ]
                                          return rows
                                        })
                                      )}
                                      {!create ? null : (
                                        <Form.Dropdown
                                          width={8}
                                          className="select-user"
                                          deburr
                                          selection
                                          search
                                          clearable
                                          placeholder="Guest"
                                          lazyLoad
                                          loading={dropDownLoading}
                                          options={usersOptions}
                                          value={usersDefaultValue}
                                          onChange={userDropdownChange}
                                          selectOnBlur={false}
                                          selectOnNavigation={false}
                                          tabIndex={1 /* eslint-disable-line */}
                                        />
                                      )}
                                    </Form.Group>
                                    {!create || usersDefaultValue ? null : (
                                      <Form.Group className="registrant-email-form">
                                        <Form.Input
                                          width={8}
                                          placeholder="Email"
                                          onChange={onUserChange('email')}
                                          tabIndex={0}
                                        />
                                      </Form.Group>
                                    )}
                                  </Form>
                                </div>
                              </Item.Header>
                              <Item.Meta>
                                {!(!create || usersDefaultValue) ? null : (
                                  <div
                                    style={{ display: hideEmail ? 'none' : 'inline-block' }}
                                    className="registrant-email-id"
                                  >
                                    {reg.email || reg.id}
                                  </div>
                                )}
                                <MetaData key={reg.id} userId={reg.id.toString()} />
                                {Object.keys(reg.order_status)
                                  .filter(
                                    orderId =>
                                      getRegistrantOrderIdsByName(regItems, reg, name).indexOf(
                                        orderId
                                      ) !== -1
                                  )
                                  .map(orderId => (
                                    <OrderStatus
                                      key={orderId}
                                      reg={reg}
                                      orderId={Number(orderId)}
                                    />
                                  ))}
                              </Item.Meta>
                              <Item.Description style={{ marginTop: '1rem' }}>
                                <RegistrantEditCardOrderTable
                                  reg={reg}
                                  name={name}
                                  orderIds={getRegistrantOrderIdsByName(regItems, reg, name)}
                                  values={values}
                                  defaultValues={defaultValues}
                                  onOrderTableChange={onOrderTableChange}
                                  userRoles={userRoles}
                                  create={create}
                                  orderDiscount={orderDiscount}
                                />
                              </Item.Description>
                              <RegistrantCardItemExtra reg={reg} name={name} />
                              <RegistrantEditCardItemExtra reg={reg} name={name} />
                            </Item.Content>
                          </Item>
                        </Item.Group>
                      </Grid.Column>
                    </Grid.Row>
                  ))}
                </Grid>
              </Card.Content>
            </Card>
          </Grid.Column>
        </Grid.Row>
      </Grid>
      <BottomMenu
        itemTitle={`${create ? 'New' : 'Edit'} Registration`}
        buttonTitle="Back"
        buttonLink={historyLastItemPathname}
        buttonClassName="another-class-button"
      />
    </div>
  )
}

RegistrantEditCard.propTypes = {
  items: PropTypes.objectOf(() => true).isRequired,
  allItems: PropTypes.objectOf(() => true).isRequired,
  registrants: PropTypes.objectOf(() => true).isRequired,
  users: PropTypes.objectOf(() => true).isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
  refreshStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  match: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  location: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  historyLastItemPathname: PropTypes.string.isRequired,
  orderUpdateRequest: PropTypes.func.isRequired,
  orderUpdateStatus: PropTypes.objectOf(PropTypes.string).isRequired,
  updateTopMenuContent: PropTypes.func.isRequired,
}

const mapStateToProps = state => ({
  items: refreshSelectors.items(state),
  allItems: refreshSelectors.allItems(state),
  registrants: refreshSelectors.registrants(state),
  users: refreshSelectors.users(state),
  settings: refreshSelectors.settings(state),
  refreshStatus: refreshSelectors.refreshStatus(state),
  historyLastItemPathname: historySelectors.historyLastItemPathname(state),
  orderUpdateStatus: orderUpdateSelectors.orderUpdateStatus(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      orderUpdateRequest: orderUpdateActions.orderUpdateRequest,
      updateTopMenuContent: topMenuActions.updateTopMenuContent,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(RegistrantEditCard)
