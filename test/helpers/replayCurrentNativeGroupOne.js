import assert from 'node:assert/strict'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const expectedRegistrationParser = Object.freeze({
  '2070health': 'live-parser',
  aible: 'live-parser',
  astrasecurity: 'live-parser',
})
export const supportedSources = new Set(Object.keys(expectedRegistrationParser))

const primaryURLs = Object.freeze({
  '2070health': 'https://2070health.com/careers/',
  aible: 'https://www.aible.com/careers',
  astrasecurity: 'https://www.getastra.com/team-and-culture',
})

function assertProvider(provider) {
  assert.ok(supportedSources.has(provider?.source), 'Unsupported current native source')
  assert.equal(provider.parser, expectedRegistrationParser[provider.source])
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
}

// Keep the 28.9 MB inflated Astra packet set out of unrelated batch cases.
async function fixtureFor(source) {
  switch (source) {
    case '2070health': return import('../test-data/health2070Native20261108.js')
    case 'aible': return import('../test-data/aibleNative20261108.js')
    case 'astrasecurity': return import('../test-data/astraSecurityNative20261108.js')
    default: assert.fail('Unsupported current native source: ' + source)
  }
}

function assertHeldEvidence(evidence, source, count) {
  assert.equal(evidence.source, source)
  assert.equal(evidence.recordKind, 'vacancy-rows')
  assert.equal(evidence.observedRecordCount, count)
  assert.equal(evidence.observedVacancyCount, count)
  assert.equal(evidence.observations.length, count)
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.companyGlobalTotal, null)
  assert.equal(evidence.companyIndiaTotal, null)
  assert.equal(evidence.activeHiringVerified, false)
  assert.equal(evidence.applicationActions, 0)
  assert.equal(evidence.publisherProgramsExecuted, false)
  for (const row of evidence.observations) {
    assert.equal(row.source, source)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
    assert.equal(row.activeApplyVerified, false)
    assert.equal(row.applicationVisited, false)
  }
}

function assertOriginalReplay(replay, evidence, packets) {
  assert.deepEqual(replay.uncaptured, [])
  assert.deepEqual(replay.requests, packets.map(packet => ({
    url: packet.requestedURL, method: 'GET', redirect: 'manual', credentials: 'omit',
  })))
  assert.equal(evidence.requestCount, packets.length)
  assert.equal(evidence.rawResponses.length, packets.length)
  for (const [index, retained] of evidence.rawResponses.entries()) {
    const packet = packets[index], response = retained.response
    assert.equal(retained.requestedURL, packet.requestedURL)
    assert.equal(response.url, packet.url)
    assert.equal(response.status, packet.status)
    assert.equal(response.rawBodyBase64, packet.bodyBase64)
    assert.equal(response.bodyBytes, packet.bodyBytes)
    assert.equal(response.bodyComplete, true)
    assert.equal(response.identityValidated, true)
    assert.equal(response.acquisitionValidated, true)
  }
}

function assertIncompleteInventory(jobs, source, count, requests) {
  const inventory = readInventoryEvidence(jobs)
  assert.ok(inventory)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.firstParty, true)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.pagesFetched, requests)
  assert.deepEqual(readSourceObservationEvidence(jobs, source), {
    source, recordKind: 'vacancy-rows', observedRecordCount: count,
    observedVacancyCount: count, sourceScopeComplete: false,
    companyGlobalTotal: null, companyIndiaTotal: null,
  })
}

