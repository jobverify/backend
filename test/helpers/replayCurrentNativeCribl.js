import assert from 'node:assert/strict'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const expectedRegistrationParser = Object.freeze({cribl: 'live-parser'})
export const supportedSources = new Set(Object.keys(expectedRegistrationParser))

function assertProvider(provider) {
  assert.equal(provider.source, 'cribl')
  assert.equal(provider.parser, expectedRegistrationParser.cribl)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
}

function assertHeldEvidence(evidence, count) {
  assert.equal(evidence.source, 'cribl')
  assert.equal(evidence.observedRecordCount, count)
  assert.equal(evidence.observations.length, count)
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.companyGlobalTotal, null)
  assert.equal(evidence.companyIndiaTotal, null)
}

export async function assertCurrentNativeExtraction(t, provider) {
  assertProvider(provider)
  // Load the large original packet set only for this source's extraction case.
  const {fixture, replay} = await import('../test-data/cribl20261107.js')
  const captured = replay()
  let audit, records
  const jobs = await createCatalogScraper(provider).run({
    ...captured.options, onAudit: value => { audit = value }, onRecords: value => { records = value },
  })
  assert.deepEqual(captured.uncaptured, [])
  // The replay reuses 160 saved packets; 318 calls are not new acquisitions.
  assert.equal(captured.requests.length, 318)
  assert.equal(audit.rawResponses.length, 318)
  assertHeldEvidence(audit, 78)
  assert.equal(records.length, 78)
  assert.deepEqual(records.map(row => row.sourceNativeRecord), fixture.expected.nativeModels)
  assert.deepEqual(records.map(row => row.sourceNativeClosingRecord), fixture.expected.nativeModels)
  assert.deepEqual(audit.observations.map(row => row.nativeRecord), fixture.expected.nativeModels)
  assert.deepEqual(audit.observations.map(row => row.listingRecord), fixture.expected.nativeModels)
  assert.equal(audit.ownNativeModels, 78)
  assert.equal(audit.pairedNativeModels, 78)
  assert.equal(audit.nativeInventoryStable, true)
  assert.equal(audit.knownForeignCount, 51)
  assert.equal(audit.countryUnresolvedCount, 27)
  assert.equal(audit.observedIndiaCount, 0)
  for (const row of records) {
    assert.equal(row.source, 'cribl')
    assert.equal(row.sourceNativeContent, row.sourceNativeRecord.content)
    assert.ok(row.sourceDescription.length > 1000)
    assert.equal(row.sourceUrl, 'https://cribl.io/job-detail/' + row.jobId + '/')
    assert.equal(row.applyUrl, null)
    assert.equal(row.activeApplyVerified, false)
    assert.equal(row.applicationVisited, false)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
  }
  assert.equal(jobs.length, 27)
  assert.deepEqual(jobs.map(row => row.jobId), fixture.expected.unknownCountryIds)
  for (const row of jobs) {
    assert.equal(row.country, null)
    assert.equal(row.countryUnresolved, true)
    assert.equal(row.sourceCurrentNativeRoleQualified, false)
  }
  const observed = readSourceObservationEvidence(jobs, 'cribl')
  assert.equal(observed.observedRecordCount, 78)
  assert.equal(observed.sourceScopeComplete, false)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  t.diagnostic('cribl: 78 complete native models; 51 known foreign and 27 unresolved-country rows; recorded replay does not qualify current public inventory')
}

export async function assertCurrentNativeDenial(t, provider) {
  assertProvider(provider)
  const primary = 'https://cribl.io/careers/'
  const original = Buffer.from('<html><body>Controlled primary denial</body></html>')
  const attempted = []
  let failure, callbacks = 0
  await assert.rejects(createCatalogScraper(provider).run({
    rateLimitMs: 0, now: () => '2026-11-08T00:00:00.000Z',
    onAudit: () => { callbacks++ }, onRecords: () => { callbacks++ },
    fetchImpl: async (url, init) => {
      attempted.push(String(url))
      assert.equal(String(url), primary)
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.body, undefined)
      const headers = new Headers(init.headers)
      assert.equal(headers.has('authorization'), false)
      assert.equal(headers.has('cookie'), false)
      const response = new Response(original, {status: 403, headers: {'content-type': 'text/html; charset=utf-8'}})
      Object.defineProperty(response, 'url', {value: primary})
      return response
    },
    fetchPage: async () => assert.fail('Primary denial cannot authorize a fallback page read'),
    fetchJson: async () => assert.fail('Primary denial cannot authorize an API read'),
  }), error => {
    failure = error
    assert.equal(error.status, 403)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.softFailure, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.abortRetries, true)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    return true
  })
  assert.deepEqual(attempted, [primary])
  assert.equal(callbacks, 0)
  const evidence = failure.nativeEvidence
  assertHeldEvidence(evidence, 0)
  assert.equal(evidence.opening, null)
  assert.equal(evidence.closing, null)
  assert.equal(evidence.rawResponses.length, 1)
  const retained = evidence.rawResponses[0]
  assert.equal(retained.requestedURL, primary)
  assert.equal(retained.response.url, primary)
  assert.equal(retained.response.status, 403)
  assert.equal(retained.response.rawBodyBase64, original.toString('base64'))
  assert.equal(retained.response.bodyBytes, original.length)
  assert.equal(retained.response.bodyComplete, true)
  t.diagnostic('cribl: synthetic primary HTTP403 retained after exactly one read; no later inventory or callback')
}
