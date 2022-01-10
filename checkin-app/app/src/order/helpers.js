import dayjs from 'dayjs'
import debug from 'debug'

debug.enable('order/helpers:*')
// const log = debug('order/helpers:log')
// const info = debug('order/helpers:info')
// const error = debug('order/helpers:error')

export const getDate = date => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
