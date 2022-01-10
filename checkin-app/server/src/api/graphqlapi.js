// graphqlapi.mjs
//
// GraphQL API - only experimental at this point
//

import debug from 'debug'
import { GraphQLClient, gql } from 'graphql-request'
import config from '../config'

config.debug && debug.enable('graphqlapi:*')
const log = debug('graphqlapi:log')
// const info = debug('graphqlapi:info')
const error = debug('graphqlapi:error')

const client = new GraphQLClient(`${config.url}/${config.wpgraphql_endpoint}`)
client.setHeader('authorization', `Basic ${config.auth_token}`)

const defaultExports = {
  updateAuth: auth => {
    log('graphqlClient updateAuth', auth)
    client.setHeader('authorization', auth)
    defaultExports.makeRequest()
  },

  makeRequest: async () => {
    try {
      log('graphqlClient makeRequest')

      const result = await client.request(
        gql`
          query MyQuery {
            users(first: 100) {
              nodes {
                email
                firstName
                lastName
                username
                # birthdayDiscount
                # birthdayDiscountCredit
                # birthdayMonthYear
                # birthdayNeedsVerification
                # birthdayVerified
                avatar(size: 96) {
                  url
                }
                roles {
                  nodes {
                    ...NodeFields
                  }
                }
                whenLastLogin
              }
              pageInfo {
                hasNextPage
                endCursor
                hasPreviousPage
                startCursor
              }
            }
          }

          fragment NodeFields on UserRole {
            name
          }
        `
      )
      log(result.users.nodes.length, result.users.pageInfo)
    } catch (err) {
      throw new Error(err)
    }
  },
}

if (config.self_test) {
  const graphqlapiTesting = async () => {
    try {
      defaultExports.makeRequest()
    } catch (err) {
      error(err)
    }
  }
  graphqlapiTesting()
}

export default defaultExports

// __typename: 'RootQueryToUserConnection',
// nodes: [
//   {
//     __typename: 'User',
//     email: 'zygomorph125@gmail.com',
//     firstName: 'Dov',
//     lastName: 'Shlachter',
//     username: 'Zygomorph',
//     birthdayDiscount: null,
//     birthdayDiscountCredit: 0,
//     birthdayMonthYear: '03/1992',
//     birthdayNeedsVerification: null,
//     birthdayVerified: 'yes',
//     avatar: [Object],
//     roles: [Object],
//     whenLastLogin: 0
//   }
// ],
// pageInfo: {
//   hasNextPage: true,
//   endCursor: 'YXJyYXljb25uZWN0aW9uOjk1Mw==',
//   hasPreviousPage: false,
//   startCursor: 'YXJyYXljb25uZWN0aW9uOjcyMg=='
// }
// }
