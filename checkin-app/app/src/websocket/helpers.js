import debug from 'debug'

debug.enable('websocket/helpers:*')
const log = debug('websocket/helpers:log')
// const info = debug('websocket/helpers:info')
const error = debug('websocket/helpers:error')

let clientId

const cancelledReqIds = {} // keep track of cancelled request IDs

export const setClientId = prefix => {
  clientId = prefix
}

export const getRequestId = () => {
  let requestId = localStorage.getItem('requestIdCounter')

  if (requestId === undefined || isNaN(requestId)) {
    requestId = -1
  } else {
    requestId = Number(requestId)
  }

  requestId += 1
  localStorage.setItem('requestIdCounter', requestId)

  if (!clientId) error('clientId is not set!')

  return `${clientId}-${requestId}`
}

export const setCancelledRequestId = reqId => {
  if (reqId !== undefined) {
    log(`Adding request ID ${reqId} to cancelled request IDs list`)
    cancelledReqIds[reqId] = true
  }
}

export const isCancelledRequestId = reqId => reqId !== undefined && cancelledReqIds[reqId] === true
