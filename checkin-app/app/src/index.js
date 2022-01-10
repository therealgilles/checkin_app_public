import { polyfillLoader } from 'polyfill-io-feature-detection'
import React from 'react'
import { hydrate, render } from 'react-dom'
import { Provider } from 'react-redux'
import { ConnectedRouter } from 'connected-react-router'
import 'react-dates/initialize'
import 'react-dates/lib/css/_datepicker.css'
import './semantic-ui/dist/semantic.min.css'
// import 'semantic-ui-css/semantic.min.css'
import { store, history } from './store'
import App from './components/app'
import './index.css'

const root = document.getElementById('root')
const Application = (
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <App />
    </ConnectedRouter>
  </Provider>
)

const main = () => {
  if (root.hasChildNodes() === true) {
    hydrate(Application, root)
  } else {
    render(Application, root)
  }

  if (module.hot) {
    module.hot.accept()
  }
}

// This function load polyfills only if needed. By default it uses polyfill.io.
polyfillLoader({
  features: 'Object.values',
  onCompleted: main,
})
