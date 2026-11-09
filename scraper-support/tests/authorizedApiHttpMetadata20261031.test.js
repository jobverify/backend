import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers } from '../providers/index.js'
import { traceRetryPressure, getRetryPressure } from '../utils/retryPressure.js'

const scraper = () => buildScrapers().find(item => item.name === 'atkinsrealis')
const response = (status, payload = {}, retryAfter = null) => ({ ok: status >= 200 && status < 300, status,
  headers: { get: name => name === 'retry-after' ? retryAfter : null }, json: async () => payload })
const empty = { jobs: [], meta: { totalCount: 0 } }

for (const stage of ['token', 'listing']) for (const status of [403,429,503]) {
  test(`authorized API ${stage} HTTP${status} retains actual status, retry policy and delay metadata once`, async t => {
    let reads = 0
    t.mock.method(globalThis, 'fetch', async url => {
      reads += 1
      if (String(url).endsWith('/token')) return stage === 'token'
        ? response(status, {}, status === 429 ? '13' : null) : response(200, { token: 'controlled-public-token' })
      return response(status, {}, status === 429 ? '13' : null)
    })
    const operation = traceRetryPressure(() => scraper().run())
    await assert.rejects(operation, error => error.status === status
      && (status === 403 ? error.abortRetries === true : error.abortRetries !== true)
      && (status !== 429 || error.retryDelayMs === 13000))
    const expectedFailures = stage === 'listing' && status === 403 ? 2 : 1
    assert.equal(getRetryPressure(operation).httpStatusCounts[String(status)], expectedFailures)
    assert.equal(reads, stage === 'token' ? 1 : status === 403 ? 4 : 2)
  })
}

for (const status of [401,403]) test(`authorized API recovered HTTP${status} remains visible after its one permitted token refresh`, async t => {
  let tokens = 0, listings = 0
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).endsWith('/token')) { tokens += 1;return response(200, { token: 'controlled-public-token' }) }
    listings += 1
    return listings === 1 ? response(status) : response(200, empty)
  })
  const operation = traceRetryPressure(() => scraper().run())
  assert.deepEqual(await operation, [])
  assert.equal(tokens, 2)
  assert.equal(listings, 2)
  assert.equal(getRetryPressure(operation).httpStatusCounts[String(status)], 1)
})

test('authorized API failed token refresh retains both actual HTTP failures without a listing restart', async t => {
  let tokens = 0, listings = 0
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).endsWith('/token')) { tokens += 1;return tokens === 1 ? response(200, { token: 'controlled-public-token' }) : response(403) }
    listings += 1;return response(403)
  })
  const operation = traceRetryPressure(() => scraper().run())
  await assert.rejects(operation, error => error.status === 403 && error.abortRetries === true)
  assert.equal(getRetryPressure(operation).httpStatusCounts['403'], 2)
  assert.equal(tokens, 2)
  assert.equal(listings, 1)
})
