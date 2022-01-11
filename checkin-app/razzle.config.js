// razzle.config.js

const path = require('path')
const fs = require('fs')
// const MiniCssExtractPlugin = require('mini-css-extract-plugin') // eslint-disable-line import/no-extraneous-dependencies
// const context = path.resolve(__dirname, 'app', 'src')

/* eslint-disable no-param-reassign */

module.exports = {
  options: {
    verbose: true,
    debug: {
      // nodeExternals: true,
    },
    // staticCssInDev: true, // static css in development
  },

  // razzle plugins
  plugins: [
    // Enable to get bundle statistics during production build
    // {
    //   name: 'bundle-analyzer',
    //   options: {
    //     target: 'web', // or 'node'
    //     env: 'production', // or 'development'
    //     bundleAnalyzerConfig: {
    //       // Use this to generate stats.json file
    //       // analyzerMode: 'disabled',
    //       // generateStatsFile: true,
    //       // // Excludes module sources from stats file so there won't be any sensitive data
    //       // statsOptions: { source: false },
    //     },
    //   },
    // },
    'disable-sourcemaps-production',
    // 'disable-sourcemaps',
  ],

  modifyOptions({
    webpackObject, // the imported webpack node module
    options: {
      pluginOptions, // the options passed to the plugin ({ name:'pluginname', options: { key: 'value'}})
      razzleOptions, // the default options/ options passed to Razzle in the `options` key in `razzle.config.js` (options: { key: 'value'})
    },
  }) {
    // set server host port
    razzleOptions.port = parseInt(process.env.PORT_HTTP, 10)

    return razzleOptions
  },

  modifyWebpackOptions({
    env: {
      target, // the target 'node' or 'web'
      dev, // is this a development build? true or false
    },
    webpackObject, // the imported webpack node module
    options: {
      pluginOptions, // the options passed to the plugin ({ name:'pluginname', options: { key: 'value'}})
      razzleOptions, // the modified options passed to Razzle in the `options` key in `razzle.config.js` (options: { key: 'value'})
      webpackOptions, // the default options that will be used to configure webpack/ webpack loaders and plugins
    },
    paths, // the modified paths that will be used by Razzle.
  }) {
    // webpack does not understand class fields (yet), so we need to keep this library external
    // webpackOptions.nodeExternals = [
    //   { 'simple-oauth2': `commonjs ../server/node_modules/simple-oauth2` },
    // ]

    return webpackOptions
  },

  modifyWebpackConfig({
    env: {
      target, // the target 'node' or 'web'
      dev, // is this a development build? true or false
    },
    webpackConfig, // the created webpack config
    webpackObject, // the imported webpack node module
    options: {
      razzleOptions, // the modified options passed to Razzle in the `options` key in `razzle.config.js` (options: { key: 'value'})
      webpackOptions, // the modified options that will be used to configure webpack/ webpack loaders and plugins
    },
    paths, // the modified paths that will be used by Razzle.
  }) {
    // tell webpack where to search for node_modules
    // webpackConfig.resolve.modules = [
    //   path.resolve(__dirname, 'node_modules'),
    //   path.resolve(__dirname, 'app/node_modules'),
    //   path.resolve(__dirname, 'server/node_modules'),
    //   'node_modules',
    // ]

    // console.log('webpackConfig.resolve.modules', webpackConfig.resolve.modules)

    if (target === 'web' && dev) {
      const targetHost = process.env.SERVER_HTTP_PATH

      console.log('Server will be running at', targetHost)
      webpackConfig.devServer.proxy = {
        '/ws': {
          target: targetHost,
          secure: false,
          ws: true,
          logLevel: 'silent', // silence proxy
          onError: (err, req, res) => {
            // console.error(err)
          },
        },
        '!/static': {
          target: targetHost,
          secure: false,
          logLevel: 'silent', // silence proxy
        },
      }
    }

    // use https for the client webpack-dev-server
    if (dev) {
      if (target === 'web') {
        webpackConfig.devServer.http2 = true
        webpackConfig.devServer.https = {
          key: fs.readFileSync(process.env.CLIENT_DEV_SERVER_HTTPS_PRIVKEY),
          cert: fs.readFileSync(process.env.CLIENT_DEV_SERVER_HTTPS_CERT),
        }
      }
    }

    // only include the english locale for momentjs
    webpackConfig.plugins.push(
      new webpackObject.ContextReplacementPlugin(/moment[/\\]locale$/, /en/)
    )

    // webpackConfig.module.rules.push(
    //   // Loader configurations for semantic-ui-less
    //   {
    //     // Load .less files from semantic-ui-less module folder
    //     test: /\.less$/i,
    //     include: /[/\\]node_modules[/\\]semantic-ui-less[/\\]/,
    //     use: [
    //       MiniCssExtractPlugin.loader,
    //       // Set importLoaders to 2, because there are two more loaders in the chain (postcss-loader
    //       // and semantic-ui-less-module-loader), which shall be used when loading @import resources
    //       // in CSS files:
    //       { loader: 'css-loader', options: { importLoaders: 2, sourceMap: true } },
    //       { loader: 'postcss-loader', options: { sourceMap: true } },
    //       {
    //         loader: 'semantic-ui-less-module-loader',
    //         options: {
    //           siteFolder: path.resolve(context, 'semantic-ui-theme/site'),
    //           themeConfigPath: path.resolve(context, 'semantic-ui-theme/theme.config'),
    //         },
    //       },
    //     ],
    //   },
    //   {
    //     // Load .png files from semantic-ui-less folder
    //     test: /\.png$/i,
    //     include: /[/\\]node_modules[/\\]semantic-ui-less[/\\]/,
    //     loader: 'file-loader',
    //     // Use publicPath ../, because this will be used in css files, and to reference an image from the images
    //     // folder in a css file in the styles folder the relative path is ../images/image-file.ext
    //     options: { name: 'images/[name].[hash].[ext]', publicPath: '../' },
    //   },
    //
    //   // Loader configuration for font files
    //   {
    //     test: /\.(woff2?|[ot]tf|eot|svg)$/i,
    //     loader: 'file-loader',
    //     // Use publicPath ../, because this will be used in css files, and to reference a font from the fonts
    //     // folder in a css file in the styles folder the relative path is ../fonts/font-file.ext
    //     options: { name: 'fonts/[name].[hash].[ext]', publicPath: '../' },
    //   }
    // )

    return webpackConfig
  },

  modifyPaths({
    webpackObject, // the imported webpack node module
    options: {
      razzleOptions, // the modified options passed to Razzle in the `options` key in `razzle.config.js` (options: { key: 'value'})
    },
    paths, // the default paths that will be used by Razzle.
  }) {
    // configure paths for our directory structure
    // paths.appSrc = path.join(paths.appPath, 'app/src')
    paths.appServerJs = path.join(paths.appPath, 'server/src/expressServer')
    paths.appServerIndexJs = path.join(paths.appPath, 'server/src/index')
    paths.appClientIndexJs = path.join(paths.appPath, 'app/src/index')

    // console.log('PATHS', paths)
    return paths
  },

  modifyJestConfig({
    jestConfig, // the created jest config
    webpackObject, // the imported webpack node module
    options: {
      pluginOptions, // the options passed to the plugin ({ name:'pluginname', options: { key: 'value'}})
      razzleOptions, // the modified options passed to Razzle in the `options` key in `razzle.config.js` (options: { key: 'value'})
    },
    paths, // the modified paths that will be used by Razzle.
  }) {
    const testTarget = process.env.TEST_TARGET === 'server' ? 'server' : 'app'
    jestConfig.moduleNameMapper = {
      '^AppSrc/(.*)$': ['<rootDir>/app/src/$1'],
      '^ServerSrcv/(.*)$': ['<rootDir>/server/src/$1'],
      '^Config/(.*)$': ['<rootDir>/config/$1'],
    }

    if (testTarget === 'app') jestConfig.setupFilesAfterEnv = ['<rootDir>/app/src/setupTests.js']
    if (testTarget === 'server') {
      jestConfig.moduleFileExtensions.push('mjs')
      process.env.NODE_OPTIONS = '--experimental-vm-modules'
    }

    jestConfig.testEnvironment = testTarget === 'app' ? 'jsdom' : 'node'
    jestConfig.testMatch = undefined
    jestConfig.testRegex =
      testTarget === 'app'
        ? [`${testTarget}/.*/__tests__/[^/]+.m?[jt]sx?`]
        : [`${testTarget}/.*/[^/]+.test.m?[jt]sx?`]

    return jestConfig
  },
}
