import React, { useState, useEffect } from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PropTypes from 'prop-types'
import debug from 'debug'
import { Grid, Card } from 'semantic-ui-react'
import { RestoreScrollPosition } from '../../ui'
import { selectors as refreshSelectors } from '../../refresh'
import { actions as topMenuActions } from '../topmenu'
import { itemsSort, itemsIfEvent } from '../../refresh/helpers'
import { initialItem } from '../../refresh/reducer'
import PageLoader from '../pageloader'
import ItemCard from './ItemCard'
import './Items.css'

debug.enable('items/index:*')
// const log = debug('items/index:log')
// const info = debug('items/index:info')
// const error = debug('items/index:error')

function Items({ items, settings, updateTopMenuContent }) {
  const [loadingExpired, setLoadingExpired] = useState(false)
  const [loadingTimeout, setLoadingTimeout] = useState(null)

  const itemTopMenuName = 'Items'
  const pageLoadingDelay = 2000

  useEffect(() => {
    updateTopMenuContent(<div className="top-menu-title">{itemTopMenuName}</div>)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // do not stay in loading state more than 2 seconds
    setLoadingTimeout(setTimeout(() => loadingTimeout && setLoadingExpired(true), pageLoadingDelay))
    return () => {
      clearTimeout(loadingTimeout)
      setLoadingTimeout(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (
    !loadingExpired &&
    Object.keys(items).length === 1 &&
    Object.values(items)[0].slug === 'item-slug'
  ) {
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

  const localItems = Object.keys(items).length === 0 ? initialItem : items
  // log(Object.values(localItems).filter(itemsIfEvent(settings)))

  return (
    <div>
      <RestoreScrollPosition />
      <Grid
        container
        style={{ marginTop: '7rem', marginBottom: '2rem' }}
        className="grid-container"
      >
        <Grid.Column width={16}>
          <Card.Group>
            {Object.values(localItems)
              .filter(itemsIfEvent(settings))
              .sort(itemsSort)
              .map(item => (
                <ItemCard
                  key={item.event ? item.event.slug : item.product.slug}
                  evt={item.event}
                  product={item.product}
                />
              ))}
          </Card.Group>
        </Grid.Column>
      </Grid>
    </div>
  )
}

Items.propTypes = {
  items: PropTypes.objectOf(() => true).isRequired,
  updateTopMenuContent: PropTypes.func.isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
}

const mapStateToProps = state => ({
  items: refreshSelectors.items(state),
  settings: refreshSelectors.settings(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      updateTopMenuContent: topMenuActions.updateTopMenuContent,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Items)
