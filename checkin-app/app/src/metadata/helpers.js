import dayjs from 'dayjs'
import debug from 'debug'

debug.enable('metadata/helpers:*')
// const log = debug('metadata/helpers:log')
// const info = debug('metadata/helpers:info')
// const error = debug('metadata/helpers:error')

export const getDate = date => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

const thisMonth = () => dayjs().format('MM')
const getBirthdayMonth = birthdayMonthYear => birthdayMonthYear.replace(/\/.*$/, '')

export const isBirthdayThisMonth = birthdayMonthYear =>
  getBirthdayMonth(birthdayMonthYear) === thisMonth()
