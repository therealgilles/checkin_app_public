import { logic as refreshLogic } from '../refresh'
import { logic as checkinLogic } from '../checkin'
import { logic as websocketLogic } from '../websocket'
import { logic as authLogic } from '../auth'
import { logic as searchLogic } from '../search'
import { logic as orderLogic } from '../order'
import { logic as metaDataLogic } from '../metadata'

export default [
  ...refreshLogic,
  ...checkinLogic,
  ...websocketLogic,
  ...authLogic,
  ...searchLogic,
  ...orderLogic,
  ...metaDataLogic,
]
