// Run with:
//   node --experimental-modules --es-module-specifier-resolution=node jasmine-run.mjs

import debug from 'debug'
import glob from 'glob'
import Jasmine from 'jasmine'
import JasmineConsoleReporter from 'jasmine-console-reporter'

debug.enable('jasmine-run:*')
// const log = debug('helpers:log')
// const info = debug('jasmine-run:info')
const error = debug('jasmine-run:error')

const jasmine = new Jasmine()
jasmine.loadConfigFile('spec/support/jasmine.json')

// setup console reporter
const reporter = new JasmineConsoleReporter({
  colors: 1,
  cleanStack: 1,
  verbosity: 4,
  listStyle: 'indent',
  timeUnit: 'ms',
  timeThreshold: { ok: 500, warn: 1000, ouch: 3000 }, // Object|Number
  activity: true,
  emoji: true,
  beep: false,
})

// Load your mjs specs
glob('**/*.test.mjs', (er, files) => {
  Promise.all(
    files // Use relative paths
      // .map(f => f.replace('spec/tests/', './'))
      .map(f => `../${f}`)
      .map(f => import(f)
        .catch(e => {
          error(`** Error loading ${f}: `)
          error(e)
          process.exit(1)
        }))
  )
    .then(() => {
      jasmine.env.clearReporters()
      jasmine.addReporter(reporter)
      jasmine.execute()
    })
})
