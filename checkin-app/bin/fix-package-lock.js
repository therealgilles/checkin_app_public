#!/usr/bin/env node

/* eslint-disable import/unambiguous */
/* eslint-disable import/no-commonjs */

const fs = require('fs')
const path = require('path')

const main = async resolutions => {
  if (!resolutions) return

  // console.log('Resolutions', resolutions)
  const packageLockFilePath = path.resolve(__dirname, '../package-lock.json')
  const packageLock = JSON.parse(fs.readFileSync(packageLockFilePath))
  if (!packageLock) {
    // eslint-disable-next-line no-console
    console.error(`ERROR: Cannot read ${packageLockFilePath}.`)
  }

  const packages = packageLock.packages || packageLock.dependencies
  if (!packages) {
    // eslint-disable-next-line no-console
    console.error('ERROR: Packages not found in', packageLock)
    return
  }

  const packagePaths = Object.keys(packages)
  const deletePaths = []

  for (const packagePath of packagePaths) {
    for (const [name, version] of Object.entries(resolutions)) {
      if (packagePath.endsWith(`/${name}`)) {
        // console.log('Package path', packagePath, 'version', packageLock.packages[packagePath].version)
        if (packages[packagePath].version !== version) {
          // console.log('Deleting', packagePath)
          deletePaths.push(packagePath)
        }
      }
    }
  }

  for (const packagePath of deletePaths) {
    for (const deletePath of deletePaths) {
      if (packagePath === deletePath || packagePath.startsWith(`${deletePath}/`)) {
        delete packages[packagePath]
      }
    }
  }

  fs.writeFileSync(packageLockFilePath, JSON.stringify(packageLock, null, '  '))
}

main(require('../package.json').resolutions)
