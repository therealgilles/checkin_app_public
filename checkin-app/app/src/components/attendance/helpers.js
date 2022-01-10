import React from 'react'
import debug from 'debug'
import dayjs from 'dayjs'
import { Icon } from 'semantic-ui-react'

debug.enable('attendance/helpers:*')
// const log = debug('attendance/helpers:log')
// const info = debug('attendance/helpers:info')
// const error = debug('attendance/helpers:error')

export const getCheckedInStatus = (checkins, checkinKeys, week, weekNumber) => {
  if (week > weekNumber) return 'empty'

  if (!checkinKeys || !checkins) return 'unknown'

  const weekCheckinKey = checkinKeys[Math.min(checkinKeys.length, week) - 1]
  if (!weekCheckinKey) return 'unknown'

  const weekCheckinDate = checkins[weekCheckinKey]
  if (!weekCheckinDate) {
    return week === weekNumber ? 'empty' : 'missed'
  }

  const weekCheckinKeyDate = weekCheckinKey.replace(/^.* (\S+ \S+) week\d+$/, '$1')
  const dateDiff = dayjs(weekCheckinDate).diff(dayjs(weekCheckinKeyDate))
  return dateDiff <= 0 ? 'okay' : 'late'
}

export const getCheckinMarker = (checkinRequestStatus, status) => {
  // log('checkinRequestStatus', checkinRequestStatus)
  const loading = checkinRequestStatus ? !!checkinRequestStatus.match(/ing/) : undefined // FIXME /ing/
  const iconprops = {
    size: 'large',
    loading,
  }
  const checkinMarker = {
    /* eslint-disable react/jsx-props-no-spreading */
    okay: <Icon color="green" name="checkmark" {...iconprops} />,
    late: <Icon color="orange" name="clock" {...iconprops} />,
    missed: <Icon color="red" name="x" {...iconprops} />,
    unknown: <Icon color="purple" name="question" {...iconprops} />,
    loading: <Icon name="circle notched" {...iconprops} />,
    /* eslint-enable react/jsx-props-no-spreading */
    empty: '',
  }
  return checkinMarker[loading ? 'loading' : status]
}

export const getStateFromProps = ({ reg, regItemKey, allItems }) => {
  const productId = reg.items[regItemKey].item_product_id
  const currentItemArray = Object.values(allItems).filter(
    item => item.product && item.product.id === productId
  )

  const firstCurrentItemHasEvent = currentItemArray.length && currentItemArray[0].event
  const weekNumbers = firstCurrentItemHasEvent
    ? currentItemArray[0].event.week_numbers.map(n => Number(n))
    : undefined
  const weekNumber = firstCurrentItemHasEvent
    ? Number(currentItemArray[0].event.week_number)
    : undefined
  const startDates = firstCurrentItemHasEvent ? currentItemArray[0].event.start_dates : undefined

  // const checkinKey = reg.items[regItemKey].checkin_key
  const checkinKeys = reg.items[regItemKey].checkin_keys

  return { weekNumbers, weekNumber, startDates, checkinKeys }
}
