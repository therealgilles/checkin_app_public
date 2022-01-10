import moment from 'moment'
import debug from 'debug'
import diff from 'deep-diff'

debug.enable('settings/helpers:*')
// const log = debug('settings/helpers:log')
// const info = debug('settings/helpers:info')
// const error = debug('settings/helpers:error')

export const dateStringToMoment = date => (date ? moment(date) : null)

export const momentToDateString = m => (m ? m.format('YYYY-MM-DD') : null)

export const getCheckBoxTitle = item => {
  if (!item.event && item.product) return item.product.name
  const evt = item.event
  return evt.title.concat(
    evt.week_number
      ? ` (${evt.title.match(/series/i) ? 'series ' : ''}week ${evt.week_number})`
      : ''
  )
}

export const getButtonDisabled = (
  { events, itemsDeselected, uiRegistrants, uiItems, uiUsers },
  settings
) => {
  let cancelButtonDisabled = true
  let saveButtonDisabled = true

  if (events && settings.events && diff(events, settings.events)) {
    cancelButtonDisabled = false
    saveButtonDisabled = false
  }
  if (
    itemsDeselected &&
    settings.itemsDeselected &&
    diff(itemsDeselected, settings.itemsDeselected)
  ) {
    cancelButtonDisabled = false
    saveButtonDisabled = false
  }
  if (uiItems && settings.uiItems && diff(uiItems, settings.uiItems)) {
    cancelButtonDisabled = false
    saveButtonDisabled = false
  }
  if (uiRegistrants && settings.uiRegistrants && diff(uiRegistrants, settings.uiRegistrants)) {
    cancelButtonDisabled = false
    saveButtonDisabled = false
  }
  if (uiUsers && settings.uiUsers && diff(uiUsers, settings.uiUsers)) {
    cancelButtonDisabled = false
    saveButtonDisabled = false
  }

  // do not allow undefined dates
  if (
    events &&
    ((typeof events.start_date !== 'undefined' && !events.start_date) ||
      (typeof events.end_date !== 'undefined' && !events.end_date))
  ) {
    saveButtonDisabled = true
    cancelButtonDisabled = false
  }

  return [cancelButtonDisabled, saveButtonDisabled]
}

export const stringSort = (a, b) => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
