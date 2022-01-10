import React, { useState, useEffect } from 'react'
import { Prompt } from 'react-router'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Grid, Checkbox, Button, Segment, Statistic, Label, Dropdown } from 'semantic-ui-react'
import ThemedStyleSheet from 'react-with-styles/lib/ThemedStyleSheet'
import aphroditeInterface from 'react-with-styles-interface-aphrodite'
import DefaultTheme from 'react-dates/lib/theme/DefaultTheme'
import { DateRangePicker } from 'react-dates'
import 'react-dates/lib/css/_datepicker.css'
import debug from 'debug'
import { RestoreScrollPosition } from '../../ui'
import { component as Refresh, stateIndexes, selectors as refreshSelectors } from '../../refresh'
import { actions as websocketActions } from '../../websocket'
import { itemsSort, itemsIfEvent } from '../../refresh/helpers'
import { actions as topMenuActions } from '../topmenu'
import {
  dateStringToMoment,
  momentToDateString,
  getButtonDisabled,
  getCheckBoxTitle,
  stringSort,
} from './helpers'
import { objHasKey } from '../registrants/helpers'
import './style.css'

debug.enable('settings/index:*')
// const log = debug('settings/index:log')
// const info = debug('settings/index:info')
// const error = debug('settings/index:error')

ThemedStyleSheet.registerInterface(aphroditeInterface)
ThemedStyleSheet.registerTheme({
  reactDates: {
    ...DefaultTheme.reactDates,
    zIndex: 4,
    font: {
      ...DefaultTheme.reactDates.font,
      input: {
        ...DefaultTheme.reactDates.font.input,
        size_small: '1em',
      },
    },
    spacing: {
      ...DefaultTheme.reactDates.spacing,
      // displayTextPaddingTop_small: 7,
      // displayTextPaddingBottom_small: 3,
    },
  },
})

let currentAppVersion // stored current app version

