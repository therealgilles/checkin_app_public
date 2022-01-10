// dbPlacements.mjs
//
// Read in google sheets file
//

import debug from 'debug'
import diff from 'deep-diff'
import config from '../config'
import helpers from '../helpers/helpers'
import db from './db'
import googlesheetsapi from '../api/googlesheetsapi'

config.debug && debug.enable('dbPlacements:*')
const log = debug('dbPlacements:log')
const info = debug('dbPlacements:info')
const error = debug('dbPlacements:error')

/**
 * Get student placement information from the spreadsheet specified in the config file
 */
const getPlacementsData = callback => {
  log('... getting placements data')
  const sheets = googlesheetsapi.sheets()
  const {
    spreadsheetId,
    range,
    nameRowNumber,
    emailRowNumber,
    trackRowNumber,
  } = config.googlesheets.files.placements
  sheets.spreadsheets.values.get({ spreadsheetId, range }, (err, res) => {
    if (err) {
      error(`The API returned an error: ${err}`)
      throw new Error(err)
    }
    const rows = res.data.values
    if (rows.length) {
      const newPlacements = {}
      rows.forEach(row => {
        const name = row[nameRowNumber]
        const email = row[emailRowNumber].toLowerCase()
        const trackName = row[trackRowNumber]
        const track = `${trackName} Track`
        if (helpers.objHasKey(newPlacements, email)) {
          Object.keys(newPlacements[email])
            .filter(n => n === name)
            .forEach(n => {
              if (newPlacements[email][n].track !== track) {
                error(`Found conflicting email entry for ${email} / ${name}`)
                error(track, '<=>', newPlacements[email][n].track)
              }
            })
        }
        newPlacements[email] || (newPlacements[email] = {})
        newPlacements[email][name] = { track }
      })
      return callback(newPlacements)
    }

    error('No data found.')
    return callback()
  })
}

let placements = {}
let pollInterval

const defaultExports = {
  placements,

  eventTrackPassProduct: config.products && config.products.event_track_pass_product,
  guestPassProduct: config.products && config.products.guest_pass_product,

  getPlacements: async ({ refresh = false }) => {
    try {
      // log('getPlacements')
      if (!refresh) return placements

      return new Promise(resolve => {
        getPlacementsData(resolve)
      }).then(async newPlacements => {
        placements = newPlacements
        await Promise.all(
          Object.keys(placements).map(email =>
            db.redisDbClient.hsetAsync('placements', email, JSON.stringify(placements[email]))
          )
        )
        return placements
      })
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  pollPlacements: async () => {
    try {
      log('pollPlacements')
      if (!Object.keys(db.registrantsByEmail).length) return // skip if we do not have registrants yet
      if (!Object.keys(placements).length) return // skip if we do not have saved placements yet

      const oldPlacements = JSON.parse(JSON.stringify(placements)) // deep copy
      const newPlacements = await defaultExports.getPlacements({ refresh: true })
      const placementsDiff = diff(oldPlacements, newPlacements)
      if (Object.keys(newPlacements).length && placementsDiff) {
        const emails = {}
        placementsDiff.forEach(entry => {
          entry.path
            .map(email => email.toLowerCase()) // make sure email is lowercase
            .forEach(email => {
              // log('found registrant placement to update', email)
              if (helpers.objHasKey(db.registrantsByEmail, email)) emails[email] = true
            })
        })

        log(emails)
        await Promise.all(
          Object.keys(emails).map(async email => {
            const registrantId = db.registrantsByEmail[email].id
            const registrantInfo = {
              query: { reqId: 'server', filterByItems: 'true', skipIfMissingAllItems: true },
              id: registrantId,
              sendMsg: true,
            }
            // log('refreshRegistrants', registrantId)
            return Promise.all(
              Object.keys(db.registrantsByEmail[email].orderIds).map(orderId =>
                db.refreshRegistrants(registrantInfo, { id: orderId })
              )
            )
          })
        )
      }
    } catch (err) {
      error('Fetching placement information failed')
      throw new Error(err)
    }
  },

  setupPollPlacements: async () => {
    try {
      if (!db.settings.uiRegistrants.pollPlacements) {
        pollInterval && clearInterval(pollInterval)
        pollInterval = null
        return Promise.resolve()
      }

      if (!pollInterval) {
        // launch a poll right away delay the settings update
        // await defaultExports.pollPlacements()
        pollInterval = setInterval(defaultExports.pollPlacements, 1000 * 60) // poll every minute
      }

      return Promise.resolve()
    } catch (err) {
      error(err)
      throw new Error(err)
    }
  },

  getTrack: ({ email, firstname, lastname }, orderId, item) => {
    // Add event pass track if found
    let trackProduct
    const guestPassProduct = defaultExports.guestPassProduct
    const eventTrackPassProduct = defaultExports.eventTrackPassProduct
    if (eventTrackPassProduct.id === item.product_id) trackProduct = eventTrackPassProduct
    if (guestPassProduct.id === item.product_id) trackProduct = guestPassProduct

    if (!trackProduct) return null

    let track
    if (trackProduct.variations) {
      // check hardcoded variations first
      trackProduct.variations
        .filter(v => v.id === item.variation_id)
        .forEach(v => {
          track = v.track
        })
    }
    if (!track && trackProduct.track) track = trackProduct.track // check hardcoded product next

    if (!track && helpers.objHasKey(placements, email)) {
      // check placements file
      const placement = placements[email]
      if (Object.keys(placement).length === 1) {
        track = placement[Object.keys(placement)[0]].track
      } else {
        for (const name in placement) {
          if (name.match(new RegExp(firstname, 'i'))) {
            track = placement[name].track
            break
          }
        }
        if (!track) {
          for (const name in placement) {
            if (name.match(new RegExp(lastname, 'i'))) {
              track = placement[name].track
              break
            }
          }
        }
      }
    }

    if (track) {
      info(`Found track for ${firstname} ${lastname}: ${track}`)
    } else {
      error('Placement not found for', email, '/', firstname, lastname)
      track = 'Missing Placement'
    }

    return track
  },

  settingsUpdated: async () => {
    if (config.use_placements) await defaultExports.setupPollPlacements()
  },
}

export default defaultExports

const initPlacements = async () => {
  try {
    await helpers.waitForInitDone()
    return defaultExports.setupPollPlacements()
  } catch (err) {
    error(err)
    throw new Error(err)
  }
}
config.use_placements && initPlacements()
