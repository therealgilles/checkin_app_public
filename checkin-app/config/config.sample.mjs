// config.sample.mjs
//
// Configuration options example
//

// Server config production mode
const production =
  process.env.CONFIG_MODE !== undefined
    ? process.env.CONFIG_MODE === 'production'
    : process.env.NODE_ENV === 'production'

const noSSL = process.env.NO_SSL !== undefined ? process.env.NO_SSL === 'true' : false
if (!noSSL && process.env.REACT_APP_UNENCRYPTED_BACKEND === 'true') {
  throw new Error(
    `noSSL=true and REACT_APP_UNENCRYPTED_BACKEND=${process.env.REACT_APP_UNENCRYPTED_BACKEND} are incompatible, please fix your config.`
  ) // eslint-disable-line max-len
}

const useGreenlock =
  process.env.USE_GREENLOCK !== undefined ? process.env.USE_GREENLOCK === 'true' : false
const LEServer = `https://acme-${
  process.env.USE_LETSENCRYPT_PROD === 'true' ? '' : 'staging-'
}v02.api.letsencrypt.org/directory`
const defaultSslPath = `./server/src/keys${
  !useGreenlock || process.env.USE_LETSENCRYPT_PROD === 'true' ? '' : '-staging'
}`

const clientHostPort = production
  ? null
  : process.env.CLIENT_HOST_PORT || 'INSERT DEFAULT CLIENT HOST PORT'

const config = {
  version: 'INSERT VERSION',
  appName: 'INSERT APP NAME',
  production,

  // enable/disable debug messages
  debug: process.env.DEBUG !== undefined ? process.env.DEBUG === 'true' : !production,
  self_test: process.env.SELF_TEST !== undefined ? process.env.SELF_TEST === 'true' : !production,

  no_ssr: process.env.NO_SSR !== undefined ? process.env.NO_SSR === 'true' : false,
  node_stream: process.env.NODE_STREAM !== undefined ? process.env.NODE_STREAM === 'true' : false,

  // ssl server config
  no_ssl: noSSL,
  use_greenlock: useGreenlock,
  letsencrypt_server: LEServer,
  ssl_email: 'INSERT SSL ADMIN EMAIL ADDRESS',
  https_force: process.env.FORCE_HTTPS !== undefined ? process.env.FORCE_HTTPS !== 'false' : true,
  domains: [process.env.DOMAIN || 'INSERT APP URL', 'EXTRA APP URL'],
  // client
  host: process.env.HOST || 'localhost',
  host_port: clientHostPort,
  // server
  http_port: process.env.PORT_HTTP || 'INSERT DEFAULT HTTP PORT',
  https_port: process.env.PORT_HTTPS || 'INSERT DEFAULT HTTPS PORT',
  ssl_path: process.env.SSL_PATH || 'INSERT DEFAULT SSL KEYS PATH',
  use_proxy: process.env.USE_PROXY !== undefined ? process.env.USE_PROXY === 'true' : false,
  // add console messages
  greenlock_debug:
    process.env.GREENLOCK_DEBUG !== undefined ? process.env.GREENLOCK_DEBUG !== 'false' : true,

  // cloudflare
  cloudflare_email: process.env.CLOUDFLARE_EMAIL || 'INSERT CLOUDFLARE EMAIL',
  cloudflare_api_key: process.env.CLOUDFLARE_API_KEY || 'INSERT CLOUDFLARE API KEY',

  // wordpress server
  url: process.env.WC_URL || 'INSERT WORDPRESS SERVER URL',

  // oauth
  oauthapi_path: '/oauth',
  oauth_authorize_path: '/oauth/authorize',
  oauth_port: clientHostPort,
  oauth_client_id: production
    ? 'INSERT OAUTH CLIENT ID PRODUCTION'
    : ( process.env.OAUTH_PORT === '8443'
        ? 'INSERT OAUTH CLIENT ID PORT 8443'
        : 'INSERT OAUTH CLIENT ID DEFAULT PORT' ), // eslint-disable-line no-nested-ternary,max-len
  oauth_client_secret: production
    ? 'INSERT OAUTH CLIENT SECRET PRODUCTION'
    : ( process.env.OAUTH_PORT === '8443'
        ? 'INSERT OAUTH CLIENT SECRET PORT 8443'
        : 'INSERT OAUTH CLIENT SECRET DEFAULT PORT' ), // eslint-disable-line no-nested-ternary,max-len
  oauth_token_path: '/oauth/token',
  oauth_grant_type: 'authorization_code',
  oauth_state_secret: 'INSERT OAUTH STATE SECRET',
  oauth_redirect_path: '/oauth_redirect/',
  oauth_user_regexp: 'INSERT OAUTH USER REGEXP',

  // WooCommerce REST API
  wcapi_version: 'INSERT WCAPI VERSION',
  wcapi_path: 'INSERT WCAPI PATH',
  webhook_port: clientHostPort,
  webhook_api_path: 'api/webhook',
  webhook_types: ['INSERT WEBHOOK TYPE'],
  wcapi_users: {
    default: {
      consumerKey: process.env.WCAPI_KEY || 'INSERT DEFAULT WCAPI KEY',
      consumerSecret: process.env.WCAPI_SECRET || 'INSERT DEFAULT WCAPI SECRET',
    },
  },

  // The Events Calendar REST API
  hasEvents: true,
  tecapi_version: 'INSERT TRIBE API VERSION',
  tecapi_path: 'INSERT TRIBE API PATH',

  // WordPress REST API
  wpapi_version: 'INSERT WPAPI VERSION',
  wpapi_path: 'INSERT WPAPI PATH',
  // Auth token using application password (generated with: echo -n "USERNAME:PASSWORD" | base64)
  auth_token: 'INSERT WPAPI AUTH TOKEN',

  // Wordpress GraphQL
  wpgraphql_endpoint: 'INSERT WPGRAPHQL ENDPOINT',

  // Redis
  redis_port:
    process.env.REDIS_PORT ||
    (production ? 'INSERT PRODUCTION REDIS PORT' : 'INSERT DEV REDIS PORT'),
  redis_host: process.env.REDIS_SERVER || (production ? 'redis' : '127.0.0.1'),
  redis_prefix: 'namespace:wnhcheckinapp-',
  redis_log_errors: !production,

  // session
  secure_cookie: production,
  samesite_cookie: 'strict',

  // users
  users: {
    test_user: 'INSERT TEST USER ID',
  },

  // orders
  orders: {
    statuses: ['completed', 'processing', 'on-hold'],
  },

  // users
  products: {
    use_product_name_as_slug: false,
    test_product: 'INSERT TEST PRODUCT ID',
  },

  // store credit
  support_store_credit: false,

  // track placements
  use_placements: false,

  // google sheets
  googlesheets: {
    credentials_path: process.env.CREDENTIALS_PATH || process.env.SSL_PATH || defaultSslPath,
    credentials_filename: 'google_service_account_credentials.json',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    files: {
      placements: {
        spreadsheetId: 'INSERT SPREADSHEET ID',
        range: 'INSERT SPREADSHEET RANGE',
        nameRowNumber: 'INSERT NAME ROW NUMBER',
        emailRowNumber: 'INSERT EMAIL ROW NUMBER',
        trackRowNumber: 'INSERT TRACK ROW NUMBER',
      },
    },
  },
}

export default config
