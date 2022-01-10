import debug from 'debug'

debug.enable('store/helpers:*')
// const log = debug('store/helpers:log')
// const info = debug('store/helpers:info')
const error = debug('store/helpers:error')

export const httpRequestErrorMessage = (logic, err) => {
  let errorMessage = err
  let errorType = ''

  if (err.response) {
    errorMessage = err.response.data
    errorType = 'response'
  } else if (err.request) {
    errorMessage = err.request
    errorType = 'request'
  } else {
    errorMessage = err.message
    errorType = 'message'
  }

  error(`${logic} error ${errorType}`, errorMessage)
  return errorMessage
}

export const anyToString = any => ((typeof any !== 'string') ? JSON.stringify(any) : any)
