import React, { useState, Suspense, lazy } from 'react'
import { withRouter } from 'react-router'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Route, Switch } from 'react-router-dom'
import debug from 'debug'
import { Icon, Sidebar, Menu, Button, Modal } from 'semantic-ui-react'
import ScrollUp from 'react-scroll-up'
import { history } from '../../store'
import PageLoader from '../pageloader'
import { component as WebSocketIndicator } from '../../websocket'
import { selectors as authSelectors, actions as authActions, component as Login } from '../../auth'
import { selectors as refreshSelectors } from '../../refresh'
import { component as TopMenu } from '../topmenu'
import './style.css'

const Items = lazy(() => import('../items'))
const Registrants = lazy(() => import('../registrants'))
const RegistrantEditCard = lazy(() => import('../registrants/RegistrantEditCard'))
const Settings = lazy(() => import('../settings'))
const NotFound = lazy(() => import('../notfound'))

debug.enable('app:*')
// const log = debug('app:log')
// const info = debug('app:info')
// const error = debug('app:error')

let currentAppVersion // stored current app version

function App({ authenticated, signOutRequest, settings }) {
  const [sidebarVisible, setSidebarVisible] = useState(false)

  if (!currentAppVersion && settings.app) currentAppVersion = settings.app.version

  if (!authenticated) {
    return <Login />
  }

  const sidebarToggleVisibility = () => {
    setSidebarVisible(!sidebarVisible)
  }

  const itemsName = 'Items'
  const itemsNameLc = itemsName.toLowerCase()

  return (
    <div className="app">
      <Modal
        open={currentAppVersion && settings.app && currentAppVersion !== settings.app.version}
        closeOnDimmerClick={false}
        basic
        className="refresh-modal"
      >
        <Modal.Content>
          A new version of the app is available
          <Button
            onClick={() => window.location.reload()}
            basic
            inverted
            size="large"
            className="tertiary refresh-button"
          >
            REFRESH
          </Button>
        </Modal.Content>
      </Modal>
      <ScrollUp showUnder={160} style={{ bottom: 80, zIndex: 10 }}>
        <Icon
          size="huge"
          name="arrow circle up"
          color="teal"
          style={{ margin: '0', padding: '0', width: '1em' }}
        />
      </ScrollUp>
      <Sidebar.Pushable className="scrollArea">
        <Sidebar
          as={Menu}
          fixed="left"
          size="massive"
          animation="overlay"
          width="thin"
          icon="labeled"
          visible={sidebarVisible}
          vertical
          inverted
          color="teal"
        >
          <Menu.Item
            name="registrants"
            onClick={() => {
              sidebarToggleVisibility()
              history.push('/registrants')
            }}
          >
            <Icon name="group" />
            Registrants
          </Menu.Item>
          <Menu.Item
            name={itemsNameLc}
            onClick={() => {
              sidebarToggleVisibility()
              history.push(`/${itemsNameLc}`)
            }}
          >
            <Icon name={itemsNameLc.match(/class/) ? 'vcard' : 'list alternate'} />
            {itemsName}
          </Menu.Item>
          <Menu.Item
            name="register"
            onClick={() => {
              sidebarToggleVisibility()
              history.push('/register')
            }}
          >
            <Icon name="add user" />
            Register
          </Menu.Item>
          <Menu.Item
            name="settings"
            onClick={() => {
              sidebarToggleVisibility()
              history.push('/settings')
            }}
          >
            <Icon name="settings" />
            Settings
          </Menu.Item>
          <Menu.Item
            name="logout"
            onClick={() => {
              history.push('/')
              signOutRequest()
            }}
          >
            <Icon name="log out" />
            Log out
          </Menu.Item>
        </Sidebar>

        <Sidebar.Pusher
          dimmed={sidebarVisible}
          onClick={() => {
            sidebarVisible && sidebarToggleVisibility()
          }}
        >
          <TopMenu />
          <Button
            attached="right"
            color="teal"
            size="massive"
            onClick={sidebarToggleVisibility}
            className="sidebar-menu-icon"
            icon={<Icon name="sidebar" size="large" />}
          />
          <WebSocketIndicator />
          <main className="custom-loader">
            <Suspense fallback={<PageLoader />}>
              <Switch>
                <Route exact path="/" component={Registrants} />
                <Route exact path={`/${itemsNameLc}`} component={Items} />
                <Route exact path="/settings" component={Settings} />
                <Route exact path={`/${itemsNameLc}/:itemId`} component={Registrants} />
                <Route exact path="/registrants" component={Registrants} />
                <Route exact path="/registrants/:registrantId" component={RegistrantEditCard} />
                <Route exact path="/register" component={RegistrantEditCard} key="register" />
                <Route path="*" component={NotFound} />
              </Switch>
            </Suspense>
          </main>
        </Sidebar.Pusher>
      </Sidebar.Pushable>
    </div>
  )
}

App.propTypes = {
  authenticated: PropTypes.bool.isRequired,
  signOutRequest: PropTypes.func.isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
}

const mapStateToProps = state => ({
  authenticated: authSelectors.authenticated(state),
  settings: refreshSelectors.settings(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      signOutRequest: authActions.signOutRequest,
    },
    dispatch
  )

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(App))
