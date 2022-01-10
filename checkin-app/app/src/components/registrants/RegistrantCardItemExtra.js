import React from 'react'
import PropTypes from 'prop-types'
import { Item } from 'semantic-ui-react'
import debug from 'debug'
import { getMatchingUniqueOrderItemKeys } from './helpers'

debug.enable('registrants/RegistrantCardItemExtra:*')
// const log = debug('registrants/RegistrantCardItemExtra:log')
// const info = debug('registrants/RegistrantCardItemExtra:info')
// const error = debug('registrants/RegistrantCardItemExtra:error')

const RegistrantCardItemExtra = ({ reg, name }) => {
  const matchingUniqueOrderItemKeys = getMatchingUniqueOrderItemKeys(reg.items, reg, name)
  if (!matchingUniqueOrderItemKeys.length) {
    return (null)
  }

  return (
    <Item.Extra>
      { matchingUniqueOrderItemKeys.map(key => (
        <div key={key} style={{ marginLeft: '-1em' }}>
          <div style={{ display: 'inline-block', marginLeft: '1em' }}>
            { reg.items[key].status === 'new' ? 'ORDER STATUS: new'
              : (
                <div style={{ display: 'inline-block' }}>
                  ORDER #
                  {`${reg.items[key].id} / `}
                  STATUS:
                  {` ${reg.items[key].status}`}
                </div>
              )
            }
          </div>
          <div style={{ display: 'inline-block', marginLeft: '1em', color: 'red' }}>
            { ((!reg.order_status[reg.items[key].id].match(/cancelled|trash/i))
                && (reg.payment_method[reg.items[key].id] === 'cod')
                && reg.total[reg.items[key].id])
              ? [1].map(() => {
                const discount = reg.discount_total ? reg.discount_total[reg.items[key].id] : '0'
                const total = Number(reg.total[reg.items[key].id]) - Number(discount)
                if (total > 0) return `** $${total} PAYMENT REQUIRED **`
                if (total < 0) return `** Discount amount too high, max is $${reg.total[reg.items[key].id]} **`
                return ''
              })
              : ''
            }
          </div>
        </div>
      ))}
    </Item.Extra>
  )
}

RegistrantCardItemExtra.propTypes = {
  reg: PropTypes.objectOf(() => true).isRequired,
  name: PropTypes.string.isRequired,
}

export default RegistrantCardItemExtra
