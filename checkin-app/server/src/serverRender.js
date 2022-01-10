import debug from 'debug'
import React from 'react'
import { renderToString, renderToNodeStream } from 'react-dom/server'
import serialize from 'serialize-javascript'
import config from './config'
import ServerRoot from './serverRoot'
import { getStore } from 'AppSrc/store'

config.debug && debug.enable('serverRender:*')
// const log = debug('serverRender:log')
// const info = debug('serverRender:info')
// const error = debug('serverRender:error')

const tagsFromAssets = (tag, assets, entrypoint, extra = '') => {
  if (!assets[entrypoint] || !assets[entrypoint][tag]) return ''

  return assets[entrypoint][tag]
    .map(asset =>
      tag === 'css'
        ? `<link rel="stylesheet" href="${asset}"${extra}>`
        : `<script src="${asset}"${extra} defer></script>`
    )
    .join('')
}

const addPreloadedState = (storeState, extra = '') => {
  if (!storeState) return ''
  return `<script type="src/javascript"${extra}>
     window.__PRELOADED_STATE__ = ${serialize(storeState)}</script>`
}

const getIndexHtml = ({ part, markup, storeState, assets, scriptNonce }) => {
  let html = ''

  if (!part || part === 'header') {
    html += '<!doctype html><html lang="en">'
    html += `
      <head>
        <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${config.appName}</title>
        ${tagsFromAssets('css', assets, 'client')}
        ${tagsFromAssets('js', assets, 'client', ` nonce="${scriptNonce}"`)}
      </head>`
    html += '<body><div id="root">'
  }

  if ((!part || part === 'content') && markup) html += markup

  if (!part || part === 'footer') {
    html += '</div>'
    html += addPreloadedState(storeState, ` nonce="${scriptNonce}"`)
    html += '</body></html>'
  }

  return html
}

// get all razzle generated assets
const allAssets = require(process.env.RAZZLE_ASSETS_MANIFEST) // eslint-disable-line import/no-dynamic-require

const serverRender = async (req, res) => {
  try {
    const scriptNonce = res.locals.scriptNonce

    if (config.no_ssr) {
      // no server rendering
      res.status(200).send(getIndexHtml({ assets: allAssets, scriptNonce }))
      return
    }

    if (config.node_stream) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.write(
        getIndexHtml({ part: 'header', assets: allAssets, scriptNonce })
      )
    }

    const context = {}
    const { store } = getStore({ isServer: true, serverUrl: req.url })

    const render = config.node_stream ? renderToNodeStream : renderToString
    const markup = render(
      <ServerRoot store={store} context={context} location={req.url} />
    )

    // FIXME: need to wait for redux-logic to be done?
    // see https://github.com/jeffbski/redux-logic/issues/139
    await store.logicMiddleware.whenComplete()

    if (context.url) {
      res.redirect(context.url) // context.url set indicates a redirect
      return
    }

    const storeState = store.getState()
    // log('Store initial state:', storeState)

    if (!config.node_stream) {
      res
        .status(200)
        .send(
          getIndexHtml({ markup, storeState, assets: allAssets, scriptNonce })
        )
      return
    }

    markup.pipe(res, { end: false })
    markup.on('end', () =>
      res.end(getIndexHtml({ part: 'footer', storeState, scriptNonce }))
    )
  } catch (err) {
    throw new Error(err)
  }
}

export default serverRender
