# README

## Table of Contents

- [Description](#description)
- [Setup](#setup)
- [To Do](#to-do)
- [Maintainers](#maintainers)
- [Contributing](#contributing)
- [License](#license)

## Description

### Summary

This is an attendance check-in application linked to the [Wednesday Night HOP (WNH)](https://wednesdaynighthop.com) and [Swingin' at the Savoy (SATS)](https://swinginatthesavoy.com) websites. It is used by the front desk staff to check people in as they come in to the venue.

The applications run at:

- WNH: https://checkin.wednesdaynighthop.com
- SATS: https://checkin.swinginatthesavoy.com

Both applications have been used in production. The WNH application has been used weekly at the Wednesday Night Hop venue since 2017 (when the venue is open). The SATS application was used at the SATS weekend events in February 2019 and 2020.

### Structure

The application is made of a [React](https://reactjs.org/) front-end connected to a [node](https://nodejs.org/) server backend, which uses a persistent [Redis](https://redis.io/) database. The node server backend communicates with the website [WordPress](https://wordpress.org/) backend to gather users information, such as:

- first/last names,
- email,
- orders (from the WordPress WooCommerce store)
- class, event track, and dance attendance
- discount eligibility
- apparel pickup

For the SATS event, users track placement is accessed from a Google Sheet using the Google Sheets API.

The application can be run on multiple browsers simultaneously as the server communicates updates to all its browser clients through websockets.

### Purpose

The application allows the front desk staff to check people in, register them for a particular class/track/dance, switch them to a different class/track/dance, cancel orders, issue refunds, store private order note, or send public order note to users.

### Screenshots

#### WNH attendance check-in app

![Screenshot of the WNH attendance check-in page](wnh-checkin-app-screenshot.png?raw=true 'Screenshot of the WNH attendance check-in page')

#### SATS attendance check-in app

![Screenshot of the SATS attendance check-in page](sats-checkin-app-screenshot.png?raw=true 'Screenshot of the SATS attendance check-in page')

### Version

The application version is stored in the configuration files under the [checkin-app/config/](checkin-app/config/) directory. It is not stored in this repo for security reasons.

If the version gets updated while the application is running (in a browser), a websocket message is sent to the browser asking the app user to refresh to use the updated version.

The version should be manually updated in all configuration files when any code changes are made.

## Setup

### Summary

The server and client applications are compiled and serve using [docker-machine](https://gitlab.com/gitlab-org/ci-cd/docker-machine/-/releases) and docker-compose, on a Digital Ocean droplet. [PM2](https://github.com/Unitech/pm2) is used to launch and manage the server process. The droplet runs an [OpenLiteSpeed (OLS)](https://openlitespeed.org/) server. The app server is run behind a reverse proxy, which provides SSL.

SSL certificates are setup and automatically updated on the droplet for production[^1].

The app server is run in http mode (not https) behind the reverse proxy as OLS does not support proxying secure websockets at this time.

### Install

This repo can be built with npm v8.1.0 and node v16.13.0. The Dockerfile uses node v15.8.0 and npm v7.5.3.

```shell
git clone git@github.com:therealgilles/checkin_app_public.git
cd checkin-app
npm install
cd launcher
npm install
```

then proceed to create a configuration file and add a favicon file (see [Configuration](#configuration)).

### Configuration

The configuration files are under the [checkin-app/config/](checkin-app/config/) directory, and are not stored in the repo for security reasons. There is a sample [checkin-app/config/config.sample.mjs](checkin-app/config/config.sample.mjs) showing the configurable options.

The config files are named config._SITE_.cfg where _SITE_ is either 'wnh' or 'sats'.

A favicon file should be installed under [checkin-app/app/public/](checkin-app/app/public/)favicon._SITE_.ico.

### Dependencies

The backend is a node [Express](https://expressjs.com/) server communicating with the front-end through websockets.
It uses a persistent Redis database, OAuth authentication, and multiple APIs such as [WooCommerce](https://woocommerce.github.io/woocommerce-rest-api-docs/) and [Google Sheets](https://developers.google.com/sheets/api). It uses [Razzle](https://razzlejs.org/) to make the app universal (with server-side rendering).

The front-end is based on [create-react-app](https://create-react-app.dev/) and uses [redux](https://redux.js.org/) and [rxjs](https://rxjs.dev/) through [redux-logic](https://github.com/jeffbski/redux-logic), as well as [Semantic UI React](https://react.semantic-ui.com/) and [Fomantic UI](http://github.com/fomantic/Fomantic-UI/) for its UI elements. A distribution of Fomantic UI is installed under [checkin-app/app/src/semantic-ui/](checkin-app/app/src/semantic-ui/) due to some compatibility issues with Semantic UI React.

The server relies on the WNH/SATS websites being properly setup to communicate. This setup is beyond the scope of this document. It includes:

- the [WP OAuth Server Pro](https://wp-oauth.com/) plugin for OAuth authentication
- a dedicated check-in app user (with WooCommerce store access)
- multiple WooCommerce API users to gather discounted pricing (when applicable)
- custom PHP code on the servers for attendance check-in and discount eligibility custom fields
- custom PHP code on the servers for order notes

### Database configuration

Users as well as store products (classes, dances, and apparel) and orders information is stored on the server on the Redis database. The database is configured to be persistent so that the data does not need to be reloaded on server restart. The Redis database is also used to queue attendance update requests between the backend server and the website WordPress backend.

### How to do local development

You will need a self-signed SSL certificate to run the local server, [see below](#self-signed-ssl). A local server can be started using the following commands:

```shell
cd checkin-app
# launch the app for the WNH website
SITE=wnh npm start
## OR
# launch the app for the SATS website
SITE=sats npm start
```

The app will be available on: `https://localhost:3000`

Razzle provides auto-reload on file changes but the server may need to be restarted if some of the main server files are changed (like the config file).

The server can be stopped at any time using ^C. The server is started using the trap utility to capture the SIGINT signal and try to exit the server without leaving any running process behind. It is good to check once in a while that no related node processes are running.

The local development SSL certificates are under [checkin-app/server/src/keys/](checkin-app/server/src/keys/).
They include a self-signed root certificate authority and a self-signed certificate. They are not stored in the repo for security reasons.

**IMPORTANT:** The self-signed root certificate authority needs to be added to the MacOS KeyChain Access application and set to 'Always Trust', in order for the browsers to accept it as a valid certificate authority.

<details><summary><a id="self-signed-ssl"><b>How to generate self-signed root certificate authority & self-signed certificate for the development server/app</b></a></summary>

```shell
cd server/src/keys
# create the Root Certificate Authority
openssl genrsa -des3 -out rootCA.key 2048
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 3650 -out rootCA.pem
# create the self-signed certificate and associate it with the Root Certificate Authority
openssl req -new -nodes -out server.csr -newkey rsa:2048 -keyout server.key
openssl x509 -req -in server.csr -CA rootCA.pem -CAkey rootCA.key -CAcreateserial -out server.crt -days 500 -sha256 -extfile v3.ext
# if a .pfx file is needed:
# openssl pkcs12 -inkey server.key -in server.crt -export -out server.pfx
cp server.key privkey.pem ; cp server.crt fullchain.pem
# update the webpack-web-server certificate
cat privkey.pem fullchain.pem > ../../../app/node_modules/webpack-dev-server/ssl/server.pem
```

rootCA.pem needs to be added to the system keychain and set to 'Always Trust'.

Here are the parameters needed while running the above commands:

```shell
# Root Certificate Authority
Passphrase:    enter-your-own-passphrase
Country:       enter-your-country
State:         enter-your-state
Locality Name: enter-your-locality-name
Organization:  enter-your-root-certificate-authority-name
Org. Unit:     enter-your-root-certificate-authority-org-unit
Common Name:   enter-root-your-certificate-common-name
Email Address: enter-your-email-address

# Self-Signed Certificate
Country:       nter-your-country
State:         enter-your-state
Locality Name: enter-your-locality-name
Organization:  enter-your-organization
Org. Unit:     enter-your-org-unit
Common Name:   localhost
Email Address: enter-your-email-address
Challenge password: enter-your-challenge-password
```

</details>

### How to locally test the production build

The app can be built with:

```shell
cd checkin-app
SITE=wnh npm build
```

The production build can be tested locally by using:

```shell
cd checkin-app
npm run start:prod_local_testing
```

The app will then be available on: `https://localhost:8443`

### How to run tests

Tests can be run as follows:

#### Server tests

```shell
cd checkin-app
# in batch mode
npm run test:server
# OR interactively
npm run razzle-test:server
```

#### App tests

```shell
cd checkin-app
# in batch mode
npm run test:app
# OR interactively
npm run razzle-test:app
```

### Deployment instructions

The server and app are deployed on a pre-configured Digital Ocean droplet using docker-machine.

```shell
# Setup the docker-machine environment for the droplet
eval $(docker-machine env droplet-openlitespeed-server)

# Build and deploy the server/app/database for the WNH website
docker-compose -f docker-compose-production-ssr.wnh.yml up --build -d web-wnh redis

# Build and deploy the server/app for the SATS website (the redis database is shared)
docker-compose -f docker-compose-production-ssr.sats.yml up --build -d web-sats
```

## To Do

- [ ] Update the spdy package and re-enable http2.
- [ ] Update Dockerfile node/npm versions.
- [ ] Update packages.

## Maintainers

[@therealgilles](https://github.com/therealgilles)

## Contributing

This project does not accept any contributions at this time.

### Code Formatting

This project uses [prettier](https://github.com/prettier/prettier) for code formatting.
[ESLint](https://eslint.org/) is run automatically on git commit through [husky](https://github.com/typicode/husky) using [lint-staged](https://github.com/okonet/lint-staged).

## License

This repository is proprietary and property of Silicon Valley Swing Dance LLC.

<br>

[^1]: SSL certificates used to be handled directly from the app server with [Greenlock](https://github.com/coolaj86/greenlock) but the package functionality was broken by its author and it became unusable. Traces of Greenlock still remain in the code.
