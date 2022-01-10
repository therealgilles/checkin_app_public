import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Menu, Button } from 'semantic-ui-react'
import './style.css'

const BottomMenu = ({ itemTitle, buttonTitle, buttonLink, buttonClassName }) => (
  <Menu fixed="bottom" inverted color="teal" size="massive" secondary className="bottom-menu">
    <Menu.Item>
      <Button
        color="blue"
        icon="left arrow"
        content={buttonTitle}
        labelPosition="left"
        as={Link}
        to={buttonLink}
        className={buttonClassName}
      />
    </Menu.Item>
    <Menu.Item position="right">
      {itemTitle}
    </Menu.Item>
  </Menu>
)

BottomMenu.propTypes = {
  itemTitle: PropTypes.string.isRequired,
  buttonTitle: PropTypes.string.isRequired,
  buttonLink: PropTypes.string.isRequired,
  buttonClassName: PropTypes.string.isRequired,
}

export default BottomMenu
