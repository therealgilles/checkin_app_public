import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PropTypes from 'prop-types'
import { decode as heDecode } from 'html-entities'
import debug from 'debug'
import { Grid, Card, Label, Item, Icon, Loader, Visibility, Button } from 'semantic-ui-react'
import { component as Checkin, actions as checkinActions } from '../../checkin'
import { component as MetaData } from '../../metadata'
import { selectors as refreshSelectors } from '../../refresh'
import { component as OrderStatus } from '../../order'
import OrderNotes from '../ordernotes'
import RegistrantCardItemExtra from './RegistrantCardItemExtra'
import Attendance from '../attendance'
import { processCheckinRequest } from '../../checkin/helpers'
import {
  getRegistrantNames,
  getRegistrantItemAttrs,
  stripItemName,
  getRegistrantItemKeysByName,
  getItemAttrsClassName,
  getRegistrantCheckinsByName,
  getRegistrantRegItemsByName,
  getRegistrantOrderIdsByName,
  getCheckinWeek,
  itemsKeysSort,
} from './helpers'

debug.enable('registrants/RegistrantCard:*')
// const log = debug('registrants/RegistrantCard:log')
// const info = debug('registrants/RegistrantCard:info')
// const error = debug('registrants/RegistrantCard:error')

function RegistrantCard({ reg, checkinRequest, settings }) {
  const [loading, setLoading] = useState(true)

  const onClickFunc = (name, regId, checkins, checkinItems) =>
    processCheckinRequest({
      name,
      regId,
      checkins,
      checkinItems,
      checkinRequest,
      settings,
    })

  const getRegEditCardLink = index =>
    `/registrants/${encodeURIComponent(reg.id)}${index ? `?index=${index}` : ''}`

  const hideEmail = settings.uiRegistrants && settings.uiRegistrants.hideEmailAddress
  const hideAttendance = settings.uiItems && settings.uiItems.itemsWithoutEvents

  if (loading) {
    return (
      <Card fluid style={{ backgroundColor: 'rgba(255, 255, 255, 0.75)' }}>
        <Card.Content className="registrant-card loading">
          <Visibility
            fireOnMount
            once={false}
            continuous
            onOnScreen={() => {
              setLoading(false)
            }}
            style={{ flexGrow: '1' }}
          >
            <Loader className="registrant-card-loader" active inline="centered" size="large" />
          </Visibility>
        </Card.Content>
      </Card>
    )
  }

  return (
    <Card fluid>
      <Card.Content className="registrant-card loaded">
        <Visibility
          fireOnMount
          once={false}
          onOffScreen={() => {
            // setLoading(true) // FIXME: should we unload the content?
          }}
          style={{ flexGrow: '1' }}
        >
          <Grid container verticalAlign="middle" divided="vertically">
            {getRegistrantNames(reg).map((name, index) => (
              <Grid.Row key={name}>
                <Grid.Column computer={12} tablet={11} mobile={16}>
                  <Item.Group>
                    <Item>
                      <Item.Image
                        size="small"
                        shape="circular"
                        src={reg.avatar}
                        as={Link}
                        to={getRegEditCardLink(index)}
                      />
                      <Item.Content verticalAlign="middle" className="registrant-card-content">
                        <Item.Header>
                          <div className="registrant-name">{heDecode(name)}</div>
                        </Item.Header>
                        <Item.Meta>
                          <div
                            style={{
                              display: hideEmail ? 'none' : 'inline-block',
                            }}
                            className="registrant-email-id"
                          >
                            {index !== 0 ? '' : reg.email || reg.id}
                          </div>
                          <MetaData key={reg.id} userId={reg.id.toString()} />
                          {Object.keys(reg.order_status)
                            .filter(
                              orderId =>
                                getRegistrantOrderIdsByName(reg.items, reg, name).indexOf(
                                  orderId
                                ) !== -1
                            )
                            .map(orderId => (
                              <OrderStatus
                                key={orderId}
                                reg={reg}
                                orderId={Number(orderId)}
                                hideWhenPaid={settings.uiRegistrants.hideOrderStatusWhenPaid}
                              />
                            ))}
                          <OrderNotes style={{ marginTop: '0.5em' }} reg={reg} name={name} />
                        </Item.Meta>
                        <Item.Description>
                          <Label.Group size="medium" className="item-label-group">
                            {/* FIXME: should we sort the items by event start date instead if it exists? */}
                            {getRegistrantItemKeysByName(reg.items, reg, name)
                              .sort(itemsKeysSort(reg.items))
                              .filter(key => reg.items[key].item_quantity !== 0)
                              .map(key => (
                                <div key={key} className="item-labels">
                                  <Label
                                    className="item-label item-label-button"
                                    as={Button}
                                    onClick={() =>
                                      onClickFunc(
                                        name,
                                        reg.id.toString(),
                                        [
                                          getRegistrantCheckinsByName(
                                            reg.checkins,
                                            { [key]: reg.items[key] },
                                            reg,
                                            name
                                          ),
                                        ],
                                        [
                                          getRegistrantRegItemsByName(
                                            { [key]: reg.items[key] },
                                            reg,
                                            name
                                          ),
                                        ]
                                      )
                                    }
                                  >
                                    {!reg.checkins[reg.items[key].checkin_key] ? (
                                      ''
                                    ) : (
                                      <Icon name="checkmark" />
                                    )}
                                    {reg.items[key].item_quantity === 1 ? (
                                      ''
                                    ) : (
                                      <div style={{ display: 'inline' }}>
                                        {`${reg.items[key].item_quantity} x `}
                                      </div>
                                    )}
                                    <div
                                      style={{ display: 'inline' }}
                                      className="mobile screen-hidden tablet screen-hidden"
                                    >
                                      {getCheckinWeek(reg.items[key].checkin_key) &&
                                        `${getCheckinWeek(reg.items[key].checkin_key)} – `}
                                    </div>
                                    <div
                                      style={{ display: 'inline' }}
                                      className="mobile screen-hidden tablet screen-hidden"
                                    >
                                      {stripItemName(reg.items[key].item_name)}
                                    </div>
                                    <div
                                      style={{ display: 'inline' }}
                                      className="mobile screen-only tablet screen-only"
                                    >
                                      {stripItemName(reg.items[key].item_name).replace(
                                        /^.*20\d\d /,
                                        ''
                                      )}
                                    </div>
                                  </Label>
                                  {!Object.values(getRegistrantItemAttrs(reg, key)).length ? (
                                    ''
                                  ) : (
                                    <div style={{ display: 'inline' }}>
                                      <Label
                                        basic
                                        className={`item-label tablet screen-hidden mobile screen-hidden ${getItemAttrsClassName(
                                          reg,
                                          key
                                        )}`}
                                      >
                                        <div>
                                          {Object.values(getRegistrantItemAttrs(reg, key))
                                            .map(attrVal => `${attrVal.join(', ')}`)
                                            .join(' – ')}
                                        </div>
                                      </Label>
                                      <Label
                                        basic
                                        className={`item-label mobile screen-only tablet screen-only ${getItemAttrsClassName(
                                          reg,
                                          key
                                        )}`}
                                      >
                                        <div>
                                          {Object.values(getRegistrantItemAttrs(reg, key))
                                            .map(
                                              attrVal =>
                                                `${attrVal
                                                  .map(s => {
                                                    if (s.match(/follower|leader|solo/i))
                                                      return s[0] // abbreviate role on small screens
                                                    return s
                                                  })
                                                  .join(', ')}`
                                            )
                                            .join(' – ')}
                                        </div>
                                      </Label>
                                    </div>
                                  )}
                                  {hideAttendance ? (
                                    ''
                                  ) : (
                                    <Label basic className="item-label item-label-attendance">
                                      <Attendance reg={reg} regItemKey={key} name={name} />
                                    </Label>
                                  )}
                                </div>
                              ))}
                          </Label.Group>
                        </Item.Description>
                        <RegistrantCardItemExtra reg={reg} name={name} />
                      </Item.Content>
                    </Item>
                  </Item.Group>
                </Grid.Column>
                <Grid.Column computer={4} tablet={5} mobile={16} textAlign="center">
                  <Checkin
                    name={name}
                    regId={reg.id.toString()}
                    checkins={[getRegistrantCheckinsByName(reg.checkins, reg.items, reg, name)]}
                    checkinItems={[getRegistrantRegItemsByName(reg.items, reg, name)]}
                  />
                </Grid.Column>
              </Grid.Row>
            ))}
          </Grid>
        </Visibility>
      </Card.Content>
    </Card>
  )
}

RegistrantCard.propTypes = {
  reg: PropTypes.objectOf(() => true).isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
  checkinRequest: PropTypes.func.isRequired,
}

const mapStateToProps = state => ({
  settings: refreshSelectors.settings(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      checkinRequest: checkinActions.checkinRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(RegistrantCard)
