// main.js
//
// Wrapper for es6 import compatibility
//

async function main() {
  try {
    await import('./index.mjs')
  } catch (err) {
    throw new Error(err)
  }
}
main()