export async function assertCurrentNativeExtraction(t, provider) {
  assertProvider(provider)
  const {fixture, replay} = await fixtureFor(provider.source)
  const captured = replay()
  let observedRows
  const pending = createCatalogScraper(provider).run({
    ...captured.options, countryFilter: 'India', onRecords: rows => { observedRows = rows },
  })

  if (provider.source === '2070health') {
    let failure
    await assert.rejects(pending, error => {
      failure = error
      assert.equal(error.code, 'HEALTH2070_NATIVE_CRITERIA_MISSING')
      assert.equal(error.failureKind, 'coverage_gap')
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, false)
      assert.equal(error.abortRetries, true)
      assert.equal(error.sourceScopeComplete, false)
      assert.equal(error.lifecycleCleanupAllowed, false)
      return true
    })
    const evidence = failure.nativeEvidence
    assertHeldEvidence(evidence, provider.source, 32)
    assert.deepEqual(evidence.primary, fixture.expected.primary)
    assert.equal(evidence.primary.records.length, 32)
    assert.deepEqual(evidence.detailRecords, [fixture.expected.firstDetail])
    assert.equal(evidence.detailRecords[0].criteriaAvailable, false)
    assert.equal(evidence.detailRecords[0].fullCriteriaText, '')
    assert.equal(evidence.closingPrimary, null)
    assert.deepEqual(evidence.closingDetailRecords, [])
    assert.deepEqual(observedRows, evidence.observations)
    for (const [index, row] of evidence.observations.entries()) {
      assert.deepEqual(row.sourceNativeListingRecord, fixture.expected.primary.records[index])
      assert.deepEqual(row.sourceNativeRecord, index === 0 ? fixture.expected.firstDetail : null)
      assert.equal(row.country, 'India')
      assert.equal(row.company, null)
      assert.equal(row.jobId, null)
      assert.equal(row.requisitionId, null)
      assert.equal(row.postingDate, null)
      assert.equal(row.closingDate, null)
      assert.equal(row.jobDescription, null)
      assert.equal(row.sourceNativeCriteriaComplete, false)
      assert.equal(row.sourceNativeCurrentPublicationQualified, false)
      assert.equal(row.sourceCurrentNativeRoleQualified, false)
    }
    assertOriginalReplay(captured, evidence, fixture.packets)
    t.diagnostic('2070health: expected incomplete rejection; 32 listing models, one empty own model, three recorded responses')
    return
  }

  const jobs = await pending, evidence = jobs.nativeCollectionEvidence
  if (provider.source === 'aible') {
    assert.equal(jobs.length, 0)
    assertHeldEvidence(evidence, provider.source, 3)
    assert.deepEqual(evidence.primary, fixture.expected.opening)
    assert.deepEqual(evidence.closingPrimary, fixture.expected.closing)
    assert.deepEqual(evidence.primary.records.map(row => row.title), [
      'Business Development Manager', 'Back-end Developer', 'Aible Enterprise Solution Engineer',
    ])
    assert.equal(evidence.primary.records.reduce((count, row) => count + row.sections.length, 0), 15)
    assert.deepEqual(observedRows, evidence.observations)
    for (const [index, row] of evidence.observations.entries()) {
      const original = fixture.expected.opening.records[index]
      assert.deepEqual(row.sourceNativeRecord, original)
      assert.deepEqual(row.sourceNativeClosingRecord, fixture.expected.closing.records[index])
      assert.equal(row.jobDescription, original.fullCriteriaText)
      assert.equal(row.sourceNativeOwnDescriptionHTML, original.nativeDescriptionHTML)
      assert.ok(row.jobDescription.length > 0)
      for (const field of ['company', 'location', 'country', 'jobId', 'requisitionId', 'postingDate', 'closingDate']) {
        assert.equal(row[field], null, field)
      }
      assert.equal(row.sourceNativeCriteriaComplete, true)
      assert.equal(row.sourceCountryScopeUnresolved, true)
      assert.equal(row.sourceNativeCriteriaVisibilityQualified, false)
      assert.equal(row.sourceNativeCurrentPublicationQualified, false)
      assert.equal(row.sourceCurrentNativeRoleQualified, false)
    }
    // The replay helper intentionally uses only the two saved primary packets.
    assertOriginalReplay(captured, evidence, [fixture.packets[0], fixture.packets[3]])
    assertIncompleteInventory(jobs, provider.source, 3, 2)
    t.diagnostic('aible: three complete authored models in 15 sections; zero country-qualified rows; two recorded primary replays')
    return
  }

  assert.equal(provider.source, 'astrasecurity')
  assert.equal(jobs.length, 6)
  assertHeldEvidence(evidence, provider.source, 8)
  assert.deepEqual(evidence.board, fixture.expected.openingBoard)
  assert.deepEqual(evidence.closingBoard, fixture.expected.closingBoard)
  assert.deepEqual(evidence.details, fixture.expected.details)
  assert.deepEqual(evidence.detailRoutes, fixture.expected.detailRoutes)
  assert.equal(evidence.client.helperAuthorityValidated, true)
  assert.deepEqual(observedRows, evidence.observations)
  assert.deepEqual(jobs.map(row => row.jobId), [
    '91259000000306014', '91259000009034275', '91259000011211164',
    '91259000001908093', '91259000003137005', '91259000009034364',
  ])
  for (const [index, row] of evidence.observations.entries()) {
    const detail = fixture.expected.details[index], original = detail.records[0]
    assert.deepEqual(row.sourceNativeListingRecord, fixture.expected.openingBoard.records[index])
    assert.deepEqual(row.sourceNativeRecord, original.nativeRecord)
    assert.deepEqual(row.sourceNativeDetail, detail)
    assert.equal(row.sourceUrl, fixture.expected.detailRoutes[index])
    assert.equal(row.jobDescription, original.fullCriteriaText)
    assert.equal(row.sourceNativeOwnDescriptionHTML, original.nativeDescriptionHTML)
    assert.ok(row.jobDescription.length > 0)
    assert.equal(row.jobId, original.nativeRecord.id)
    assert.equal(row.company, 'Astra Security')
    assert.equal(row.requisitionId, null)
    assert.equal(row.postingDate, null)
    assert.equal(row.closingDate, null)
    assert.equal(row.dateOpened, original.nativeRecord.Date_Opened)
  }
  assert.equal(evidence.observations[0].country, null)
  assert.equal(evidence.observations[0].sourceNativeDetail.nativeData.country, 'IN')
  assert.equal(evidence.observations[0].sourceCountryScopeUnresolved, true)
  assert.equal(evidence.observations[0].sourceCurrentNativeRoleQualified, false)
  assert.equal(evidence.observations[7].sourceNativeRecord.Publish, false)
  assert.equal(evidence.observations[7].sourceNativeRecord.Is_Locked, true)
  assert.equal(evidence.observations[7].sourceCurrentNativeRoleQualified, false)
  for (const row of jobs) {
    assert.equal(row.country, 'India')
    assert.equal(row.sourceNativeRecord.Publish, true)
    assert.equal(row.sourceNativeRecord.Is_Locked, false)
    assert.equal(row.jobDescription, row.sourceNativeDetail.records[0].fullCriteriaText)
    assert.equal(row.sourceCurrentNativeRoleQualified, true)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
  }
  assertOriginalReplay(captured, evidence, fixture.packets)
  assertIncompleteInventory(jobs, provider.source, 8, 13)
  t.diagnostic('astrasecurity: six selected India rows; all eight native board/detail models and 13 recorded responses retained')
}

