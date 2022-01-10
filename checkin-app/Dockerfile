FROM node:15.8.0-alpine

# Get args from docker-compose
ARG NODE_ENV=development
ARG PORT_HTTP=8888
ARG PORT_HTTPS=8443
ARG CONFIG_FILE=config.mjs
ARG PROCESS_FILE=process.json
ARG FAVICON_FILE=favicon.ico
ARG HOST=localhost

# Create env vars
ENV NODE_ENV ${NODE_ENV}
ENV PORT_HTTP ${PORT_HTTP}
ENV PORT_HTTPS ${PORT_HTTPS}
ENV CONFIG_FILE ${CONFIG_FILE}
ENV PROCESS_FILE ${PROCESS_FILE}
ENV FAVICON_FILE ${FAVICON_FILE}
ENV HOST ${HOST}
ENV NO_HUSKY true

# Display NODE_ENV
RUN echo NODE_ENV=${NODE_ENV}

# Update npm
RUN npm install -g npm@7.5.3

# Install python for node-gyp package (production only)
RUN if [ "${NODE_ENV}" = "production" ]; then apk --no-cache add --virtual native-deps g++ gcc libgcc libstdc++ linux-headers make python && \
  npm install --quiet node-gyp -g && \
  apk del native-deps; fi

# Create 'app' user (to avoid using root)
#   -S system group, -g gid is 1046 (need to have a matching group on server)
#   -S system user, -g no gecos, -D don't assign password
RUN addgroup -S -g 1046 app_user
RUN adduser -S -D -g '' -G app_user app_user

# SSL certificates now in /etc/letsencrypt/
## Create SSL certificates directory
##RUN mkdir -p /etc/certs && chown -R app_user:app_user /etc/certs && chmod 755 /etc/certs && ls -l /etc/certs

# Set environment variables
ENV appDir /home/app_user/checkin-app

# Working directory for application (this creates the dir if it does not exist)
WORKDIR ${appDir}
RUN chown -R app_user:app_user /home/app_user
USER app_user

# Install launcher
RUN mkdir -p launcher
COPY --chown=app_user:app_user launcher/package.json launcher/
RUN cd launcher && npm install --quiet && ls -l .

# Copy bin directory
RUN mkdir -p bin
COPY bin bin

# Install node modules (also install dev dependencies)
COPY --chown=app_user:app_user package.json package.json
RUN npm install --legacy-peer-deps --quiet && ls -l .

# Create public dir
RUN mkdir -p public
COPY app/public/${FAVICON_FILE} public/favicon.ico

# Create app dir and copy app source files
RUN mkdir -p app
COPY app/src app/src

# Create server dir and copy server source files
RUN mkdir -p server
COPY server/src server/src

# Copy server config file
RUN mkdir -p config
COPY config/${CONFIG_FILE} config/config.mjs

# Copy razzle config files
COPY --chown=app_user:app_user razzle.config.js razzle.config.js
COPY --chown=app_user:app_user jsconfig.json jsconfig.json
COPY --chown=app_user:app_user .babelrc .babelrc
#COPY --chown=app_user:app_user .env .env

# Create build dir and build app and server assets
RUN mkdir -p build
RUN npm run build && ls -l build

# Copy launcher config file
COPY launcher/${PROCESS_FILE} launcher/${PROCESS_FILE}

# Expose server ports
EXPOSE ${PORT_HTTPS} ${PORT_HTTP}

# Creates mount points
VOLUME [ "/etc/letsencrypt", "/data", "/etc/google" ]

# Launch server
CMD ./launcher/node_modules/pm2/bin/pm2-docker ./launcher/${PROCESS_FILE} --env ${NODE_ENV} --no-daemon
