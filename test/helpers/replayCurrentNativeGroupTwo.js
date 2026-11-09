import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const supportedSources = new Set(['asus', 'attackiq'])
export const expectedRegistrationParser = Object.freeze({asus: 'live-parser', attackiq: 'live-parser'})

const contracts = {
  asus: {company: 'Asus', primary: 'https://careers.asus.com/', board: 'https://jobs.jobvite.com/asus',
    requests: 32, observations: 28, partialRequests: 2, codePrefix: 'ASUS'},
  attackiq: {company: 'AttackIQ', primary: 'https://www.attackiq.com/who-we-are/careers/',
    board: 'https://www.attackiq.com/who-we-are/careers/openings/',
    requests: 7, observations: 1, partialRequests: 3, codePrefix: 'ATTACKIQ'},
}
const sha = value => createHash('sha256').update(value).digest('hex')

async function sourceFixture(source) {
  // Keep the multi-megabyte recorded originals out of unrelated batch cases.
  return source === 'asus'
    ? import('../test-data/asusNative20261108.js')
    : import('../test-data/attackiqNative20261108.js')
}

async function assertRegistration(provider) {
  assert.ok(supportedSources.has(provider.source), 'Unsupported current native source')
  const contract = contracts[provider.source]
  assert.equal(provider.companyName, contract.company)
  assert.equal(provider.companyCareerPage, contract.primary)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.parser, expectedRegistrationParser[provider.source])
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  const module = await import(pathToFileURL(provider.modulePath).href)
  assert.equal(module.SOURCE, provider.source)
  assert.equal(module.CAREERS_URL, contract.primary)
  assert.equal(typeof module.run, 'function')
  return contract
}

function assertNoInventoryAuthority(evidence, source) {
  assert.equal(evidence.source, source)
  assert.equal(evidence.recordKind, 'vacancy-rows')
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(evidence.lifecycleCleanupAllowed, false)
  assert.equal(evidence.companyGlobalTotal, null)
  assert.equal(evidence.companyIndiaTotal, null)
  assert.notEqual(evidence.sourceListingComplete, true)
  assert.notEqual(evidence.listingComplete, true)
  assert.notEqual(evidence.companyIndiaZeroProven, true)
  assert.equal(evidence.renderedCriteriaVisibilityQualified, false)
  assert.equal(evidence.activeHiringVerified, false)
  assert.equal(evidence.applicationActions, 0)
  assert.equal(evidence.publisherProgramsExecuted, false)
}

function assertRequest(input, init, expectedURL) {
  assert.equal(String(input), expectedURL)
  assert.equal(init.method, 'GET')
  assert.equal(init.redirect, 'manual')
  assert.equal(init.credentials, 'omit')
  assert.equal(init.body, undefined)
  const headers = new Headers(init.headers)
  assert.equal(headers.has('authorization'), false)
  assert.equal(headers.has('cookie'), false)
  assert.equal(headers.get('accept'), expectedURL === 'https://app.jazz.co/widgets/basic/create/AttackIQ'
    ? 'text/javascript,application/javascript,*/*' : 'text/html')
}

function recordedRun(fixtureModule) {
  const {fixture, replay} = fixtureModule
  const transport = replay(), base = transport.options.fetchImpl, forbiddenReads = []
  let audit = null, records = null
  const forbidden = kind => async input => {
    forbiddenReads.push({kind, url: String(input)})
    assert.fail('Native replay cannot use a legacy page helper or an unrecorded API')
  }
  return {
    ...transport, forbiddenReads,
    get audit() { return audit }, get records() { return records },
    options: {...transport.options,
      fetchImpl: async (input, init) => {
        const packet = fixture.packets[transport.requests.length]
        assert.ok(packet, 'No extra native request is authorized by the recorded fixture')
        assertRequest(input, init, packet.requestedURL)
        return base(input, init)
      },
      fetchPage: forbidden('fetchPage'), fetchJson: forbidden('fetchJson'),
      onAudit: value => { audit = value }, onRecords: value => { records = value },
    },
  }
}

