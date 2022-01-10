import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import debug from 'debug'

debug.enable('countdown:*')
// const log = debug('countdown:log')
// const info = debug('countdown:info')
// const error = debug('countdown:error')

function CountdownTimer({ updateFunc, started, startsIn, startedSuffix, interval }) {
  const [value, setValue] = useState(null)
  const [neg, setNeg] = useState(null)
  let timer

  const tick = () => {
    const { value: newValue, neg: newNeg } = updateFunc()
    setValue(newValue)
    setNeg(newNeg)
  }

  const startTimer = () => {
    tick()
    timer && clearInterval(timer)
    timer = setInterval(tick, interval)
  }

  const stopTimer = () => {
    clearInterval(timer)
  }

  useEffect(() => {
    startTimer()
    return () => stopTimer()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <p style={{ fontWeight: '300' }}>{neg ? started : startsIn}</p>
      <p className="countdown-timer">
        {value}
        {neg ? ` ${startedSuffix}` : ''}
      </p>
    </div>
  )
}

CountdownTimer.propTypes = {
  startsIn: PropTypes.string.isRequired,
  started: PropTypes.string.isRequired,
  startedSuffix: PropTypes.string.isRequired,
  updateFunc: PropTypes.func.isRequired,
  interval: PropTypes.number,
}
CountdownTimer.defaultProps = {
  interval: 1000,
}

export default CountdownTimer
