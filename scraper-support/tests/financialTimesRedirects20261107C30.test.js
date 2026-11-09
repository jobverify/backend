import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fixture, replay } from '../native-sources/declaredGreenhouse/fixtureReplay.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { CAREERS_URL, HOMEPAGE_URL, JOBS_URL, OFFICES_URL, FinancialTimesNativeError, run } from '../../scraper/financialtimes.workday/script.js'

const redirectFixture = JSON.parse(readFileSync(new URL('./fixtures/financialTimesRedirects20261107C30/original-redirect-20261106.json', import.meta.url)))
const originalRedirect = redirectFixture.originalRedirect
const shortlink = 'https://grnh.se/15b6xm02teu'
const destination = 'https://job-boards.eu.greenhouse.io/financialtimes33/jobs/4986356101?gh_src=15b6xm02teu'
const noEntityFields = ['body', 'bodyBase64', 'bodyBytes', 'bodySHA256', 'bodyFile', 'bytes', 'sha256']
const metadataResponse = () => ({ ...structuredClone(originalRedirect), url: originalRedirect.finalUrl })

// Exact 2026-11-06 redirect metadata and unmodified 2026-10-31 original bodies.
// Mutated copies below are artificial negative/compatibility controls, never
// new source evidence. Only the injected transport is replaced; the FT reader,
// original native inventory, office graph, criteria and reconciliation are real.
const mixedReplay = (mutate = page => page) => replay((url, page, visit) => url === shortlink ? mutate(metadataResponse(), visit) : page)
const runReplay = async transport => {
  let records
  const jobs = await run({ ...transport.options, fetchJson: undefined, onRecords: value => { records = value } })
  return { jobs, records, audit: transport.audits[0] }
}
const neverFetchedDestination = requests => {
  assert.equal(requests.includes(destination), false)
  assert.equal(requests.some(url => /^https:\/\/(?:job-boards|boards)\.eu\.greenhouse\.io\/[^/]+\/jobs\/\d/.test(url)), false)
}

// Hand-checked primary labels plus the original office assignments: a London
// assignment contributes UK even for a Sofia/Manila primary location. Global
// has no exact country. APAC has a native Singapore assignment, without any
// inference that every listed office is a permitted worksite.
const expectedCountryGroups = [
  { ids: [5005449101, 5005832101], countries: ['Bulgaria'] },
  { ids: [4843900101, 4988572101, 5012525101, 4990725101, 4843909101, 5012512101], countries: ['Bulgaria', 'United Kingdom'] },
  { ids: [4957425101, 4661293101], countries: ['Japan'] },
  { ids: [4994746101, 5005459101, 4995848101, 4934703101], countries: ['Philippines'] },
  { ids: [5005914101], countries: ['Philippines', 'United Kingdom'] },
  { ids: [4955611101, 4986356101, 4956447101, 4867279101, 4986429101, 4986433101, 4972630101, 5001682101, 4986425101], countries: ['United States'] },
  { ids: [4925933101, 4990062101], countries: ['Hong Kong'] },
  { ids: [4941525101, 4957427101, 4974960101, 4974948101, 5014837101, 4980589101, 4993670101, 4982019101, 4982682101, 4980591101, 4940643101, 4974955101, 4942579101, 4871868101, 4942792101, 4994743101, 4982684101, 4990743101, 5013194101], countries: ['United Kingdom'] },
  { ids: [4305803101], countries: [] },
  { ids: [4982843101], countries: ['Singapore'] },
]
const expectedCountries = new Map(expectedCountryGroups.flatMap(group => group.ids.map(id => [String(id), group.countries])))

