import React, { useState, useEffect } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { Grid, Card, Header } from 'semantic-ui-react'
import { RestoreScrollPosition } from '../../ui'
import { selectors as refreshSelectors } from '../../refresh'
import { selectors as searchSelectors, component as Search } from '../../search'
import { actions as historyActions } from '../../history'
import { actions as topMenuActions } from '../topmenu'
import PageLoader from '../pageloader'
import BottomMenu from '../bottommenu'
import RegistrantCard from './RegistrantCard'
import { isCheckedIn } from '../../checkin/helpers'
import {
  getRegistrantsSubheader,
  getRegistrantsSubheaderNoneFound,
  getFilteredRegistrants,
  getItemInfo,
  getRegistrantCountsGroups,
} from './helpers'
import { registrantSort } from '../../refresh/helpers'
import './style.css'

debug.enable('registrants/index:*')
// const log = debug('registrants/index:log')
// const info = debug('registrants/index:info')
// const error = debug('registrants/index:error')

function Registrants({
  items,
  allItems,
  settings,
  match,
  registrants,
  activeSearchString,
  users,
  updateTopMenuContent,
  historySaveItemPathname,
}) {
  const {
    itemId: initItemId,
    itemTitle: initItemTitle,
    itemIdArray: initItemIdArray,
  } = getItemInfo({
    items,
    allItems,
    settings,
    match,
  })
  const { registrantCounts: initRegistrantCounts, registrantGroups: initRegistrantGroups } =
    getRegistrantCountsGroups({
      registrants,
      itemIdArray,
      activeSearchString,
      users,
      settings,
    })

  const [itemId, setItemId] = useState(initItemId)
  const [itemTitle, setItemTitle] = useState(initItemTitle)
  const [itemIdArray, setItemIdArray] = useState(initItemIdArray)
  const [registrantCounts, setRegistrantCounts] = useState(initRegistrantCounts)
  const [registrantGroups, setRegistrantGroups] = useState(initRegistrantGroups)
  const [pageLoading, setPageLoading] = useState(true)
  const [loadingTimeout, setLoadingTimeout] = useState(null)
  const pageLoadingDelay = 100

  useEffect(() => {
    const {
      itemId: newItemId,
      itemTitle: newItemTitle,
      itemIdArray: newItemIdArray,
    } = getItemInfo({
      items,
      allItems,
      settings,
      match,
    })

    setItemId(newItemId)
    setItemTitle(newItemTitle)
    setItemIdArray(newItemIdArray)
  }, [items, allItems, settings, match])

  useEffect(() => {
    const { registrantCounts: newRegistrantCounts, registrantGroups: newRegistrantGroups } =
      getRegistrantCountsGroups({
        registrants,
        itemIdArray,
        activeSearchString,
        users,
        settings,
      })

    // log('registrantCounts', newRegistrantCounts)
    // log('registrantGroups', newRegistrantGroups)

    setRegistrantCounts(newRegistrantCounts)
    setRegistrantGroups(newRegistrantGroups)
  }, [itemIdArray, registrants, activeSearchString, users, settings])

  useEffect(() => {
    updateTopMenuContent(<Search />)
    historySaveItemPathname(window.location.pathname)
    setLoadingTimeout(setTimeout(() => setPageLoading(false), pageLoadingDelay))

    return () => {
      clearTimeout(loadingTimeout)
      setLoadingTimeout(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (pageLoading) {
    return <PageLoader />
  }

  const itemsName = 'Items'
  const itemName = itemsName.replace(/e?s$/, '')

  return (
    <div>
      <RestoreScrollPosition />
      <Grid
        container
        style={{ marginTop: '5rem', marginBottom: '2rem' }}
        className="grid-container"
      >
        <Grid.Row>
          <Grid.Column width={16}>
            {registrantGroups.length ? (
              ''
            ) : (
              <div className="registrants-group">
                <Header as="h1" textAlign="center">
                  {activeSearchString ? 'No matching registrants found' : 'Loading registrants...'}
                </Header>
              </div>
            )}
            {registrantGroups.map(({ checkedInStatus, header }) => (
              <div key={checkedInStatus.toString()} className="registrants-group">
                <Header as="h1" textAlign="center">
                  {header}
                  <Header.Subheader className="subheader">
                    {checkedInStatus === 'any' &&
                      !getRegistrantsSubheaderNoneFound(
                        true,
                        registrantCounts,
                        activeSearchString,
                        itemId
                      ) && (
                        <div>
                          Checked-in:
                          {` ${getRegistrantsSubheader(
                            true,
                            registrantCounts,
                            activeSearchString,
                            itemId
                          )}`}
                        </div>
                      )}
                    {checkedInStatus === 'any' &&
                      !getRegistrantsSubheaderNoneFound(
                        false,
                        registrantCounts,
                        activeSearchString,
                        itemId
                      ) && (
                        <div>
                          Not checked-in:
                          {` ${getRegistrantsSubheader(
                            false,
                            registrantCounts,
                            activeSearchString,
                            itemId
                          )}`}
                        </div>
                      )}
                    {checkedInStatus !== 'any' && (
                      <div>
                        {getRegistrantsSubheader(
                          checkedInStatus,
                          registrantCounts,
                          activeSearchString,
                          itemId
                        )}
                      </div>
                    )}
                  </Header.Subheader>
                </Header>
                <Card.Group>
                  {getFilteredRegistrants(
                    registrants,
                    itemIdArray,
                    activeSearchString,
                    users,
                    settings
                  )
                    .sort(registrantSort)
                    .filter(
                      reg =>
                        checkedInStatus === 'any' ||
                        isCheckedIn(reg.checkins, reg.items) === checkedInStatus
                    )
                    .map(reg => (
                      <RegistrantCard
                        key={`${reg.id}-${activeSearchString}`}
                        reg={reg}
                        activeSearchString={activeSearchString}
                      />
                    ))}
                </Card.Group>
              </div>
            ))}
          </Grid.Column>
        </Grid.Row>
      </Grid>
      <BottomMenu
        itemTitle={itemTitle}
        buttonTitle={`Choose Another ${itemName}`}
        buttonLink={`/${itemsName.toLowerCase()}`}
        buttonClassName="another-class-button"
      />
    </div>
  )
}

Registrants.propTypes = {
  users: PropTypes.objectOf(() => true).isRequired,
  items: PropTypes.objectOf(() => true).isRequired,
  allItems: PropTypes.objectOf(() => true).isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
  registrants: PropTypes.objectOf(() => true).isRequired,
  match: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  activeSearchString: PropTypes.string.isRequired,
  historySaveItemPathname: PropTypes.func.isRequired,
  updateTopMenuContent: PropTypes.func.isRequired,
}

const mapStateToProps = state => ({
  users: refreshSelectors.users(state),
  items: refreshSelectors.items(state),
  allItems: refreshSelectors.allItems(state),
  settings: refreshSelectors.settings(state),
  registrants: refreshSelectors.registrants(state),
  activeSearchString: searchSelectors.activeSearchString(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      historySaveItemPathname: historyActions.historySaveItemPathname,
      updateTopMenuContent: topMenuActions.updateTopMenuContent,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Registrants)
