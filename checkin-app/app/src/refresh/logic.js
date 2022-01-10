import { createLogic } from 'redux-logic'
import debug from 'debug'
import {
  refreshFulfilled,
  refreshRejected,
  refreshUpdateInfo,
  REFRESH_REQUEST,
  REFRESH_CANCEL,
} from './actions'
import { setCancelledRequestId, getRequestId } from '../websocket/helpers'
import { actions as wsActions } from '../websocket'
import { httpRequestErrorMessage } from '../store/helpers'

debug.enable('refresh/logic:*')
// const log = debug('refresh/logic:log')
// const info = debug('refresh/logic:info')
const error = debug('refresh/logic:error')

export const refreshLogic = createLogic({
  type: REFRESH_REQUEST,
  cancelType: REFRESH_CANCEL,
  warnTimeout: 120 * 1000, // warn after 2min
  // latest: true, // take latest only

  // use axios injected as httpClient from configureStore logic deps
  // we also have access to getState and action in the first argument
  // but they were not needed for this particular code
  async process({ httpClient, getState, action, cancelled$ }, dispatch, done) {
    const idx = action.payload[0]
    // log('refreshLogic', idx)
    const refreshType = action.payload[1]
    const apiEndpoints = refreshType.match(/skip/i) ? action.payload[2] : [{ endpoint: 'refresh' }]
    const refreshGroups = apiEndpoints.map(i => i.endpoint)
    const reqId = getRequestId()

    try {
      cancelled$.subscribe(() => {
        setCancelledRequestId(reqId) // add request ID to cancelled request IDs list
        const msg = {
          reqId: 'client',
          cmd: 'cancelled request ID',
          data: { reqId },
        }
        dispatch(wsActions.msgSend(msg)) // tell server about cancelled request ID
        const cancelledRefreshGroups =
          refreshGroups.indexOf('refresh') >= 0
            ? action.payload[2].map(i => i.endpoint)
            : refreshGroups
        dispatch(refreshUpdateInfo('cancelled', cancelledRefreshGroups))
      })

      const resp = await Promise.all(
        apiEndpoints.map(async type => {
          try {
            const { data } = await httpClient.get(
              `/api/${type.endpoint}?reqId=${encodeURIComponent(reqId)}${
                type.query ? '&'.concat(type.query) : ''
              }`
            )
            return data
          } catch (err) {
            error(err)
            throw new Error(err)
          }
        })
      )
      if (!resp || !resp.length) {
        dispatch(refreshRejected(idx, refreshGroups, 'Missing response data'))
        return
      }

      const validRefreshGroups = []
      const invalidRefreshGroups = []
      refreshGroups.forEach((group, index) => {
        if (!resp[index]) {
          // || !resp[index].length) {
          invalidRefreshGroups.push(group)
        } else {
          validRefreshGroups.push(group)
        }
      })
      if (invalidRefreshGroups.length) {
        // log('refreshLogic invalid refresh groups rejected', idx, invalidRefreshGroups)
        dispatch(
          refreshRejected(
            idx,
            invalidRefreshGroups,
            `Missing response data for ${invalidRefreshGroups.join('/')}`
          )
        )
      }

      if (validRefreshGroups.length) {
        // log('dispatch refreshFulfilled', idx, validRefreshGroups, Object.keys(resp[0]).length, resp)
        dispatch(refreshFulfilled(idx, resp, validRefreshGroups))
      }
    } catch (err) {
      error(err)
      const errorMessage =
        err && Array.isArray(err)
          ? err.map(e => httpRequestErrorMessage('refreshLogic', e)).join(' ')
          : httpRequestErrorMessage('refreshLogic', err)
      dispatch(refreshRejected(idx, refreshGroups, errorMessage))
    } finally {
      done()
    }
  },
})

export default [refreshLogic]
