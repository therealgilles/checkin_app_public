// tecapi.mjs
//
// Functions accessing the events calendar REST API
//

import debug from 'debug'
import axios from 'axios'
import axiosRetry from 'axios-retry'
import dayjs from 'dayjs'
import he from 'html-entities'
import diff from 'deep-diff'
import config from '../config'
import helpers from '../helpers/helpers'
import db from '../db/db'

config.debug && debug.enable('tecapi:*')
const log = debug('tecapi:log')
// const info = debug('tecapi:info')
const error = debug('tecapi:error')

const tecAxios = axios.create({
  baseURL: `${config.url}/${config.tecapi_path}/${config.tecapi_version}`,
  headers: {
    Authorization: `Basic ${config.auth_token}`,
    // 'Cache-Control': 'no-cache',
  },
})

axiosRetry(tecAxios, { retries: 3 })

const dayIndexes = day =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)

const nextDate = (day, offset = 0) => {
  const dayIndex = dayIndexes(day)
  const d = new Date()
  d.setDate(d.getDate() - 1) // set date to yesterday because the calculation below is past the current day
  d.setDate(d.getDate() + ((dayIndex - 1 - d.getDay() + 7) % 7) + 1)
  d.setDate(d.getDate() + offset)
  return d
}

const dateFormat = d => dayjs(d).format('YYYY-MM-DD')

const defaultExports = {
  updateAuth: auth => {
    log('tecapi updateAuth', auth)
    tecAxios.defaults.headers.Authorization = auth
  },

  getEvent: async eventInfo => {
    try {
      const resp = await tecAxios.get(`/events/${eventInfo.id}`)
      return resp.data
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getEvents: async (eventInfo = {}) => {
    try {
      if (eventInfo.id) {
        const evt = await defaultExports.getEvent(eventInfo)
        return [evt]
      }
      const settings = await db.getSettings()
      // get events of specified date, settings date, or this coming Wednesday events
      let startDate = eventInfo.query ? eventInfo.query.start_date : null
      startDate || (settings.events && (startDate = settings.events.start_date))
      startDate || (startDate = dateFormat(nextDate('Wednesday')))
      let endDate = eventInfo.query ? eventInfo.query.end_date : null
      endDate || (settings.events && (endDate = settings.events.end_date))
      // we should not need the +1 day below, but there was a bug in the TEC API at some point
      endDate || (endDate = dateFormat(nextDate('Wednesday', 1)))

      const newSettings = JSON.parse(JSON.stringify(settings)) // deep copy
      if (!eventInfo.query || !eventInfo.query.start_date) {
        // if start date is not specified, update settings
        newSettings.events || (newSettings.events = {})
        newSettings.events.start_date = startDate
      }
      if (!eventInfo.query || !eventInfo.query.end_date) {
        // if end date is not specified, update settings
        newSettings.events || (newSettings.events = {})
        newSettings.events.end_date = endDate
      }

      if (diff(settings, newSettings)) {
        // update settings if they have changed
        await db.updateSettingsSendMsg({ settings: newSettings })
      }

      log('event start/end dates', startDate, endDate)
      const query = eventInfo.query ? JSON.parse(JSON.stringify(eventInfo.query)) : {} // deep copy
      query.per_page || (query.per_page = 1)
      query.start_date || (query.start_date = startDate)
      query.end_date || (query.end_date = endDate)

      // issue a request to get the number of events
      const resp = await tecAxios.get(`/events?${helpers.serialize(query)}`)
      const totalEvents = resp.headers['x-tec-totalpages'] || 0
      log(`number of events: ${totalEvents} events`)

      // the REST API gives at most 100 events per page, so we need to grab all the pages
      const pages = []
      query.per_page = 100
      for (let i = 1; i <= Math.ceil(totalEvents / query.per_page); i++) {
        pages.push(i)
        log('event batch', i)
      }

      const eventsArray = await Promise.all(
        pages.map(async page => {
          const r = await tecAxios.get(
            `/events?${helpers.serialize(Object.assign(query, { page }))}`
          )
          return r.data.events
        })
      )
      return helpers.arrayFlatten(eventsArray)
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },
}

// For testing:
if (config.self_test && config.hasEvents) {
  const tecapiTesting = async () => {
    try {
      await helpers.waitForInitDone() // delay testing to make sure all modules are loaded
      log('Testing tecapi...')
      const events = await defaultExports.getEvents()
      if (!events || !events.length) {
        error('No events found, weird...')
        return
      }
      events.map(e => log(`Event name: ${he.decode(e.title)} / ${e.start_date}`))
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  }
  tecapiTesting()
}

export default defaultExports
