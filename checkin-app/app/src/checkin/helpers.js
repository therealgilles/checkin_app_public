import dayjs from 'dayjs'
import debug from 'debug'

debug.enable('checkin/helpers:*')
// const log = debug('checkin/helpers:log')
// const info = debug('checkin/helpers:info')
const error = debug('checkin/helpers:error')

export const getDate = date => dayjs(date).format('YYYY-MM-DD HH:mm:ss')

export const isCheckedIn = (checkins, checkinItems) => {
  for (const val of Object.values(checkinItems)) {
    if (!checkins[val.checkin_key]) {
      return false
    }
  }
  return true
}

export const getCheckinData = ({
  checkins,
  checkinItems,
  checkinUndo,
  checkinDate,
  checkinKey,
  // settings,
}) => {
  const date = checkinDate || (checkinUndo ? '' : dayjs().format('YYYY-MM-DD HH:mm:ss'))
  // log('getCheckinData checkins', checkins)
  // log('getCheckinData checkinUndo', checkinUndo)
  const checkinDataPerOrderId = {}
  Object.values(checkinItems).forEach(item => {
    const orderId = item.id
    // const key = (checkinKey || item.checkin_key).replace(new RegExp(`^#${orderId} (\\S+).*$`), '$1')
    // log('itemsDeselected', key, settings.itemsDeselected[key])
    // if (settings.itemsDeselected[key]) return // skip checkin if item is deselected

    if (checkinKey) {
      // checkin key provided
      if (checkinKey.match(new RegExp(`^#${orderId} `))) {
        // make sure checkin key matches order ID
        checkinDataPerOrderId[orderId] || (checkinDataPerOrderId[orderId] = {})
        checkinDataPerOrderId[orderId][checkinKey] = date
      } else {
        error('getCheckinData: checkin key', checkinKey, 'does not match order ID', orderId)
      }
    } else if (item.checkin_key && (checkinUndo || !checkins[item.checkin_key])) {
      // do not overwrite an existing checkin unless it's an undo
      checkinDataPerOrderId[orderId] || (checkinDataPerOrderId[orderId] = {})
      checkinDataPerOrderId[orderId][item.checkin_key] = date
    }
  })
  const checkinData = []
  Object.keys(checkinDataPerOrderId).forEach(orderId => {
    checkinData.push({ orderId, checkins: checkinDataPerOrderId[orderId] })
  })
  return checkinData
}

const getCheckinUndo = content => content.match(/checked in|undo/i)

const getCheckinButtonContent = checkedIn => (checkedIn ? 'Undo check\u00A0in' : 'Check in')

export const getCheckinInfo = ({ name, regId, checkins, checkinItems }) => {
  const localCheckins = checkins[0]
  const localCheckinItems = checkinItems[0]

  const checkedIn = isCheckedIn(localCheckins, localCheckinItems)

  const idx = `${regId} / ${name}`
  const content = getCheckinButtonContent(checkedIn)

  return { idx, content, checkedIn, localCheckins, localCheckinItems }
}

export const processCheckinRequest = ({
  name,
  regId,
  checkins,
  checkinItems,
  checkinRequest,
  settings,
}) => {
  const { idx, content, localCheckins, localCheckinItems } = getCheckinInfo({
    name,
    regId,
    checkins,
    checkinItems,
  })

  // log('onClickFunc settings.uiRegistrants', settings.uiRegistrants)
  // log('onClickFunc', idx, regId, localCheckins, localCheckinItems, getCheckinUndo(content))

  return checkinRequest(idx, regId, {
    checkins: localCheckins,
    checkinItems: localCheckinItems,
    checkinUndo: getCheckinUndo(content),
    clearSearchOnCheckIn: settings.uiRegistrants && settings.uiRegistrants.clearSearchOnCheckIn,
    settings,
  })
}