test('FT accepts the original headers-only shortlink redirect and preserves the complete mixed-date native corpus', async t => {
  const transport = mixedReplay()
  const { jobs, records, audit } = await runReplay(transport)
  const expected = fixture.oracle.financialtimes.records
  assert.equal(expected.length, 47)
  assert.equal(records.length, 47)
  assert.equal(expectedCountries.size, 47)
  assert.deepEqual(records.map(job => job.jobId).sort(), expected.map(row => String(row.postId)).sort())
  assert.equal(audit.nativeInventoryComplete, true)
  assert.equal(audit.observationHistory.length, 47)
  assert.equal(audit.allOfficeAssignmentsAreAvailableWorksites, false)
  for (const row of expected) {
    const job = records.find(job => job.jobId === String(row.postId))
    const current = audit.observationHistory.find(pair => pair.postId === row.postId).current
    assert.equal(job.sourceCurrentNativeRoleQualified, true)
    // The saved closing projection precedes the final reconciliation of records.
    assert.equal(current.sourceCurrentNativeRoleQualified, false)
    for (const observation of [job, current]) {
      assert.deepEqual(observation.sourceNativeRecord, row.nativeFeedRecord)
      assert.deepEqual(observation.sourceNativeListingRecord, row.nativeFeedRecord)
      assert.equal(observation.sourceNativeContentText, row.nativeContentText)
      assert.equal(observation.jobDescription.replace(/\s+/g, ' ').trim(), row.fullCriteriaText)
      assert.equal(observation.sourceDetailComplete, true)
      assert.equal(observation.jobId, String(row.postId))
      assert.equal(observation.internalJobId, row.nativeFeedRecord.internal_job_id)
      assert.equal(observation.postingDate, row.nativeFeedRecord.first_published)
      assert.equal(observation.applyUrl, row.nativeFeedRecord.absolute_url)
      assert.deepEqual(observation.countries, expectedCountries.get(observation.jobId), observation.jobId)
      assert.equal(observation.country, observation.countries.length === 1 ? observation.countries[0] : null)
      assert.equal(observation.sourceIndiaEligible, false)
      assert.equal(observation.sourceScopeComplete, false)
      assert.equal(observation.lifecycleCleanupAllowed, false)
    }
  }
  for (const phase of [audit.openingSurfaces, audit.closingSurfaces]) {
    assert.ok(phase.pages.length >= 19)
    assert.deepEqual(phase.pages.find(page => page.url === shortlink), { url: shortlink, destination, id: '4986356101' })
    assert.deepEqual(phase.advertisedIds, ['4305803101', '4986356101', '4986425101', '4986429101', '4986433101'])
  }
  assert.equal(transport.requests.filter(url => url === shortlink).length, 2)
  assert.equal(transport.requests.filter(url => url === JOBS_URL).length, 2)
  assert.equal(transport.requests.filter(url => url === OFFICES_URL).length, 2)
  neverFetchedDestination(transport.requests)
  const rawRedirects = audit.rawPages.filter(page => page.requestedURL === shortlink)
  const redirectReceipts = audit.receipts.filter(receipt => receipt.url === shortlink)
  assert.equal(rawRedirects.length, 2)
  assert.equal(redirectReceipts.length, 2)
  for (const retained of [...rawRedirects, ...redirectReceipts]) {
    for (const [field, value] of Object.entries(originalRedirect)) assert.deepEqual(retained[field], value, field)
    assert.equal(retained.url, shortlink)
    assert.equal(retained.requestedURL, shortlink)
    for (const field of noEntityFields) assert.equal(Object.hasOwn(retained, field), false, field + ' must not be invented')
  }
  const originalAPI = fixture.entities.find(entity => entity.receipt.url === JOBS_URL)
  assert.equal(audit.receipts.filter(receipt => receipt.url === JOBS_URL).length, 2)
  for (const receipt of audit.receipts.filter(receipt => receipt.url === JOBS_URL)) {
    assert.equal(receipt.bodyBytes, originalAPI.receipt.bytes)
    assert.equal(receipt.bodySHA256, originalAPI.receipt.sha256)
  }
  assert.equal(jobs.length, 0)
  assert.equal(audit.complete, false)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.equal(audit.wholeCompanyGlobal, null)
  assert.equal(audit.wholeCompanyIndia, null)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readSourceObservationEvidence(jobs, 'financialtimes').observedRecordCount, 47)
  assert.equal(readSourceObservationEvidence(jobs, 'financialtimes').companyGlobalTotal, null)
  assert.equal(readSourceObservationEvidence(jobs, 'financialtimes').companyIndiaTotal, null)
  t.diagnostic('FT_C30_FULL_READER_RECEIPT=' + JSON.stringify({
    qualification: redirectFixture.qualification,
    originalManifestSHA256: redirectFixture.originalCapture.manifestSHA256,
    olderCorpusSHA256: redirectFixture.olderCorpus.sha256,
    nativePostings: records.length,
    nativeInventoryComplete: audit.nativeInventoryComplete,
    complete: audit.complete,
    sourceScopeComplete: audit.sourceScopeComplete,
    lifecycleCleanupAllowed: audit.lifecycleCleanupAllowed,
    wholeCompanyGlobal: audit.wholeCompanyGlobal,
    wholeCompanyIndia: audit.wholeCompanyIndia,
    originalMetadataReceipts: redirectReceipts,
    originalMetadataRawPages: rawRedirects,
    countries: records.map(job => ({ postId: job.jobId, country: job.country, countries: job.countries })),
    requestedURLs: transport.requests,
    redirectDestinationsFetched: false,
  }))
})

