import dayjs from 'dayjs'

export const getTimeRange = (startDate, endDate) =>
  `${dayjs(startDate).format('h:mm')} - ${dayjs(endDate).format('h:mm A')}`
export const resizeImage = html => `${html}`.replace(/1\d\dx1\d\d/, '150x150')
export const getImageSrc = html => resizeImage(html).match(/^.* src="([^"]+)" .*$/)[1]

export const formatDuration = (from, to) => {
  const diffMin = to.diff(from, 'minute')
  const hours = diffMin / 60
  const mins = Math.abs(diffMin % 60)
  const value = `${Math.trunc(hours)} hr${hours > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`
  return { value, neg: hours < 0 }
}

// const padNumber = (n, size) => ('0'.repeat(size - 1) + n).slice(-size)
