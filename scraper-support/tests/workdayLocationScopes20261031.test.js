import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { getScraperCatalog } from '../providers/index.js'
import { runWorkdayScraper } from '../myworkday/engine.js'
import { explicitWorkdayCountryScope } from '../myworkday/countryInventoryProof.js'

const fixtures = Object.fromEntries(['temenos', 'adventhealth'].map(source => {
  const data = JSON.parse(gunzipSync(fs.readFileSync(new URL(
    '../../scraper/' + source + '.workday/nativeEvidence/location-scope-current-20261031.json.gz', import.meta.url))))
  for (const row of data.requests) assert.equal(createHash('sha256').update(row.body).digest('hex'), row.sha256)
  return [source, data]
}))
const messages = error => [error?.message, error?.cause?.message].filter(Boolean).join(' | ')

const replay = async (t, source, { qualify = false, closingDrift = false, contradictoryCountry = false, omitCountries = false } = {}) => {
  const fixture = fixtures[source], queues = new Map(), reads = [], postCounts = new Map()
  for (const row of fixture.requests) {
    const key = JSON.stringify([row.method, row.url, row.requestBody])
    if (!queues.has(key)) queues.set(key, [])
    queues.get(key).push(row)
  }
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET', key = JSON.stringify([method, url, init.body || null])
    const queue = queues.get(key)
    assert.ok(queue?.length, 'Uncaptured network requests are forbidden: ' + key)
    const row = queue.length > 1 ? queue.shift() : queue[0]
    reads.push({ url, method, body: init.body || null })
    let body = row.body
    if (url.includes('/wday/cxs/') && url.includes('/job/')) {
      const payload = JSON.parse(body), info = payload.jobPostingInfo
      // Explicit hypothetical controls: these countries are NOT present on
      // the current additional locations and are never counted as live proof.
      if (qualify && Array.isArray(info.additionalLocations)) info.additionalLocations = info.additionalLocations.map(label => (
        explicitWorkdayCountryScope(label) ? label : label + ', United States of America'
      ))
      if (contradictoryCountry && info.additionalLocations?.length) info.country = {
        descriptor: 'United States of America', id: 'c4f78be1a8f14da0ab49ce1162348a5e', alpha2Code: 'US',
      }
      if (omitCountries) {
        info.location += ', United States of America'
        delete info.country
        if (info.jobRequisitionLocation) delete info.jobRequisitionLocation.country
      }
      body = JSON.stringify(payload)
    }
    if (method === 'POST' && row.status === 200) {
      const offset = JSON.parse(init.body).offset, count = (postCounts.get(offset) || 0) + 1
      postCounts.set(offset, count)
      // The real failure capture never reached closing. Only the controlled
      // positive case replays its initial listing as a stable closing response.
      if (closingDrift && count === 2 && offset === 0) {
        const payload = JSON.parse(body)
        payload.total++
        body = JSON.stringify(payload)
      }
    }
    const response = new Response(body, { status: row.status, headers: row.headers })
    Object.defineProperty(response, 'url', { value: row.finalURL })
    return response
  })
  const provider = getScraperCatalog().find(provider => provider.source === source)
  // Exercise the public engine and the actual source config with an injected
  // scheduler. Registered-source public checks are captured separately.
  const jobs = await runWorkdayScraper({ source, company: provider.companyName, baseUrl: provider.baseUrl,
    locationCountry: provider.locationCountry, boardIdentityVerified: provider.boardIdentityVerified === true,
    scraperDir: fileURLToPath(new URL('../../scraper/' + source + '.workday/', import.meta.url)),
    requestScheduler: { acquire: async () => () => {}, recordRateLimit() {}, minIntervalMs: 0 },
    nativeDetailRecovery: false, retryBaseDelayMs: 0, requestTimeoutMs: 1000 })
  return { jobs, reads }
}

test('current Temenos UK-primary receipt cannot certify an untyped Dubai secondary location', async t => {
  await assert.rejects(replay(t, 'temenos'), error => error.code === 'WORKDAY_NATIVE_LOCATIONS_UNRESOLVED'
    && /Dubai/.test(messages(error)))
})

test('hypothetical country-qualified Temenos secondaries pass the existing native closing protocol', async t => {
  const { jobs, reads } = await replay(t, 'temenos', { qualify: true })
  assert.equal(jobs.length, 0)
  const proof = jobs[Symbol.for('jobverify.workday.country-inventory-proof')]
  assert.equal(proof.initial.count, 21)
  assert.equal(proof.closing.count, 21)
  assert.equal(proof.initial.sha256, proof.closing.sha256)
  assert.equal(reads.filter(row => row.method === 'POST').length, 4)
})

test('country-qualified Temenos control still rejects changed closing inventory', async t => {
  await assert.rejects(replay(t, 'temenos', { qualify: true, closingDrift: true }), { name: 'WorkdayIncompleteListingError' })
})

test('current AdventHealth US-primary receipts cannot certify opaque secondary facilities', async t => {
  await assert.rejects(replay(t, 'adventhealth'), error => error.code === 'WORKDAY_NATIVE_LOCATIONS_UNRESOLVED'
    && /AH CENTRA CARE ST CLOUD/.test(messages(error)))
})

test('hypothetical explicit countries permit foreign classification of the AdventHealth search subset only', async t => {
  const { jobs, reads } = await replay(t, 'adventhealth', { qualify: true })
  assert.equal(jobs.length, 0)
  assert.equal(reads.filter(row => row.method === 'POST').length, 10)
  // This is a controlled geography check, not whole-company empty evidence:
  // the actual source falls back to the keyword India; the global API is capped.
})

test('qualified AdventHealth secondary controls cannot erase contradictory primary country identifiers', async t => {
  await assert.rejects(replay(t, 'adventhealth', { qualify: true, contradictoryCountry: true }), error => /country/i.test(messages(error)))
})

test('legacy omitted country fields remain optional when controlled public location labels supply explicit countries', async t => {
  const { jobs } = await replay(t, 'adventhealth', { qualify: true, omitCountries: true })
  assert.equal(jobs.length, 0)
})