function assertOriginals(evidence, io, fixture, count) {
  const packets = fixture.packets.slice(0, count)
  assert.equal(evidence.rawResponses.length, count)
  assert.equal(evidence.requestCount, count)
  assert.equal(io.requests.length, count)
  assert.deepEqual(io.requests.map(row => row.url), packets.map(row => row.requestedURL))
  assert.deepEqual(io.uncaptured, [])
  assert.deepEqual(io.forbiddenReads, [])
  for (const [index, original] of packets.entries()) {
    const body = Buffer.from(original.bodyBase64, 'base64')
    assert.equal(original.status, 200)
    assert.equal(body.length, original.bodyBytes)
    assert.equal(sha(body), original.bodySHA256)
    const receipt = evidence.rawResponses[index]
    assert.equal(receipt.requestedURL, original.requestedURL)
    const response = receipt.response
    assert.equal(response.url, original.url)
    assert.equal(response.status, original.status)
    assert.equal(response.redirected, false)
    assert.equal(response.identityValidated, true)
    assert.equal(response.acquisitionValidated, true)
    assert.equal(response.streamEOFObserved, true)
    assert.equal(response.bodyComplete, true)
    assert.equal(response.bodyBytes, original.bodyBytes)
    assert.equal(response.receivedBodyBytes, original.bodyBytes)
    assert.equal(response.rawBodyBase64, original.bodyBase64)
    assert.equal(response.body, body.toString('utf8'))
    assert.deepEqual(response.headers, Object.fromEntries(new Headers(original.headers).entries()))
  }
}

function assertFullModels(evidence, fixture, source) {
  const expected = fixture.expected
  for (const [actual, recorded] of Object.entries({primary: 'openingPrimary', board: 'openingBoard',
    closingBoard: 'closingBoard', closingPrimary: 'closingPrimary'})) {
    assert.deepEqual(evidence[actual], expected[recorded])
  }
  assert.deepEqual(evidence.details, source === 'asus' ? expected.details : [expected.detail])
  if (source === 'asus') {
    assert.deepEqual(evidence.detailRoutes, expected.detailRoutes)
    assert.equal(evidence.primary.nativeRegionalRoutes.length, 14)
    assert.equal(evidence.primary.nativeRoleFamilies.length, 4)
    assert.equal(evidence.observedRegionalRouteCount, 14)
    assert.equal(evidence.unvisitedRegionalRoutes.length, 13)
    assert.equal(evidence.occupationalFamiliesAreVacancies, false)
    assert.equal(evidence.indiaRoutingUnresolved, true)
  } else {
    assert.deepEqual(evidence.helper, expected.openingHelper)
    assert.deepEqual(evidence.closingHelper, expected.closingHelper)
    assert.equal(evidence.helper.nativeInsertions.length, 5)
    assert.deepEqual(evidence.detailRoutes, [expected.detail.sourcePage])
  }
  // These are closing responses in the offline fixture sequence. Replaying a
  // repeated response does not prove a separately acquired live closing check.
  assert.equal(evidence.closingVerified, true)
}

