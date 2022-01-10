import React, { useState } from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { bindActionCreators } from 'redux'
import { Grid, Button, Icon } from 'semantic-ui-react'
import debug from 'debug'
import PageLoader from '../components/pageloader'
import { actions as authActions } from './actions'
import { selectors as authSelectors } from './reducer'
import './style.css'

debug.enable('auth/component:*')
// const log = debug('auth/component:log')
// const info = debug('auth/component:info')
// const error = debug('auth/component:error')

function Login({ signOutOngoing, signOutDone, signInOngoing, login }) {
  const signOut = signOutOngoing || signOutDone
  const [loading, setLoading] = useState(!signOut)

  // stop loading when signing out to display login button
  if (loading && signOut) {
    setLoading(false)
  }

  return (
    <Grid
      textAlign="center"
      verticalAlign="middle"
      style={{ height: '100vh', alignItems: 'center' }}
    >
      {loading || signInOngoing ? (
        <PageLoader message={signInOngoing ? 'Authenticating...' : 'Loading...'} />
      ) : (
        <Button
          icon={
            <Icon
              {...{
                name: signInOngoing ? 'spinner' : 'sign in',
                loading: signInOngoing,
              }}
            />
          }
          {...{
            size: 'massive',
            content: 'Login',
            positive: true,
            onClick: login,
            className: 'login-button',
          }}
        />
      )}
    </Grid>
  )
}

Login.propTypes = {
  signInOngoing: PropTypes.bool.isRequired,
  signOutOngoing: PropTypes.bool.isRequired,
  signOutDone: PropTypes.bool.isRequired,
  login: PropTypes.func.isRequired,
}

const mapStateToProps = state => ({
  signInOngoing: authSelectors.signInOngoing(state),
  signOutOngoing: authSelectors.signOutOngoing(state),
  signOutDone: authSelectors.signOutDone(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      login: authActions.signInRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Login)