export async function assertCurrentNativeDenial(t, provider) {
  assertProvider(provider)
  const primary = primaryURLs[provider.source]
  const original = Buffer.from('<html><body>Controlled primary denial</body></html>')
  const attempted = []
  let pageCalls = 0, apiCalls = 0, failure
  await assert.rejects(createCatalogScraper(provider).run({
    rateLimitMs: 0,
    now: () => '2026-11-08T00:00:00.000Z',
    fetchImpl: async (url, init) => {
      attempted.push(String(url))
      assert.equal(String(url), primary)
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.body, undefined)
      const response = new Response(original, {
        status: 403,
        headers: {'content-type': 'text/html; charset=utf-8', 'content-length': String(original.length)},
      })
      Object.defineProperty(response, 'url', {value: primary})
      return response
    },
    fetchPage: async () => { pageCalls++; assert.fail('Native denial requires the injected streaming response') },
    fetchJson: async () => { apiCalls++; assert.fail('Primary denial cannot authorize an API request') },
  }), error => {
    failure = error
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.softFailure, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.status, 403)
    assert.equal(error.abortRetries, true)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    return true
  })
  assert.deepEqual(attempted, [primary])
  assert.equal(pageCalls, 0)
  assert.equal(apiCalls, 0)
  const evidence = failure.nativeEvidence
  assertHeldEvidence(evidence, provider.source, 0)
  assert.equal(evidence.primary, null)
  assert.equal(evidence.closingPrimary, null)
  assert.equal(evidence.requestCount, 1)
  assert.equal(evidence.rawResponses.length, 1)
  const retained = evidence.rawResponses[0]
  assert.equal(retained.requestedURL, primary)
  assert.equal(retained.response.url, primary)
  assert.equal(retained.response.status, 403)
  assert.equal(retained.response.rawBodyBase64, original.toString('base64'))
  assert.equal(retained.response.bodyBytes, original.length)
  assert.equal(retained.response.bodyComplete, true)
  assert.equal(retained.response.identityValidated, true)
  assert.equal(retained.response.acquisitionValidated, true)
  t.diagnostic(provider.source + ': synthetic HTTP403 retained after one attempted read; no later API request or inventory/cleanup authority')
}