function Settings({
  allItems,
  users,
  registrants,
  refreshStatus,
  settings: propsSettings,
  updateTopMenuContent,
  msgSend,
}) {
  const [settings, setSettings] = useState(propsSettings)
  const [focusedInput, setFocusedInput] = useState(null)

  useEffect(() => {
    updateTopMenuContent(<div className="top-menu-title">Settings</div>)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSettings(propsSettings)
  }, [propsSettings])

  const updateEventsDates = ({ startDate, endDate }) => {
    const newSettings = {
      ...settings,
      events: {
        ...settings.events,
        start_date: momentToDateString(startDate),
        end_date: momentToDateString(endDate),
      },
    }
    setSettings(newSettings)
  }

  const updateItemsDeselected = (item, checked) => {
    const newSettings = {
      ...settings,
      itemsDeselected: {
        ...settings.itemsDeselected,
      },
    }

    if (checked) {
      delete newSettings.itemsDeselected[item.slug]
      item.product && delete newSettings.itemsDeselected[item.product.id]
      // special treatment for summer/resolution swing 2018 and earlier
      Object.values(allItems).forEach(i => {
        if (item.slug !== i.slug && i.slug.match(new RegExp(item.slug))) {
          delete newSettings.itemsDeselected[i.slug]
          i.product && delete newSettings.itemsDeselected[i.product.id]
        }
      })
    } else {
      newSettings.itemsDeselected[item.slug] = true
      item.product && (newSettings.itemsDeselected[item.product.id] = true)
      // special treatment for summer/resolution swing 2018 and earlier
      Object.values(allItems).forEach(i => {
        if (item.slug !== i.slug && i.slug.match(new RegExp(item.slug))) {
          newSettings.itemsDeselected[i.slug] = true
          i.product && (newSettings.itemsDeselected[i.product.id] = true)
        }
      })
    }
    setSettings(newSettings)
  }

  const updateUiSettings = (ui, key, checked) => {
    const newSettings = {
      ...settings,
      [ui]: {
        ...settings[ui],
        [key]: checked,
      },
    }
    setSettings(newSettings)
  }

  const cancelSettingsChanges = keys => {
    // restore settings
    const newSettings = { ...settings }
    const keyArray = Array.isArray(keys) ? keys : [keys]
    keyArray.forEach(key => {
      const value = propsSettings[key]
      newSettings[key] = value
    })
    setSettings(newSettings)
  }

  const saveSettingsChanges = keys => {
    const newSettings = { ...propsSettings }
    const keyArray = Array.isArray(keys) ? keys : [keys]
    keyArray.forEach(key => {
      newSettings[key] = settings[key]
    })
    const msg = { cmd: 'update settings', data: { settings: newSettings } }
    msgSend(msg)
  }

  const updateSkipUnusedUsersDropdown = (e, { value }) => {
    const newSettings = {
      ...settings,
      uiUsers: {
        ...settings.uiUsers,
        skipUnusedUsersOptions: {
          ...settings.uiUsers.skipUnusedUsersOptions,
          defaultValue: value,
        },
      },
    }
    setSettings(newSettings)
  }

  const { events, itemsDeselected, uiRegistrants, uiItems, uiUsers } = settings

  const [cancelEventsButtonDisabled, saveEventsButtonDisabled] = getButtonDisabled(
    { events },
    propsSettings
  )
  const [cancelItemsButtonDisabled, saveItemsButtonDisabled] = getButtonDisabled(
    { itemsDeselected, uiItems },
    propsSettings
  )
  const [cancelUiRegistrantsButtonDisabled, saveUiRegistrantsButtonDisabled] = getButtonDisabled(
    { uiRegistrants },
    propsSettings
  )
  const [cancelUiUsersButtonDisabled, saveUiUsersButtonDisabled] = getButtonDisabled(
    { uiUsers },
    propsSettings
  )
  const itemsOrRegistrantsRefreshing = !!`${refreshStatus.items}${refreshStatus.users}`.match(
    /refreshing/
  )

  const selectedItems = Object.values(allItems).filter(itemsIfEvent(propsSettings)).sort(itemsSort)

  if (!currentAppVersion) currentAppVersion = propsSettings.app.version // only update once

  return (
    <div>
      <RestoreScrollPosition />
      <Grid container style={{ marginTop: '5rem', marginBottom: '2rem' }}>
        <Prompt
          when={
            !cancelEventsButtonDisabled ||
            !cancelItemsButtonDisabled ||
            !cancelUiRegistrantsButtonDisabled ||
            !cancelUiUsersButtonDisabled
          }
          message="You have unsaved settings changes. Are you sure you want to leave?"
        />
        <Grid.Row style={{ paddingTop: '0.5rem' }}>
          <Grid.Column>
            {!currentAppVersion ? null : (
              <div style={{ textAlign: 'center', fontSize: '14px' }}>
                {`App version: ${currentAppVersion}`}
              </div>
            )}
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column computer={2} tablet={2} only="computer tablet" />
          <Grid.Column computer={12} tablet={12} mobile={16}>
            <Segment.Group horizontal widths={2} className="get-refresh-data-segment">
              <Segment attached="top" className="get-all-data-segment">
                <div className="refresh-div">
                  <Refresh
                    componentType="circular button"
                    idx={stateIndexes.REFRESH_IDX_BUTTON_GET_DATA}
                    iconProps={{ name: 'upload', size: 'big', bordered: true }}
                    popupProps={{ offset: [0, 0], size: 'huge' }}
                    buttonName="Get Data"
                  />
                </div>
                <h2 style={{ marginLeft: '1em', marginTop: '0' }} className="mobile screen-hidden">
                  GET ALL DATA
                </h2>
              </Segment>
              <Segment attached="top" className="refresh-all-data-segment">
                <div className="refresh-div">
                  <Refresh
                    componentType="circular button"
                    idx={stateIndexes.REFRESH_IDX_BUTTON_REFRESH}
                    iconProps={{ size: 'big', bordered: true }}
                    popupProps={{ offset: [0, 0], size: 'huge' }}
                  />
                </div>
                <h2 style={{ marginLeft: '1em', marginTop: '0' }} className="mobile screen-hidden">
                  REFRESH ALL DATA
                </h2>
              </Segment>
            </Segment.Group>
            <Segment
              attached
              textAlign="center"
              className="datepicker-segment"
              disabled={itemsOrRegistrantsRefreshing}
            >
              <h3 style={{ marginBottom: '0' }}>Date Range:</h3>
              <div className="datepicker">
                <DateRangePicker
                  noBorder
                  keepOpenOnDateSelect
                  showDefaultInputIcon
                  hideKeyboardShortcutsPanel
                  startDate={dateStringToMoment(events.start_date)}
                  startDateId="startDate"
                  endDate={dateStringToMoment(events.end_date)}
                  endDateId="endDate"
                  onDatesChange={updateEventsDates}
                  focusedInput={focusedInput}
                  onFocusChange={setFocusedInput}
                  isOutsideRange={() => false}
                  minimumNights={0}
                  numberOfMonths={1}
                />
              </div>
              <div style={{ marginTop: '1em' }}>
                <Button.Group fluid size="big" widths="2" style={{ maxWidth: '26rem' }}>
                  <Button
                    onClick={() => cancelSettingsChanges('events')}
                    disabled={cancelEventsButtonDisabled}
                  >
                    Revert
                  </Button>
                  <Button.Or />
                  <Button
                    positive
                    onClick={() => saveSettingsChanges('events')}
                    disabled={saveEventsButtonDisabled}
                  >
                    Save
                    <div
                      style={{ display: 'inline' }}
                      className="mobile screen-hidden tablet screen-hidden"
                    >
                      {' '}
                      Changes
                    </div>
                  </Button>
                </Button.Group>
              </div>
            </Segment>
          </Grid.Column>
          <Grid.Column computer={2} tablet={2} only="computer tablet" />
        </Grid.Row>
        <Grid.Row>
          <Grid.Column computer={1} tablet={1} only="computer tablet" />
          <Grid.Column computer={14} tablet={14} mobile={16} verticalAlign="middle">
            <Segment attached="top" textAlign="center" className="items-segment">
              <Label attached="top right" size="large">
                <Refresh
                  componentType="circular button"
                  idx="items"
                  refreshEndpoints={[{ endpoint: 'refresh/items' }]}
                  iconProps={{ size: 'big' }}
                  popupProps={{ offset: [14, 12], size: 'huge', position: 'bottom right' }}
                />
              </Label>
              <Statistic horizontal size="huge">
                <Statistic.Value>{selectedItems.length}</Statistic.Value>
                <Statistic.Label style={{ fontSize: '200%' }}>
                  Item
                  {selectedItems.length > 1 ? 's' : ''}
                </Statistic.Label>
              </Statistic>
            </Segment>
            <Segment
              attached
              textAlign="center"
              loading={refreshStatus.items && !!refreshStatus.items.match(/refreshing/)}
              style={{ paddingLeft: '2em', paddingRight: '2em' }}
            >
              <h2 style={{ marginBottom: '0' }}>Items to display:</h2>
              <div>
                <div
                  style={{
                    textAlign: 'left',
                    marginTop: '0.75rem',
                    marginBottom: '0.5rem',
                    display: 'inline-block',
                  }}
                >
                  {selectedItems
                    .filter(item => getCheckBoxTitle(item).match(/need to be loaded/))
                    .map(item => (
                      <div
                        key={item.slug}
                        data-slug={item.slug}
                        style={{ margin: '0.15em 0' }}
                        className="settings-checkbox-placeholder"
                      >
                        {getCheckBoxTitle(item)}
                      </div>
                    ))}
                  {selectedItems
                    .filter(item => !getCheckBoxTitle(item).match(/need to be loaded/))
                    .sort((a, b) => stringSort(a.slug.toLowerCase(), b.slug.toLowerCase()))
                    .map(item => (
                      <div
                        key={item.slug}
                        data-slug={item.slug}
                        style={{ margin: '0.15em 0' }}
                        className="settings-checkbox"
                      >
                        <Checkbox
                          label={getCheckBoxTitle(item)}
                          checked={!itemsDeselected || !itemsDeselected[item.slug]}
                          onChange={(evt, data) => updateItemsDeselected(item, data.checked)}
                        />
                      </div>
                    ))}
                </div>
              </div>
              <div
                style={{
                  textAlign: 'left',
                  marginTop: '0.75rem',
                  marginBottom: '1.5rem',
                  display: 'inline-block',
                }}
              >
                <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                  <Checkbox
                    label="Show items without events"
                    checked={uiItems.itemsWithoutEvents}
                    onChange={(evt, data) =>
                      updateUiSettings('uiItems', 'itemsWithoutEvents', data.checked)
                    }
                  />
                </div>
                <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                  <Checkbox
                    label="Show item descriptions"
                    checked={uiItems.itemsShowDescription}
                    onChange={(evt, data) =>
                      updateUiSettings('uiItems', 'itemsShowDescription', data.checked)
                    }
                  />
                </div>
              </div>
              <div>
                <Button.Group fluid size="big" widths="2" style={{ maxWidth: '26rem' }}>
                  <Button
                    onClick={() => cancelSettingsChanges(['itemsDeselected', 'uiItems'])}
                    disabled={cancelItemsButtonDisabled}
                  >
                    Revert
                  </Button>
                  <Button.Or />
                  <Button
                    positive
                    onClick={() => saveSettingsChanges(['itemsDeselected', 'uiItems'])}
                    disabled={saveItemsButtonDisabled}
                  >
                    Save
                    <div
                      style={{ display: 'inline' }}
                      className="mobile screen-hidden tablet screen-hidden"
                    >
                      {' '}
                      Changes
                    </div>
                  </Button>
                </Button.Group>
              </div>
            </Segment>
          </Grid.Column>
          <Grid.Column computer={1} tablet={1} only="computer tablet" />
        </Grid.Row>
        <Grid.Row>
          <Grid.Column computer={1} tablet={1} only="computer tablet" />
          <Grid.Column computer={7} tablet={7} mobile={16}>
            <Segment attached="top" textAlign="center" className="registrants-segment">
              <Label attached="top right" size="large" style={{ zIndex: 102 }}>
                <Refresh
                  componentType="circular button"
                  idx="registrants"
                  refreshEndpoints={[
                    { endpoint: 'refresh/registrants', query: 'filterByItems=true' },
                  ]}
                  iconProps={{ size: 'big' }}
                  popupProps={{ offset: [14, 12], size: 'huge', position: 'bottom right' }}
                  buttonProps={{ disabled: itemsOrRegistrantsRefreshing }}
                />
              </Label>
              <Segment
                basic
                className="registrants-basic-segment"
                loading={
                  refreshStatus.registrants && !!refreshStatus.registrants.match(/refreshing/)
                }
              >
                <Statistic size="huge">
                  <Statistic.Label style={{ fontSize: '200%' }}>
                    Registrant
                    {Object.keys(registrants || {}).length > 1 ? 's' : ''}
                  </Statistic.Label>
                  <Statistic.Value>{Object.keys(registrants || {}).length}</Statistic.Value>
                </Statistic>
              </Segment>
            </Segment>
            <Segment
              attached
              textAlign="center"
              style={{ paddingLeft: '2em', paddingRight: '2em' }}
            >
              <div
                style={{
                  textAlign: 'left',
                  marginTop: '0.75rem',
                  marginBottom: '1.5rem',
                  display: 'inline-block',
                }}
              >
                <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                  <Checkbox
                    label="Separate checked-in registrants"
                    checked={uiRegistrants.separateCheckedIn}
                    onChange={(evt, data) =>
                      updateUiSettings('uiRegistrants', 'separateCheckedIn', data.checked)
                    }
                  />
                </div>
                <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                  <Checkbox
                    label="Clear search on check-in"
                    checked={uiRegistrants.clearSearchOnCheckIn}
                    onChange={(evt, data) =>
                      updateUiSettings('uiRegistrants', 'clearSearchOnCheckIn', data.checked)
                    }
                  />
                </div>
                <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                  <Checkbox
                    label="Hide email addresses"
                    checked={uiRegistrants.hideEmailAddress}
                    onChange={(evt, data) =>
                      updateUiSettings('uiRegistrants', 'hideEmailAddress', data.checked)
                    }
                  />
                </div>
                <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                  <Checkbox
                    label="Hide cash order status when paid"
                    checked={uiRegistrants.hideOrderStatusWhenPaid}
                    onChange={(evt, data) =>
                      updateUiSettings('uiRegistrants', 'hideOrderStatusWhenPaid', data.checked)
                    }
                  />
                </div>
                {!objHasKey(uiRegistrants, 'pollPlacements') ? (
                  ''
                ) : (
                  <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                    <Checkbox
                      label="Poll placements spreadsheet every minute"
                      checked={uiRegistrants.pollPlacements}
                      onChange={(evt, data) =>
                        updateUiSettings('uiRegistrants', 'pollPlacements', data.checked)
                      }
                    />
                  </div>
                )}
              </div>
              <div>
                <Button.Group fluid size="big" widths="2" style={{ maxWidth: '26rem' }}>
                  <Button
                    onClick={() => cancelSettingsChanges('uiRegistrants')}
                    disabled={cancelUiRegistrantsButtonDisabled}
                  >
                    Revert
                  </Button>
                  <Button.Or />
                  <Button
                    positive
                    onClick={() => saveSettingsChanges('uiRegistrants')}
                    disabled={saveUiRegistrantsButtonDisabled}
                  >
                    Save
                    <div
                      style={{ display: 'inline' }}
                      className="mobile screen-hidden tablet screen-hidden"
                    >
                      {' '}
                      Changes
                    </div>
                  </Button>
                </Button.Group>
              </div>
            </Segment>
          </Grid.Column>
          <Grid.Column mobile={16} only="mobile">
            <div style={{ height: '28px' }} />
          </Grid.Column>
          <Grid.Column computer={7} tablet={7} mobile={16}>
            <Segment attached="top" textAlign="center" className="users-segment">
              <Label attached="top right" size="large" style={{ zIndex: 102 }}>
                <Refresh
                  componentType="circular button"
                  idx="users"
                  refreshEndpoints={[{ endpoint: 'refresh/users' }]}
                  iconProps={{ size: 'big' }}
                  popupProps={{ offset: [14, 12], size: 'huge', position: 'bottom right' }}
                />
              </Label>
              <Segment
                basic
                className="users-basic-segment"
                loading={refreshStatus.users && !!refreshStatus.users.match(/refreshing/)}
              >
                <Statistic size="huge">
                  <Statistic.Label style={{ fontSize: '200%' }}>
                    User
                    {Object.keys(users || {}).length > 1 ? 's' : ''}
                  </Statistic.Label>
                  <Statistic.Value>{Object.keys(users || {}).length}</Statistic.Value>
                </Statistic>
              </Segment>
            </Segment>
            <Segment
              attached
              textAlign="center"
              style={{ paddingLeft: '2em', paddingRight: '2em' }}
            >
              <div
                style={{
                  textAlign: 'left',
                  marginTop: '0.75rem',
                  marginBottom: '1.5rem',
                  display: 'inline-block',
                }}
              >
                <div className="settings-checkbox" style={{ margin: '0.15em 0' }}>
                  <Checkbox
                    label="Skip users unused"
                    checked={uiUsers.skipUnusedUsers}
                    onChange={(evt, data) =>
                      updateUiSettings('uiUsers', 'skipUnusedUsers', data.checked)
                    }
                  />
                  <Dropdown
                    className="skip-unused-users-dropdown"
                    inline
                    onChange={updateSkipUnusedUsersDropdown}
                    options={uiUsers.skipUnusedUsersOptions.options}
                    value={uiUsers.skipUnusedUsersOptions.defaultValue}
                  />
                </div>
              </div>
              <div>
                <Button.Group fluid size="big" widths="2" style={{ maxWidth: '26rem' }}>
                  <Button
                    onClick={() => cancelSettingsChanges('uiUsers')}
                    disabled={cancelUiUsersButtonDisabled}
                  >
                    Revert
                  </Button>
                  <Button.Or />
                  <Button
                    positive
                    onClick={() => saveSettingsChanges('uiUsers')}
                    disabled={saveUiUsersButtonDisabled}
                  >
                    Save
                    <div
                      style={{ display: 'inline' }}
                      className="mobile screen-hidden tablet screen-hidden"
                    >
                      {' '}
                      Changes
                    </div>
                  </Button>
                </Button.Group>
              </div>
            </Segment>
          </Grid.Column>
          <Grid.Column computer={1} tablet={1} only="computer tablet" />
        </Grid.Row>
      </Grid>
    </div>
  )
}

Settings.propTypes = {
  allItems: PropTypes.objectOf(() => true).isRequired,
  users: PropTypes.objectOf(() => true).isRequired,
  registrants: PropTypes.objectOf(() => true).isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
  refreshStatus: PropTypes.objectOf(() => true).isRequired,
  msgSend: PropTypes.func.isRequired,
  updateTopMenuContent: PropTypes.func.isRequired,
}

const mapStateToProps = state => ({
  allItems: refreshSelectors.allItems(state),
  users: refreshSelectors.users(state),
  registrants: refreshSelectors.registrants(state),
  settings: refreshSelectors.settings(state),
  refreshStatus: refreshSelectors.refreshStatus(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      msgSend: websocketActions.msgSend,
      updateTopMenuContent: topMenuActions.updateTopMenuContent,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Settings)