function assertFullRows(records, fixture, source) {
  assert.equal(records.length, contracts[source].observations)
  for (const [index, row] of records.entries()) {
    const detail = source === 'asus' ? fixture.expected.details[index] : fixture.expected.detail
    assert.equal(row.source, source)
    assert.equal(row.publisher, source === 'asus' ? 'ASUS' : 'AttackIQ')
    assert.equal(row.sourceUrl, detail.sourcePage)
    assert.equal(row.nativeObservationOrdinal, index)
    assert.deepEqual(row.sourceNativeDetail, detail)
    assert.equal(row.jobDescription, detail.fullCriteriaText)
    assert.equal(row.sourceNativeAuthoredCriteriaAvailable, true)
    assert.equal(row.sourceNativeCriteriaComplete, true)
    assert.equal(row.sourceNativeIdentityBound, true)
    assert.equal(row.sourceNativeCurrentPublicationQualified, true)
    assert.equal(row.sourceNativeCriteriaVisibilityQualified, false)
    assert.equal(row.sourceDetailComplete, true)
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
    assert.equal(row.activeApplyVerified, false)
    assert.equal(row.applicationVisited, false)
    assert.equal(row.requisitionId, null)
    assert.equal(row.closingDate, null)
    assert.equal(row.dateOpened, null)
    if (source === 'asus') {
      const native = detail.nativeJobRecords[0]
      assert.equal(row.company, 'ASUS Computer International')
      assert.equal(row.country, 'United States')
      assert.equal(row.title, native.title)
      assert.equal(row.jobId, native.identifier)
      assert.equal(row.postingDate, native.datePosted)
      assert.equal(row.employmentType, native.employmentType)
      assert.equal(row.industry, native.industry)
      assert.deepEqual(row.sourceNativeRecord, native)
      assert.deepEqual(row.sourceNativeListingRecord, fixture.expected.openingBoard.records[index])
      assert.equal(row.sourceNativeOwnDescriptionHTML,
        [...detail.nativeDescriptionCarriers, ...detail.nativeSupplementalCriteriaCarriers].map(value => value.nativeHTML).join('\n'))
      assert.equal(row.sourceCurrentNativeRoleQualified, true)
      assert.equal(row.sourceCountryScopeUnresolved, false)
      assert.ok(row.jobDescription.includes('Applicants must be authorized to work for ANY employer in the U.S.'))
    } else {
      assert.equal(row.company, 'AttackIQ')
      assert.equal(row.country, null)
      assert.equal(row.location, 'Remote')
      assert.equal(row.title, 'Client Security Advisor (USA)')
      assert.equal(row.jobId, 'tV5qKlrDFw')
      assert.equal(row.postingDate, null)
      assert.equal(row.city, null)
      assert.equal(row.state, null)
      assert.equal(row.employmentType, 'Full Time')
      assert.equal(row.experience, 'Experienced')
      assert.deepEqual(row.sourceNativeRecord, fixture.expected.openingHelper.records[0])
      assert.deepEqual(row.sourceNativeEmployerClaim, detail.nativeOrganizationRecords[0])
      assert.deepEqual(row.sourceNativeCountryClaims, [])
      assert.equal(row.sourceNativeOwnDescriptionHTML, detail.nativeDescriptionCarriers[0].nativeHTML)
      assert.equal(row.sourceCurrentNativeRoleQualified, false)
      assert.equal(row.sourceCountryScopeUnresolved, true)
      assert.equal(row.jobDescription.match(/Note to all recruitment agencies/g).length, 2)
    }
  }
  assert.equal(records.reduce((sum, row) => sum + row.jobDescription.length, 0), source === 'asus' ? 154783 : 5240)
}

function assertSelection(jobs, io, fixture, source, expectedReturned) {
  const contract = contracts[source], evidence = jobs.nativeCollectionEvidence
  assert.equal(jobs.length, expectedReturned)
  assertNoInventoryAuthority(evidence, source)
  assert.equal(evidence.observedRecordCount, contract.observations)
  assert.equal(evidence.observedVacancyCount, contract.observations)
  assert.equal(evidence.observedAt, fixture.captureCompletedAt)
  assert.deepEqual(evidence.auditSinkFailures, [])
  assertFullModels(evidence, fixture, source)
  assertFullRows(evidence.observations, fixture, source)
  assert.deepEqual(io.audit, evidence)
  assert.deepEqual(io.records, evidence.observations)
  assertOriginals(evidence, io, fixture, contract.requests)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.surface, contract.board)
  assert.equal(inventory.firstParty, true)
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.pagesFetched, contract.requests)
  assert.deepEqual(readSourceObservationEvidence(jobs, source), {
    source, recordKind: 'vacancy-rows', observedRecordCount: contract.observations,
    observedVacancyCount: contract.observations, sourceScopeComplete: false,
    companyGlobalTotal: null, companyIndiaTotal: null,
  })
  for (const [index, row] of jobs.entries()) {
    assert.equal(row.source, source)
    assert.equal(row.company, 'ASUS Computer International')
    assert.equal(row.country, 'United States')
    assert.equal(row.sourceUrl, fixture.expected.details[index].sourcePage)
    assert.equal(row.applyUrl, null)
    assert.equal(row.jobDescription, fixture.expected.details[index].fullCriteriaText)
    assert.deepEqual(row.sourceNativeRecord, fixture.expected.details[index].nativeJobRecords[0])
    assert.equal(row.sourceScopeComplete, false)
    assert.equal(row.lifecycleCleanupAllowed, false)
    assert.equal(row.activeApplyVerified, false)
    assert.equal(row.applicationVisited, false)
  }
}

