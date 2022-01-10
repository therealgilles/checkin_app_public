import React from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Grid, Menu } from 'semantic-ui-react'
import { selectors as topMenuSelectors } from './reducer'
import './style.css'

const TopMenu = ({ menuItem }) => (
  <Menu color="teal" inverted fixed="top" size="massive" widths={1} className="top-menu">
    <Grid container>
      <Grid.Row>
        <Grid.Column computer={4} tablet={3} mobile={3} />
        <Grid.Column computer={8} tablet={10} mobile={10}>
          <Menu.Item>{menuItem}</Menu.Item>
        </Grid.Column>
        <Grid.Column computer={4} tablet={3} mobile={3} />
      </Grid.Row>
    </Grid>
  </Menu>
)

TopMenu.propTypes = {
  menuItem: PropTypes.element,
}

TopMenu.defaultProps = {
  menuItem: null,
}

const mapStateToProps = state => ({
  menuItem: topMenuSelectors.content(state),
})

export default connect(mapStateToProps)(TopMenu)
