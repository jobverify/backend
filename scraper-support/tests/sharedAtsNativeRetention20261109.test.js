import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createPublishingGapAtsScraper } from '../utils/publishingGapAts.js'
import { mapJobsWithInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'

// Saved public fixture and synthetic controls exercise real production paths.
// Retaining these models is not a fresh publisher, country or vacancy claim.
const description = '<p>Build and maintain production software services and investigate distributed system failures.</p>'
const ashby = (board, id, country = 'US') => ({ id, title: 'Software Engineer', isListed: true,
  location: country === 'IN' ? 'Bengaluru, India' : country ? 'Boston, United States' : 'Worldwide',
  address: { postalAddress: { addressCountry: country } }, descriptionHtml: description,
  jobUrl: `https://jobs.ashbyhq.com/${board}/${id}`, applyUrl: `https://jobs.ashbyhq.com/${board}/${id}/application`,
  nativeExtra: { criteria: ['preserve complete models'] } })
const audit = jobs => {
  const field = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')
  assert.ok(field && Object.hasOwn(field, 'value'), 'Full source data must survive an empty result')
  assert.equal(field.enumerable, false)
  assert.equal(field.configurable, true)
  return field.value
}

test('the saved 40-record Sentry native payload survives shared Ashby selection of zero India jobs', async () => {
  const compressed = readFileSync(new URL('../../scraper/sentry/test-data/native-current-20261102.json.gz', import.meta.url))
  assert.equal(createHash('sha256').update(compressed).digest('hex'), '65e4b95ac65f358444fd0ef164f6f10ed1b38e7d0cab044bd3dd9b23f9ba69b8')
  const fixture = JSON.parse(gunzipSync(compressed, { maxOutputLength: 16 * 1024 * 1024 }))
  const payload = fixture.responses.inventory, original = structuredClone(payload)
  assert.equal(payload.jobs.length, 40)
  const jobs = await createPublishingGapAtsScraper({ source: 'sentry', companyName: 'Sentry',
    atsPlatform: 'ashby', boardToken: 'sentry', companyCareerPage: 'https://sentry.io/careers/',
    sourceScopeComplete: false }).run({ fetchJson: async () => payload })
  assert.equal(jobs.length, 0)
  assert.deepEqual(audit(jobs).nativeRecords, original.jobs)
  assert.deepEqual(audit(jobs).nativePayload, original)
  payload.jobs[0].title = 'Later producer mutation'
  assert.deepEqual(audit(jobs).nativePayload, original)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('full Ashby models include foreign, unknown, intake and unlisted rows before mapping', async () => {
  const payload = { apiVersion: '1', unknownEnvelope: { complete: true }, jobs: [
    ashby('fixture', 'india', 'IN'), ashby('fixture', 'foreign'), ashby('fixture', 'unknown', ''),
    { ...ashby('fixture', 'unlisted'), isListed: false },
    { ...ashby('fixture', 'intake'), title: 'Talent Network' },
  ] }
  const original = structuredClone(payload)
  const jobs = await createPublishingGapAtsScraper({ source: 'fixture', companyName: 'Example', atsPlatform: 'ashby',
    boardToken: 'fixture', companyCareerPage: 'https://employer.test/careers', sourceScopeComplete: false })
    .run({ fetchJson: async () => payload })
  assert.equal(jobs.length, 1)
  assert.deepEqual(audit(jobs).nativePayload, original)
  assert.deepEqual(audit(jobs).nativeRecords, original.jobs)
  assert.equal(Object.hasOwn(audit(jobs), 'observedVacancyCount'), false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('mapping an empty array retains only its source audit without evaluating metadata getters', () => {
  const source = [], retained = { source: 'fixture', nativeRecords: [{ full: ['data'] }], nativePayload: { jobs: [] } }
  Object.defineProperty(source, 'nativeCollectionEvidence', { value: retained })
  Object.defineProperty(source, 'unrelated', { get: () => assert.fail('Unrelated getter was invoked') })
  const mapped = mapJobsWithInventoryEvidence(source, () => assert.fail('Empty result mapper ran'))
  assert.equal(audit(mapped), retained)
  assert.equal(Object.hasOwn(mapped, 'unrelated'), false)
  const accessor = []
  Object.defineProperty(accessor, 'nativeCollectionEvidence', { get: () => assert.fail('Audit accessor was invoked') })
  assert.equal(Object.hasOwn(mapJobsWithInventoryEvidence(accessor, row => row), 'nativeCollectionEvidence'), false)
})

for (const source of ['spotify', 'cartesia']) {
  test(`registered ${source} adapter retains the entire native feed through registry decoration`, async () => {
    const provider = getScraperCatalog().find(row => row.source === source)
    const payload = source === 'cartesia'
      ? { apiVersion: '1', jobs: [ashby('cartesia', 'foreign'), ashby('cartesia', 'unknown', '')], extra: { retained: true } }
      : [{ id: 'foreign', text: 'Software Engineer', country: 'US', categories: { location: 'United States' },
        description, hostedUrl: 'https://jobs.lever.co/spotify/foreign', applyUrl: 'https://jobs.lever.co/spotify/foreign/apply',
        nativeExtra: { retained: true } },
      { id: 'unknown', text: 'Software Engineer', country: null, categories: { location: 'Worldwide' },
        description, hostedUrl: 'https://jobs.lever.co/spotify/unknown', applyUrl: 'https://jobs.lever.co/spotify/unknown/apply' }]
    const original = structuredClone(payload)
    const jobs = await createCatalogScraper(provider).run({ fetchJson: async () => payload })
    assert.equal(jobs.length, 0)
    assert.deepEqual(audit(jobs).nativePayload, original)
    assert.deepEqual(audit(jobs).nativeRecords, Array.isArray(original) ? original : original.jobs)
    assert.equal(audit(jobs).source, source)
  })
}
