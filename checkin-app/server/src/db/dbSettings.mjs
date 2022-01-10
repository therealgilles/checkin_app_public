// dbSettings.mjs
//
// Functions to access settings
//

import debug from 'debug'
import config from '../config'
// import helpers from '../helpers/helpers'
import websocket from '../websocket/websocket'
import db from './db'
import dbPlacements from './dbPlacements'

config.debug && debug.enable('dbSettings:*')
// const log = debug('dbSettings:log')
// const info = debug('dbSettingsdb:info')
const error = debug('dbSettings:error')

const settings = {
  // values need to be objects, must match what's on the client
  app: {
    version: config.version,
  },
  events: {
    start_date: null,
    end_date: null,
  },
  itemsDeselected: {},
  uiRegistrants: {
    separateCheckedIn: false,
    clearSearchOnCheckIn: true,
    hideEmailAddress: false,
    hideOrderStatusWhenPaid: true,
    supportStoreCredit: config.support_store_credit || false,
  },
  uiItems: {
    itemsWithoutEvents: false,
    itemsShowDescription: false,
  },
  uiUsers: {
    skipUnusedUsers: false,
    skipUnusedUsersOptions: {
      defaultValue: 2,
      options: [
        { key: 1, text: 'for 1 year', value: 1 },
        { key: 2, text: 'for 2 years', value: 2 },
        { key: 3, text: 'for 3 years', value: 3 },
        { key: 4, text: 'for 4 years', value: 4 },
        { key: 5, text: 'for 5 years', value: 5 },
        { key: 10, text: 'for 10 years', value: 10 },
      ],
    },
  },
}

if (config.use_placements) {
  settings.uiRegistrants.pollPlacements = false
}

const defaultExports = {
  settings,

  dbUpdateSettings: async settingsInfo => {
    try {
      if (settingsInfo.setting) {
        if (typeof settingsInfo.value === 'undefined') {
          delete settings[settingsInfo.setting]
          return db.redisDbClient.hdelAsync('settings', settingsInfo.setting)
        }
        // assume all settings are objects
        settings[settingsInfo.setting] || (settings[settingsInfo.setting] = {})
        settings[settingsInfo.setting] = settingsInfo.value
        return db.redisDbClient.hsetAsync(
          'settings',
          settingsInfo.setting,
          JSON.stringify(settingsInfo.value)
        )
      }

      // log('dbUpdateSettings', settingsInfo.settings)
      await Promise.all(
        Object.keys(settingsInfo.settings).map(s =>
          defaultExports.dbUpdateSettings({ setting: s, value: settingsInfo.settings[s] })
        )
      )

      await dbPlacements.settingsUpdated()

      return Promise.resolve()
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getSettings: () => Promise.resolve(settings || {}),

  getSettingsSendMsg: async () => {
    try {
      const data = await defaultExports.getSettings()
      return websocket.sendMsg({
        reqId: 'server',
        cmd: 'update settings',
        data: { settings: data },
      })
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  updateSettings: settingsInfo => defaultExports.dbUpdateSettings(settingsInfo),

  updateSettingsSendMsg: async settingsInfo => {
    try {
      await defaultExports.updateSettings(settingsInfo)
      return defaultExports.getSettingsSendMsg()
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },
}

export default defaultExports
