import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { parse } from 'acorn'
import { createMicronTechnologyIndiaScraper, OFFICIAL_CAREERS_URL, buildListingApiUrl } from '../../scraper/microntechnologyindia/script.js'

const tree = parse(readFileSync(new URL('./micronTechnologyIndiaScript.test.js', import.meta.url), 'utf8'), { sourceType: 'module', ecmaVersion: 'latest' })
const declaration = tree.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations).find(node => node.id.name === 'OFFICIAL_CAREERS_HTML').init
assert.equal(declaration.type, 'TemplateLiteral')
assert.equal(declaration.expressions.length, 0)
const official = declaration.quasis[0].value.cooked
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const waitFor = async (promise, label) => {
  let timer
  try {
    return await Promise.race([promise, new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Controlled boundary not reached: ' + label)), 1000)
    })])
  } finally {
    clearTimeout(timer)
  }
}
const drain = async () => { await nextTurn(); await nextTurn() }

for (const duringListing of [true, false]) test('Micron caller abort settles independently of pending cleanup ' + (duringListing ? 'during a noncooperative listing read' : 'after cleanup has already begun'), { timeout: 3000 }, async () => {
  const controller = new AbortController()
  const reason = duringListing
    ? Object.freeze(new Error('Controlled caller abort during listing'))
    : Object.freeze({ kind: 'controlled-caller-abort-during-cleanup', get message() { throw new Error('The caller reason must remain opaque') } })
  const listingStarted = deferred(), pendingListing = deferred(), closeStarted = deferred(), pendingClose = deferred()
  let closeCalls = 0, factoryCalls = 0, reads = 0, state = { kind: 'pending' }
  // This empty envelope is synthetic cleanup control data, not a native empty-inventory observation.
  const syntheticEmpty = JSON.stringify({ status: 200, error: { message: '', body: '' }, data: { positions: [], count: 0 } })
  const scraper = createMicronTechnologyIndiaScraper({
    createBrowserFetchSessionImpl: async options => {
      factoryCalls++
      assert.equal(options.signal, controller.signal)
      return {
        fetchText: async url => {
          reads++
          assert.equal(url, buildListingApiUrl())
          listingStarted.resolve()
          return duringListing ? pendingListing.promise : syntheticEmpty
        },
        close: () => {
          closeCalls++
          closeStarted.resolve()
          return pendingClose.promise
        },
      }
    },
  })
  const observed = scraper.run({
    signal: controller.signal,
    fetchText: async url => { assert.equal(url, OFFICIAL_CAREERS_URL); return official },
  }).then(() => { state = { kind: 'resolved' } }, error => { state = { kind: 'rejected', error } })
  try {
    await waitFor(listingStarted.promise, 'listing')
    if (!duringListing) await waitFor(closeStarted.promise, 'cleanup')
    controller.abort(reason)
    await waitFor(closeStarted.promise, 'cleanup after caller abort')
    await drain()
    assert.equal(state.kind, 'rejected', 'Pending cleanup must not keep the aborted source run pending')
    assert.strictEqual(state.error, reason)
    assert.equal(factoryCalls, 1)
    assert.equal(closeCalls, 1)
    assert.equal(reads, 1)
  } finally {
    controller.abort(reason)
    pendingListing.resolve(syntheticEmpty)
    if (duringListing) pendingClose.resolve()
    else pendingClose.reject(new Error('Controlled late cleanup rejection must be observed'))
    await waitFor(observed, 'owned source operation settlement')
    await drain()
  }
  assert.equal(closeCalls, 1, 'Cleanup is attempted exactly once')
})
