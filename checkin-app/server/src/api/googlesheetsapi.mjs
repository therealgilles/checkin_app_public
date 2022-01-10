// googlesheetsapi.mjs
//
// Google sheets API for document access
//

import debug from 'debug'
import googleapis from 'googleapis'
import config from '../config'

config.debug && debug.enable('googlesheetsapi:*')
// const log = debug('googlesheetsapi:log')
// const info = debug('oauthapi:info')
// const error = debug('googlesheetsapi:error')

const { google } = googleapis
let auth

const defaultExports = !config.googlesheets ? {}
  : {
    sheets: () => {
      if (!auth) {
        auth = new google.auth.GoogleAuth({
          keyFile: `${config.googlesheets.credentials_path}/${config.googlesheets.credentials_filename}`,
          scopes: [config.googlesheets.scope],
        })
      }
      return google.sheets({ version: 'v4', auth })
    },
  }

export default defaultExports