for (const status of [302, 303, 307, 308]) test('FT preserves its existing shortlink status ' + status + ' opt-in without requiring an entity', async () => {
  const transport = mixedReplay(page => ({ ...page, status }))
  const { records, audit } = await runReplay(transport)
  assert.equal(records.length, 47)
  assert.equal(audit.nativeInventoryComplete, true)
  assert.equal(audit.openingSurfaces.pages.find(page => page.url === shortlink).id, '4986356101')
  neverFetchedDestination(transport.requests)
})

const invalidMetadata = [
  ['body-free 200', page => ({ ...page, status: 200 })],
  ['missing original URL', page => { delete page.url; return page }],
  ['mismatched original URL', page => ({ ...page, url: destination })],
  ['missing Location', page => { delete page.headers.location; delete page.location; return page }],
  ['blank Location', page => ({ ...page, headers: { ...page.headers, location: '  ' } })],
  ['malformed Location', page => ({ ...page, headers: { ...page.headers, location: 'https://[' } })],
  ['non-HTTP Location', page => ({ ...page, headers: { ...page.headers, location: 'javascript:alert(1)' } })],
  ['304 status', page => ({ ...page, status: 304 })],
  ['399 status', page => ({ ...page, status: 399 })],
]
for (const [label, mutate] of invalidMetadata) test('FT rejects headers-only shortlink metadata with ' + label, async () => {
  const transport = mixedReplay(mutate)
  await assert.rejects(runReplay(transport), FinancialTimesNativeError)
  assert.equal(transport.requests.at(-1), shortlink)
  assert.equal(transport.requests.includes(JOBS_URL), false)
  assert.equal(transport.audits.length, 0)
  neverFetchedDestination(transport.requests)
})

for (const url of [HOMEPAGE_URL, CAREERS_URL, JOBS_URL]) test('FT still requires original body bytes for final 200 ' + url, async () => {
  const transport = replay((requested, page) => requested === url ? { url, status: 200, headers: page.headers, bodyUnavailable: true } : page)
  await assert.rejects(runReplay(transport), FinancialTimesNativeError)
  assert.equal(transport.requests.at(-1), url)
  assert.equal(transport.audits.length, 0)
})

test('FT does not admit a headers-only redirect on a primary corporate page', async () => {
  const transport = replay((url, page) => url === HOMEPAGE_URL ? { ...metadataResponse(), url } : page)
  await assert.rejects(runReplay(transport), FinancialTimesNativeError)
  assert.deepEqual(transport.requests, [HOMEPAGE_URL])
})

for (const target of ['https://job-boards.eu.greenhouse.io/another/jobs/999888777', 'https://jobs.example/financialtimes33/jobs/999888777']) test('FT holds an off-board shortlink target without fetching or advertising it: ' + target, async () => {
  const transport = mixedReplay(page => ({ ...page, headers: { ...page.headers, location: target }, location: target }))
  const { records, audit } = await runReplay(transport)
  assert.equal(records.length, 47)
  assert.equal(audit.nativeInventoryComplete, true)
  for (const phase of [audit.openingSurfaces, audit.closingSurfaces]) {
    assert.equal(phase.advertisedIds.includes('999888777'), false)
    assert.equal(phase.pages.some(page => page.url === shortlink), false)
    assert.ok(phase.external.some(entry => entry.url === shortlink))
  }
  assert.ok(audit.reasons.includes('unresolved-advertised-shortlink:' + shortlink))
  assert.equal(audit.complete, false)
  assert.equal(audit.wholeCompanyGlobal, null)
  assert.equal(audit.wholeCompanyIndia, null)
  assert.equal(transport.requests.includes(target), false)
  neverFetchedDestination(transport.requests)
})

test('FT preserves caller cancellation before any source request', async () => {
  const controller = new AbortController(), reason = new Error('caller cancelled before source read')
  controller.abort(reason)
  const transport = mixedReplay()
  await assert.rejects(run({ ...transport.options, fetchJson: undefined, signal: controller.signal }), error => error === reason)
  assert.deepEqual(transport.requests, [])
})

for (const phase of [1, 2]) test('FT preserves caller cancellation at the ' + (phase === 1 ? 'opening' : 'closing') + ' headers-only redirect boundary', async () => {
  const controller = new AbortController(), reason = new Error('caller cancelled at redirect headers')
  const transport = mixedReplay((page, visit) => { if (visit === phase) controller.abort(reason); return page })
  await assert.rejects(run({ ...transport.options, fetchJson: undefined, signal: controller.signal }), error => error === reason)
  assert.equal(transport.requests.at(-1), shortlink)
  assert.equal(transport.requests.filter(url => url === shortlink).length, phase)
  assert.equal(transport.requests.filter(url => url === JOBS_URL).length, phase === 1 ? 0 : 2)
  assert.equal(transport.audits.length, 0)
  neverFetchedDestination(transport.requests)
})
