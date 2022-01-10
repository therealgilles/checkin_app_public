import React, { useState, useEffect } from 'react'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import debug from 'debug'
import { Table } from 'semantic-ui-react'
import { selectors as refreshSelectors } from '../../refresh'
import { selectors as checkinSelectors, actions as checkinActions } from '../../checkin'
import { getCheckedInStatus, getCheckinMarker, getStateFromProps } from './helpers'
import './style.css'

debug.enable('attendance/index:*')
// const log = debug('attendance/index:log')
// const info = debug('attendance/index:info')
// const error = debug('attendance/index:error')

function Attendance({ reg, name, regItemKey, allItems, checkinRequest, checkinStatus, settings }) {
  const [weekNumbers, setWeekNumbers] = useState(null)
  const [weekNumber, setWeekNumber] = useState(null)
  const [checkinKeys, setCheckinKeys] = useState(null)

  useEffect(() => {
    const {
      weekNumbers: newWeekNumbers,
      weekNumber: newWeekNumber,
      checkinKeys: newCheckinKeys,
    } = getStateFromProps({ reg, regItemKey, allItems })

    setWeekNumbers(newWeekNumbers)
    setWeekNumber(newWeekNumber)
    setCheckinKeys(newCheckinKeys)
  }, [reg, regItemKey, allItems])

  const getIdx = week => `${reg.id} / ${name} / ${regItemKey} / ${week}`

  const onClick = week => {
    const status = getCheckedInStatus(reg.checkins, checkinKeys, week, weekNumber)

    const idx = getIdx(week)
    const checkins = reg.checkins
    const item = reg.items[regItemKey]
    const checkinItems = { [regItemKey]: item }
    const checkinUndo = status === 'unknown' || status === 'late'
    const weekCheckinKey = item.checkin_keys[Math.min(item.checkin_keys.length, week) - 1]
    const checkinKeyDate = weekCheckinKey.replace(/^.* (\S+ \S+) week\d+$/, '$1')

    let checkinDate
    if (status === 'okay') {
      checkinDate = dayjs(checkinKeyDate).add(10, 'm').format('YYYY-MM-DD HH:mm:ss')
    } else if (status === 'missed') {
      checkinDate = dayjs(checkinKeyDate).subtract(10, 'm').format('YYYY-MM-DD HH:mm:ss')
    }

    // log('checkinRequest', idx, reg.id, { checkins, checkinItems, checkinUndo, checkinKey: weekCheckinKey, checkinDate })
    checkinRequest(idx, reg.id, {
      checkins,
      checkinItems,
      checkinUndo,
      checkinKey: weekCheckinKey,
      checkinDate,
      clearSearchOnCheckIn: false, // do not clear search when doing checkins through the attendance buttons
      settings,
    })
  }

  return (
    <Table
      celled
      structured
      collapsing
      compact
      singleLine
      unstackable
      textAlign="center"
      className="attendance-table"
    >
      <Table.Body>
        <Table.Row>
          {(weekNumbers || []).map(week => (
            <Table.Cell
              selectable
              key={week}
              width="1"
              disabled={week > weekNumber}
              className="attendance-markers"
            >
              <button
                type="button"
                onClick={() => onClick(week)}
                tabIndex={week === weekNumber ? 0 : -1}
              >
                {getCheckinMarker(
                  checkinStatus[getIdx(week)],
                  getCheckedInStatus(reg.checkins, checkinKeys, week, weekNumber)
                ) || <span className="week-numbers">{week}</span>}
              </button>
            </Table.Cell>
          ))}
        </Table.Row>
      </Table.Body>
    </Table>
  )
}

Attendance.propTypes = {
  reg: PropTypes.objectOf(() => true).isRequired,
  name: PropTypes.string.isRequired,
  regItemKey: PropTypes.string.isRequired,
  allItems: PropTypes.objectOf(() => true).isRequired,
  checkinRequest: PropTypes.func.isRequired,
  checkinStatus: PropTypes.objectOf(() => true).isRequired,
  settings: PropTypes.objectOf(() => true).isRequired,
}

const mapStateToProps = state => ({
  allItems: refreshSelectors.allItems(state),
  settings: refreshSelectors.settings(state),
  checkinStatus: checkinSelectors.checkinStatus(state),
})

const mapDispatchToProps = dispatch =>
  bindActionCreators(
    {
      checkinRequest: checkinActions.checkinRequest,
    },
    dispatch
  )

export default connect(mapStateToProps, mapDispatchToProps)(Attendance)
