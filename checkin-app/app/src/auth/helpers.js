import debug from 'debug'

debug.enable('auth/helpers:*')
// const log = debug('auth/helpers:log')
// const info = debug('auth/helpers:info')
// const error = debug('auth/helpers:error')

// const getPopupOffset = ({ width, height }) => {
//   const wLeft = window.screenLeft ? window.screenLeft : window.screenX
//   const wTop = window.screenTop ? window.screenTop : window.screenY
//
//   const left = wLeft + window.innerWidth / 2 - width / 2
//   const top = wTop + window.innerHeight / 2 - height / 2
//
//   return { top, left }
// }

// eslint-disable-next-line import/prefer-default-export
// export const authPopup = url => {
//   const settings = 'scrollbars=no,toolbar=no,location=no,titlebar=no,directories=no,status=no,menubar=no'
//   const { width, height } = { width: 800, height: 600 }
//   const { top, left } = getPopupOffset({ width, height })
//   const popupDimensions = `width=${width},height=${height},top=${top},left=${left}`
//
//   const popup = window.open(url, 'OAuth Popup', `${settings},${popupDimensions}`) // open pop-up window
//
//   const pollPopup = (resolve, reject) => {
//     try {
//       log('pollPopup', popup.location.href)
//       if (!popup.location || !popup.location.href) {
//         return reject(new Error('Authorization failed'))
//       }
//       if (popup.location.href.match(/oauth_redirect/)) {
//         popup.close()
//         return resolve()
//       }
//     } catch (err) {
//       error(err)
//     }
//     return setTimeout(() => pollPopup(resolve, reject), 500)
//   }
//
//   return new Promise((resolve, reject) => pollPopup(resolve, reject))
// }
