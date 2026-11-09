import assert from 'node:assert/strict'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const expectedRegistrationParser = Object.freeze({axa: 'live-parser'})
export const supportedSources = new Set(Object.keys(expectedRegistrationParser))

const primary = 'https://careers.axa.com/careers-home/'
const criteriaFields = ['description', 'responsibilities', 'qualifications', 'preferred_qualifications', 'benefits']

function assertProvider(provider) {
  assert.equal(provider.source, 'axa')
  assert.equal(provider.companyName, 'AXA')
  assert.equal(provider.parser, expectedRegistrationParser.axa)
  assert.equal(provider.companyCareerPage, primary)
  assert.match(provider.modulePath, /[\\/]scraper[\\/]axa\.workday[\\/]script\.js$/)
  assert.equal(provider.catalogOverride, true)
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.atsPlatform, 'first-party-and-jibe-public-native-json')
  for (const key of ['runtimeValidation', 'backfillMode', 'verifiedIndiaJobCount', 'verifiedPublicJobCount']) assert.equal(provider[key], null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
}

function assertHeldEvidence(evidence, count) {
  assert.equal(evidence.source, 'axa')
  assert.equal(evidence.recordKind, 'vacancy-rows')
  assert.equal(evidence.observedRecordCount, count)
  assert.equal(evidence.observedVacancyCount, count)
  assert.equal(evidence.observations.length, count)
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.companyGlobalTotal, null)
  assert.equal(evidence.companyIndiaTotal, null)
  assert.equal(evidence.renderedCriteriaVisibilityQualified, false)
  assert.equal(evidence.activeHiringVerified, false)
  assert.equal(evidence.applicationActions, 0)
  assert.equal(evidence.publisherProgramsExecuted, false)
}

function assertOriginals(evidence, packets) {
  assert.equal(evidence.requestCount, packets.length)
  assert.equal(evidence.rawResponses.length, packets.length)
  for (const [index, original] of packets.entries()) {
    const retained = evidence.rawResponses[index], response = retained.response
    assert.equal(retained.requestedURL, original.requestedURL)
    assert.equal(retained.phase, original.label)
    assert.equal(response.url, original.url)
    assert.equal(typeof response.status, 'number')
    assert.equal(response.status, original.status)
    assert.equal(response.redirected, false)
    assert.equal(response.identityValidated, true)
    assert.equal(response.acquisitionValidated, true)
    assert.equal(response.streamEOFObserved, true)
    assert.equal(response.bodyComplete, true)
    assert.equal(response.bodyBytes, original.bodyBytes)
    assert.equal(response.receivedBodyBytes, original.bodyBytes)
    assert.equal(response.rawBodyBase64, original.bodyBase64)
    assert.equal(response.body, Buffer.from(original.bodyBase64, 'base64').toString('utf8'))
    assert.deepEqual(response.headers, Object.fromEntries(new Headers(original.headers).entries()))
  }
}

