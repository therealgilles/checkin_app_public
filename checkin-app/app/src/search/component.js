import React, { useEffect } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Input } from 'semantic-ui-react'
import { selectors as searchSelectors } from './reducer'
import { actions as searchActions } from './actions'
import {
  onClick,
  onKeyDown,
  focusSearchInputFieldOnStart,
  clearSearchInputFieldTimeouts,
} from './helpers'
import './style.css'

function Search({ searchUpdateSearchString, searchString }) {
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown(searchUpdateSearchString))
    return () => {
      clearSearchInputFieldTimeouts()
      document.removeEventListener('keydown', onKeyDown(searchUpdateSearchString))
    }
  })

  return (
    <Input
      {...{
        ref: focusSearchInputFieldOnStart,
        placeholder: 'Search regex...',
        icon: {
          name: 'x',
          circular: true,
          link: true,
          onClick: onClick(searchUpdateSearchString),
        },
        inverted: true,
        onChange: searchUpdateSearchString,
        onKeyDown: onKeyDown(searchUpdateSearchString),
        className: 'search-box',
      }}
      value={searchString}
    />
  )
}

Search.propTypes = {
  searchString: PropTypes.string.isRequired,
  searchUpdateSearchString: PropTypes.func.isRequired,
}

const mapStateToProps = state => ({
  searchString: searchSelectors.searchString(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      searchUpdateSearchString: searchActions.searchUpdateSearchString,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Search)