async function assertPartial(provider, fixtureModule) {
  const source = provider.source, contract = contracts[source], io = recordedRun(fixtureModule)
  let held = null
  await assert.rejects(createCatalogScraper(provider).run({...io.options, countryFilter: 'Global', maxRequests: contract.partialRequests}), error => {
    held = error
    assert.equal(error.code, contract.codePrefix + '_REQUEST_BUDGET')
    assert.equal(error.source, source)
    assert.equal(error.abortRetries, true)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    const evidence = error.nativeEvidence
    assertNoInventoryAuthority(evidence, source)
    assert.equal(evidence.closingVerified, false)
    assert.deepEqual(evidence.primary, fixtureModule.fixture.expected.openingPrimary)
    assert.deepEqual(evidence.board, fixtureModule.fixture.expected.openingBoard)
    if (source === 'attackiq') assert.deepEqual(evidence.helper, fixtureModule.fixture.expected.openingHelper)
    assert.deepEqual(evidence.details, [])
    assert.equal(evidence.observedRecordCount, contract.observations)
    assert.equal(evidence.observedVacancyCount, contract.observations)
    assert.equal(evidence.observations.length, contract.observations)
    for (const row of evidence.observations) {
      assert.equal(row.source, source)
      assert.equal(row.company, null)
      assert.equal(row.country, null)
      assert.equal(row.jobDescription, null)
      assert.equal(row.sourceNativeEmployerClaim, null)
      assert.equal(row.sourceNativeOwnDescriptionHTML, null)
      assert.equal(row.sourceNativeAuthoredCriteriaAvailable, false)
      assert.equal(row.sourceNativeIdentityBound, false)
      assert.equal(row.sourceNativeCriteriaComplete, false)
      assert.equal(row.sourceNativeCurrentPublicationQualified, false)
      assert.equal(row.sourceCurrentNativeRoleQualified, false)
      assert.equal(row.sourceCountryScopeUnresolved, true)
      assert.equal(row.sourceDetailComplete, false)
      assert.equal(row.sourceScopeComplete, false)
      assert.equal(row.lifecycleCleanupAllowed, false)
    }
    assertOriginals(evidence, io, fixtureModule.fixture, contract.partialRequests)
    assert.deepEqual(io.audit, evidence)
    assert.deepEqual(io.records, evidence.observations)
    return true
  })
  return held
}

export async function assertCurrentNativeExtraction(t, provider) {
  const contract = await assertRegistration(provider), source = provider.source
  const fixtureModule = await sourceFixture(source), {fixture} = fixtureModule
  assert.equal(fixture.source, source)
  assert.equal(fixture.packets.length, contract.requests)
  let globalResult = null, indiaResult = null, partialError = null
  await t.test('all recorded original native models survive Global selection', async () => {
    const io = recordedRun(fixtureModule)
    const jobs = await createCatalogScraper(provider).run({...io.options, countryFilter: 'Global'})
    assertSelection(jobs, io, fixture, source, source === 'asus' ? 28 : 0)
    globalResult = {jobs, records: io.records, calls: io.requests}
  })
  await t.test('default India selection preserves observations without certifying empty inventory', async () => {
    const io = recordedRun(fixtureModule)
    const jobs = await createCatalogScraper(provider).run(io.options)
    assertSelection(jobs, io, fixture, source, 0)
    indiaResult = {jobs, records: io.records, calls: io.requests}
  })
  await t.test('finite generic pagination is rejected before any acquisition', async () => {
    const io = recordedRun(fixtureModule)
    await assert.rejects(createCatalogScraper(provider).run({...io.options, maxPages: 4}), error => {
      assert.equal(error.code, contract.codePrefix + '_INVALID_OPTIONS')
      return true
    })
    assert.deepEqual(io.requests, [])
    assert.deepEqual(io.uncaptured, [])
    assert.deepEqual(io.forbiddenReads, [])
  })
  await t.test('a real request-budget failure retains the native listing and leaves unobserved fields unknown', async () => {
    partialError = await assertPartial(provider, fixtureModule)
  })
  return {globalResult, indiaResult, partialError}
}

