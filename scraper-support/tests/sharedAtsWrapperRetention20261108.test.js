import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog, decorateJobsWithProviderMetadata } from '../providers/index.js'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { readSourceObservationEvidence } from '../utils/sourceObservationEvidence.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// Synthetic transport controls exercise actual production selection, accounting
// and registry decoration. They make no current employer recovery claim.
const description = '<p>Build and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const catalog = getScraperCatalog()
const auditOf = jobs => {
  const descriptor = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')
  assert.ok(descriptor && Object.hasOwn(descriptor, 'value'), 'Full native audit must be retained as data')
  assert.equal(descriptor.enumerable, false)
  return descriptor.value
}
const ashbyRow = (board, id, location = 'Worldwide', country = '') => ({
  id, title: 'Software Engineer', isListed: true, location,
  address: { postalAddress: { addressCountry: country } }, descriptionHtml: description,
  jobUrl: `https://jobs.ashbyhq.com/${board}/${id}`, applyUrl: `https://jobs.ashbyhq.com/${board}/${id}/application`,
  unknownNativeField: { complete: ['retain', id], criteriaHtml: '<p>Native criteria only.</p>' },
})

test('registered runtime ATS keeps the complete original payload when country selection returns no jobs', async () => {
  const provider = catalog.find(row => row.source === 'classdojo')
  const payload = { apiVersion: '1', jobs: [ashbyRow(provider.boardToken, 'unknown')],
    unknownEnvelope: { cursor: null, nativeMetadata: ['whole response'] } }
  const expected = structuredClone(payload)
  const jobs = await createCatalogScraper(provider).run({
    fetchPage: async url => ({ status: 200, url,
      html: `<a href="https://jobs.ashbyhq.com/${provider.boardToken}">All open roles</a>` }),
    fetchJson: async () => payload,
  })
  assert.equal(jobs.length, 0)
  const audit = auditOf(jobs)
  assert.deepEqual(audit.nativePayload, expected)
  assert.deepEqual(audit.nativeRecords, expected.jobs)
  payload.jobs[0].unknownNativeField.complete.push('later producer mutation')
  assert.deepEqual(audit.nativePayload, expected, 'Producer mutation cannot rewrite retained provenance')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('runtime native country reconciliation retains missing original countries beside derived records and proof', async () => {
  const provider = catalog.find(row => row.source === 'abridge')
  const row = { ...ashbyRow('Abridge', 'nursing-role', 'Remote - Tier 1', 'USA'),
    title: 'Senior Nursing Executive', workplaceType: 'Remote',
    secondaryLocations: [{ location: 'Remote - Tier 3', address: { postalAddress: {} } },
      { location: 'Remote - Tier 2', address: { postalAddress: {} } }] }
  const payload = { apiVersion: '1', jobs: [row] }, original = structuredClone(payload)
  const application = { organization: { hostedJobsPageSlug: 'Abridge', name: 'Abridge' }, posting: {
    id: row.id, title: row.title, isListed: true, isConfidential: false, workplaceType: 'Remote',
    locationName: row.location, secondaryLocationNames: row.secondaryLocations.map(location => location.location),
    descriptionHtml: row.descriptionHtml,
  } }
  const posting = { '@type': 'JobPosting', identifier: { '@type': 'PropertyValue', value: row.id },
    title: row.title, description: row.descriptionHtml, jobLocationType: 'TELECOMMUTE',
    jobLocation: { '@type': 'Place', address: { addressCountry: 'USA' } },
    applicantLocationRequirements: { '@type': 'Country', name: 'USA' } }
  const jobs = await createCatalogScraper(provider).run({
    fetchPage: async url => ({ status: 200, url, html: url === provider.companyCareerPage
      ? '<a href="https://jobs.ashbyhq.com/Abridge">View all open roles</a>'
      : `<script>window.__appData = ${JSON.stringify(application)};</script>`
        + `<script type="application/ld+json">${JSON.stringify(posting)}</script>` }),
    fetchJson: async () => payload,
  })
  assert.equal(jobs.length, 0)
  const audit = auditOf(jobs)
  assert.deepEqual(audit.nativePayload, original)
  assert.deepEqual(audit.nativeRecords, original.jobs)
  assert.deepEqual(payload, original)
  assert.equal(audit.nativeCountryReconciliation.nativePayload.jobs[0].secondaryLocations[0].address.postalAddress.addressCountry, 'USA')
  assert.equal(audit.nativeCountryReconciliation.nativeRecords[0].secondaryLocations[1].address.postalAddress.addressCountry, 'USA')
  assert.equal(audit.nativeCountryReconciliation.proofs[0].jobId, 'nursing-role')
  assert.match(audit.nativeCountryReconciliation.proofs[0].sha256, /^[a-f0-9]{64}$/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
})

const config = { source: 'ats-wrapper-retention-fixture', companyName: 'Example Corporation',
  companyDomain: 'employer.test', companyCareerPage: 'https://employer.test/careers' }
const fixtures = [
  { kind: 'ashby', board: 'https://jobs.ashbyhq.com/fixture', endpoint: 'api.ashbyhq.com',
    payload: { apiVersion: '1', nativeEnvelope: { unknown: 'retained' }, jobs: [
      ashbyRow('fixture', 'foreign', 'Boston, United States', 'US'), ashbyRow('fixture', 'unknown'),
      { ...ashbyRow('fixture', 'intake', 'Boston, United States', 'US'), title: 'Talent Network' },
    ] } },
  { kind: 'greenhouse', board: 'https://job-boards.greenhouse.io/fixture', endpoint: 'boards-api.greenhouse.io',
    payload: { meta: { total: 3 }, departments: [{ id: 45, name: 'Engineering' }], jobs: [
      { id: 1, title: 'Software Engineer', company_name: config.companyName, location: { name: 'United States' },
        content: description, internal_job_id: 10, absolute_url: 'https://job-boards.greenhouse.io/fixture/jobs/1',
        unknownNativeField: { criteria: ['full native'] } },
      { id: 2, title: 'Software Engineer', company_name: config.companyName, location: { name: 'Worldwide' },
        content: description, internal_job_id: 20, absolute_url: 'https://job-boards.greenhouse.io/fixture/jobs/2' },
      { id: 3, title: 'Future opportunities', company_name: config.companyName, location: { name: 'United States' },
        content: description, internal_job_id: null, absolute_url: 'https://job-boards.greenhouse.io/fixture/jobs/3' },
    ] } },
  { kind: 'lever', board: 'https://jobs.lever.co/fixture', endpoint: 'api.lever.co', payload: [
    { id: 'foreign', text: 'Software Engineer', country: 'US', categories: { location: 'United States' },
      description, hostedUrl: 'https://jobs.lever.co/fixture/foreign', applyUrl: 'https://jobs.lever.co/fixture/foreign/apply',
      unknownNativeField: { criteria: ['full native'] } },
    { id: 'unknown', text: 'Software Engineer', country: null, categories: { location: 'Worldwide' },
      description, hostedUrl: 'https://jobs.lever.co/fixture/unknown', applyUrl: 'https://jobs.lever.co/fixture/unknown/apply' },
    { id: 'intake', text: 'Talent Network', country: 'US', categories: { location: 'United States' },
      description, hostedUrl: 'https://jobs.lever.co/fixture/intake', applyUrl: 'https://jobs.lever.co/fixture/intake/apply' },
  ] },
]
const runBoards = (boards, fetchJson, selected = config) => createVerifiedRecruitmentScraper(selected).run({
  now: () => '2026-11-08T10:00:00.000Z', requestIntervalMs: 0,
  fetchPage: async url => ({ status: 200, url, html: '<h1>Careers</h1>'
    + boards.map(board => `<a href="${board}">Jobs</a>`).join('') }), fetchJson,
})

for (const fixture of fixtures) {
  test(`verified recruitment retains full ${fixture.kind} models after normalized observation accounting and registry decoration`, async () => {
    const payload = structuredClone(fixture.payload), expected = structuredClone(payload)
    const raw = await runBoards([fixture.board], async url => {
      assert.equal(new URL(url).hostname, fixture.endpoint)
      return payload
    })
    const jobs = decorateJobsWithProviderMetadata(raw, config)
    assert.equal(jobs.length, 0)
    const audit = auditOf(jobs)
    assert.equal(audit.nativeBoards.length, 1, 'The count-only observation fallback is insufficient')
    const board = audit.nativeBoards[0]
    assert.equal(board.kind, fixture.kind)
    assert.equal(board.surface, fixture.board)
    assert.equal(board.boardToken, 'fixture')
    assert.deepEqual(board.nativePayload, expected)
    assert.deepEqual(board.nativeRecords, Array.isArray(expected) ? expected : expected.jobs)
    const observations = readSourceObservationEvidence(jobs, config.source)
    assert.deepEqual(observations, { source: config.source, recordKind: 'mixed', observedRecordCount: 3,
      observedVacancyCount: 2, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    for (const [key, value] of Object.entries(observations)) assert.equal(audit[key], value)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
    assert.equal(raw[RECRUITMENT_OBSERVATIONS].returnedIndiaJobs, 0)
    ;(Array.isArray(payload) ? payload : payload.jobs)[0].title = 'Producer mutation'
    assert.deepEqual(board.nativePayload, expected)
  })
}

test('verified recruitment retains independent native boards with colliding IDs without merging their payloads', async () => {
  const jobs = await runBoards(['https://jobs.ashbyhq.com/fixture', 'https://jobs.ashbyhq.com/second'], async url => {
    const board = new URL(url).pathname.split('/').at(-1)
    return { apiVersion: '1', ownEnvelope: board, jobs: [ashbyRow(board, 'same-id', 'Boston, United States', 'US')] }
  })
  const audit = auditOf(decorateJobsWithProviderMetadata(jobs, config))
  assert.deepEqual(audit.nativeBoards.map(board => [board.boardToken, board.nativePayload.ownEnvelope]),
    [['fixture', 'fixture'], ['second', 'second']])
  assert.equal(audit.observedRecordCount, 2)
  assert.equal(audit.observedVacancyCount, 2)
})

test('a successful empty native board keeps its complete envelope without inventing observation counts', async () => {
  const payload = { apiVersion: '1', jobs: [], unknownEnvelope: { reason: 'empty native response' } }
  const jobs = await runBoards(['https://jobs.ashbyhq.com/fixture'], async () => payload)
  const audit = auditOf(decorateJobsWithProviderMetadata(jobs, config))
  assert.deepEqual(audit.nativeBoards[0].nativePayload, payload)
  assert.equal(readSourceObservationEvidence(jobs, config.source), null)
  assert.equal(Object.hasOwn(audit, 'observedRecordCount'), false)
  assert.equal(Object.hasOwn(audit, 'observedVacancyCount'), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('a rejected native envelope cannot become a successful full native board audit', async () => {
  const jobs = await runBoards(['https://jobs.ashbyhq.com/fixture'], async () => ({ error: 'denied', jobs: [ashbyRow('fixture', 'untrusted')] }))
  const decorated = decorateJobsWithProviderMetadata(jobs, config)
  assert.equal(decorated.length, 0)
  assert.equal(Object.getOwnPropertyDescriptor(decorated, 'nativeCollectionEvidence'), undefined)
  assert.equal(readSourceObservationEvidence(decorated, config.source), null)
  assert.equal(readInventoryEvidence(decorated).listingComplete, false)
})