function assertRows(records, expected) {
  const listings = ['native-india-page-1', 'native-india-page-2'].flatMap(label => expected.models[label].nativeValue.jobs)
  assert.equal(records.length, expected.fullNativeRows)
  assert.equal(records.reduce((sum, row) => sum + row.sourceNativeOwnDescriptionHTML.length, 0), expected.fullAuthoredHTMLCharacters)
  for (const [index, row] of records.entries()) {
    const listing = listings[index], detail = expected.models['native-detail-' + index], own = detail.nativeValue, qualification = expected.qualification[index]
    assert.deepEqual(row.sourceNativeListingRecord, listing)
    assert.deepEqual(row.sourceNativeRecord, listing)
    assert.deepEqual(row.sourceNativeDetail, detail)
    assert.equal(row.source, 'axa')
    assert.equal(row.publisher, 'AXA')
    assert.equal(row.company, 'AXA')
    assert.equal(listing.data.hiring_organization, 'AXA')
    assert.equal(own.hiring_organization, 'AXA')
    assert.equal(row.jobId, listing.data.req_id)
    assert.equal(row.requisitionId, own.req_id)
    assert.equal(row.title, own.title)
    assert.equal(row.city, own.city)
    assert.equal(row.postingDate, own.posted_date)
    assert.equal(row.closingDate, own.posting_expiry_date ?? null)
    assert.equal(row.sourceUrl, listing.data.meta_data.canonical_url)
    assert.equal(row.sourceNativeOwnDescriptionHTML, own.description)
    assert.notEqual(row.sourceNativeOwnDescriptionHTML, listing.data.description)
    assert.equal(row.sourceDescription, qualification.fullCriteriaHTML)
    assert.deepEqual(row.sourceNativeAuthoredCriteria, criteriaFields.map(field => ({field, present: Object.hasOwn(own, field), nativeValue: own[field] ?? null})))
    assert.equal(row.sourceNativeIdentityBound, qualification.identityBound)
    assert.equal(row.sourceNativeCriteriaComplete, qualification.criteriaComplete)
    assert.equal(row.sourceDetailComplete, qualification.criteriaComplete)
    assert.equal(row.sourceNativeCurrentPublicationQualified, qualification.publicationQualified)
    assert.equal(row.sourceCurrentNativeRoleQualified, qualification.qualified)
    assert.equal(row.sourceNativeIndiaLocationQualified, qualification.qualified && qualification.indiaLocation)
    assert.equal(row.sourceCountryScopeUnresolved, !qualification.countryBound)
    assert.equal(row.country, qualification.countryBound ? qualification.nativeLocations[0].country : null)
    assert.deepEqual(row.sourceNativeLocations.map(({country, nativeClaims, city}) => ({country, nativeClaims, city})), qualification.nativeLocations)
    assert.deepEqual(row.sourceNativeCountryEvidence.listing.map(value => value.nativeValue), [listing.data, ...(listing.data.additional_locations ?? [])])
    assert.deepEqual(row.sourceNativeCountryEvidence.detail.map(value => value.nativeValue), [own, ...(own.additional_locations ?? [])])
    assert.equal(row.sourceNativeCriteriaVisibilityQualified, false)
    assert.equal(row.activeApplyVerified, false)
    assert.equal(row.applicationVisited, false)
    assert.equal(row.applyUrl, null)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
  }
  const unresolved = records.filter(row => row.sourceCountryScopeUnresolved)
  assert.equal(unresolved.length, expected.unknownCountryRows)
  for (const row of unresolved) {
    assert.equal(row.country, null)
    assert.equal(row.sourceNativeCountryClaimConflict, true)
    assert.equal(row.sourceCurrentNativeRoleQualified, false)
    assert.equal(row.sourceNativeDetail.nativeValue.country, 'India')
    assert.equal(row.sourceNativeDetail.nativeValue.country_code, 'RS')
  }
}

function assertIncompleteInventory(jobs) {
  assert.deepEqual(readSourceObservationEvidence(jobs, 'axa'), {
    source: 'axa', recordKind: 'vacancy-rows', observedRecordCount: 15, observedVacancyCount: 15,
    sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
  })
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.pagesFetched, 26)
}

export async function assertCurrentNativeExtraction(t, provider) {
  assertProvider(provider)
  // Import only for AXA extraction. Saved closing packets exercise recorded
  // stability; replaying them does not create independent closing acquisitions.
  const {fixture, replay} = await import('../test-data/axaNative20261108.js')
  const expected = fixture.expected
  assert.equal(expected.fullNativeRows, 15)
  assert.equal(expected.unknownCountryRows, 11)
  assert.equal(expected.fullAuthoredHTMLCharacters, 346678)
  for (const maxJobs of [null, 0, 1]) {
    const captured = replay(), callbacks = []
    let audit, records
    const jobs = await createCatalogScraper(provider).run({
      ...captured.options, maxJobs,
      fetchPage: async () => assert.fail('AXA native replay requires original streaming packets'),
      fetchJson: async () => assert.fail('AXA native replay cannot authorize a separate API transport'),
      onAudit: value => { callbacks.push('audit'); audit = value },
      onRecords: value => { callbacks.push('records'); records = value },
    })
    assert.deepEqual(callbacks, ['audit', 'records'])
    assert.deepEqual(captured.uncaptured, [])
    assert.deepEqual(captured.requests.map(value => value.url), fixture.packets.map(value => value.requestedURL))
    assert.ok(captured.requests.every(value => value.method === 'GET' && value.redirect === 'manual' && value.credentials === 'omit'))
    assertOriginals(audit, fixture.packets)
    assertHeldEvidence(audit, 15)
    assert.deepEqual(audit.models, expected.models)
    assert.deepEqual(audit.observations, records)
    assert.deepEqual(jobs.nativeCollectionEvidence, audit)
    assert.equal(audit.candidateQueryCountry, 'India')
    assert.equal(audit.candidateQueryReportedTotal, 15)
    assert.equal(audit.candidatePagesComplete, true)
    assert.equal(audit.closingVerified, true)
    assertRows(records, expected)
    assert.deepEqual(jobs.map(row => row.jobId), maxJobs === null ? expected.indiaJobIDs : expected.indiaJobIDs.slice(0, maxJobs))
    for (const job of jobs) {
      const record = records.find(row => row.jobId === job.jobId), location = record.sourceNativeLocations.find(value => value.country === 'India')
      assert.deepEqual(job, {...record, country: 'India', city: location.city, state: location.state, location: [location.city, location.state, 'India'].filter(Boolean).join(', '), companyCareerPage: provider.companyCareerPage, companyDomain: provider.companyDomain, atsPlatform: provider.atsPlatform})
    }
    const additional = records.find(row => row.jobId === '24090')
    assert.equal(additional.country, 'Poland')
    assert.deepEqual(additional.sourceNativeLocations.map(value => value.country), ['Poland', 'India'])
    assertIncompleteInventory(jobs)
  }

  // Full candidate enumeration still cannot grant detail qualification when
  // the supported request budget ends before the first detail.
  const partial = replay()
  let partialRecords, partialAudit
  await assert.rejects(createCatalogScraper(provider).run({
    ...partial.options, maxRequests: 6,
    onAudit: value => { partialAudit = value }, onRecords: value => { partialRecords = value },
  }), error => {
    assert.equal(error.code, 'AXA_REQUEST_BUDGET')
    assert.equal(error.failureKind, 'incomplete_listing')
    assert.equal(error.abortRetries, true)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.deepEqual(error.nativeEvidence, partialAudit)
    return true
  })
  assert.deepEqual(partial.uncaptured, [])
  assert.equal(partial.requests.length, 6)
  assertOriginals(partialAudit, fixture.packets.slice(0, 6))
  assert.deepEqual(partialAudit.models, Object.fromEntries(Object.entries(expected.models).slice(0, 6)))
  assertHeldEvidence(partialAudit, 15)
  assert.equal(partialAudit.candidatePagesComplete, true)
  assert.equal(partialAudit.candidateQueryReportedTotal, 15)
  assert.equal(partialAudit.closingVerified, false)
  assert.deepEqual(partialRecords.map(row => row.sourceNativeListingRecord), ['native-india-page-1', 'native-india-page-2'].flatMap(label => expected.models[label].nativeValue.jobs))
  for (const row of partialRecords) {
    assert.equal(row.sourceNativeDetail, null)
    assert.equal(row.sourceNativeOwnDescriptionHTML, null)
    assert.equal(row.company, null)
    assert.equal(row.sourceNativeIdentityBound, false)
    assert.equal(row.sourceNativeCriteriaComplete, false)
    assert.equal(row.sourceNativeCurrentPublicationQualified, false)
    assert.equal(row.sourceCurrentNativeRoleQualified, false)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
  }
  const invalid = replay()
  await assert.rejects(createCatalogScraper(provider).run({...invalid.options, maxPages: 4}), {code: 'AXA_INVALID_OPTIONS'})
  assert.deepEqual(invalid.requests, [])
  t.diagnostic('axa: historical 26-packet replay retains 15 full native candidates and criteria, four qualified India locations and eleven country conflicts; caps preserve evidence, pre-detail exhaustion remains incomplete; recorded closing stability grants no current freshness or company scope')
}