export async function assertCurrentNativeDenial(t, provider) {
  const contract = await assertRegistration(provider), source = provider.source
  const {fixture} = await sourceFixture(source), calls = [], forbiddenReads = []
  const body = Buffer.from('Forbidden'), responseHeaders = {'content-type': 'text/html', 'content-length': String(body.length)}
  const fetchImpl = async (input, init) => {
    calls.push(String(input))
    assert.equal(calls.length, 1, 'A primary denial cannot authorize further acquisition')
    assertRequest(input, init, contract.primary)
    const response = new Response(body, {status: 403, headers: responseHeaders})
    Object.defineProperty(response, 'url', {value: contract.primary})
    return response
  }
  const forbidden = kind => async input => {
    forbiddenReads.push({kind, url: String(input)})
    assert.fail('Primary denial cannot authorize a legacy helper or API read')
  }
  let held = null
  await assert.rejects(createCatalogScraper(provider).run({fetchImpl,
    fetchPage: forbidden('fetchPage'), fetchJson: forbidden('fetchJson'),
    rateLimitMs: 0, now: () => fixture.captureCompletedAt}), error => {
    held = error
    assert.equal(error.source, source)
    assert.equal(typeof error.status, 'number')
    assert.equal(error.status, 403)
    assert.match(error.message, /HTTP 403/)
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.softFailure, true)
    assert.equal(error.upstreamOutage, true)
    assert.equal(error.abortRetries, true)
    assert.equal(error.sourceScopeComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    const evidence = error.nativeEvidence
    assertNoInventoryAuthority(evidence, source)
    assert.equal(evidence.requestCount, 1)
    assert.equal(evidence.closingVerified, false)
    assert.equal(evidence.primary, null)
    assert.equal(evidence.board, null)
    assert.deepEqual(evidence.details, [])
    assert.deepEqual(evidence.observations, [])
    assert.equal(evidence.observedRecordCount, 0)
    assert.equal(evidence.observedVacancyCount, 0)
    assert.equal(evidence.rawResponses.length, 1)
    const receipt = evidence.rawResponses[0]
    assert.equal(receipt.requestedURL, contract.primary)
    assert.equal(receipt.phase, 'opening-primary')
    const response = receipt.response
    assert.equal(response.status, 403)
    assert.equal(response.url, contract.primary)
    assert.equal(response.redirected, false)
    assert.equal(response.identityValidated, true)
    assert.equal(response.acquisitionValidated, true)
    assert.equal(response.streamEOFObserved, true)
    assert.equal(response.bodyComplete, true)
    assert.equal(response.bodyBytes, body.length)
    assert.equal(response.body, 'Forbidden')
    assert.equal(sha(Buffer.from(response.rawBodyBase64, 'base64')), sha(body))
    assert.notEqual(error.inventoryEvidence?.status, 'verified-empty')
    assert.notEqual(error.inventoryEvidence?.listingComplete, true)
    assert.notEqual(error.inventoryEvidence?.lifecycleCleanupAllowed, true)
    return true
  })
  assert.deepEqual(calls, [contract.primary])
  assert.deepEqual(forbiddenReads, [])
  return {error: held, calls}
}