export async function assertCurrentNativeDenial(t, provider) {
  assertProvider(provider)
  const original = Buffer.from('<html><body>Controlled AXA primary denial</body></html>')
  const headers = {'content-type': 'text/html; charset=utf-8', 'content-length': String(original.length)}
  const attempted = [], callbacks = []
  let failure, audit, records
  await assert.rejects(createCatalogScraper(provider).run({
    rateLimitMs: 0, now: () => '2026-11-08T00:00:00.000Z',
    onAudit: value => { callbacks.push('audit'); audit = value },
    onRecords: value => { callbacks.push('records'); records = value },
    fetchImpl: async (url, init) => {
      attempted.push(String(url))
      assert.equal(String(url), primary)
      assert.equal(init.method, 'GET')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.body, undefined)
      const requestHeaders = new Headers(init.headers)
      assert.equal(requestHeaders.has('authorization'), false)
      assert.equal(requestHeaders.has('cookie'), false)
      const response = new Response(original, {status: 403, headers})
      Object.defineProperty(response, 'url', {value: primary})
      return response
    },
    fetchPage: async () => assert.fail('Primary denial cannot authorize a fallback page read'),
    fetchJson: async () => assert.fail('Primary denial cannot authorize an API read'),
  }), error => {
    failure = error
    assert.equal(error.source, 'axa')
    assert.equal(typeof error.status, 'number')
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
  assert.deepEqual(callbacks, ['audit', 'records'])
  assert.deepEqual(records, [])
  const evidence = failure.nativeEvidence
  assert.deepEqual(evidence, audit)
  assertHeldEvidence(evidence, 0)
  assert.deepEqual(evidence.models, {})
  assert.equal(evidence.phase, 'current-primary')
  assert.equal(evidence.candidateQueryReportedTotal, null)
  assert.equal(evidence.candidatePagesComplete, false)
  assert.equal(evidence.closingVerified, false)
  assertOriginals(evidence, [{label: 'current-primary', requestedURL: primary, url: primary, status: 403, headers, bodyBytes: original.length, bodyBase64: original.toString('base64')}])
  t.diagnostic('axa: synthetic numeric primary HTTP403 and exact original body retained after one streaming read; no redirect, client or API acquisition and no empty-inventory authority')
}
