import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../phenom/engine.js'
import { reviewedPhenomTitleBindingsForSource } from '../phenom/reviewedTitleBindings20261108.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { run as runJuniper } from '../../scraper/juniper/script.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/juniper/current-20261024-international-postal.json.gz', import.meta.url))))
const engine = () => createPhenomScraper({ source: 'juniper', companyName: 'Juniper Networks', nativeBoundModelTitlePreference: true, nativeReviewedTitleBindings: reviewedPhenomTitleBindingsForSource('juniper'), baseUrl: 'https://careers.hpe.com',
  searchPath: '/juniper', jobPathPrefix: '/us/en', scraperDir: fileURLToPath(new URL('.', import.meta.url)) })
const replay = (sample, mutate = () => {}) => {
  const copy = structuredClone(sample)
  mutate(copy)
  return engine().run({ fetchText: async url => url === 'https://careers.hpe.com/juniper'
    ? '<script>phApp.ddo = ' + JSON.stringify({ targetedJobs: { status: 200, totalHits: 1, hits: 1, data: { jobs: [copy.listing] } } }) + '</script>'
    : '<link rel="canonical" href="' + copy.canonical + '"><script>phApp.ddo = '
      + JSON.stringify({ jobDetail: { status: 200, data: { job: copy.job } } }).replaceAll('<', '\\u003c') + '</script>'
      + '<script type="application/ld+json">' + JSON.stringify(copy.posting).replaceAll('<', '\\u003c') + '</script>' })
}

test('all current 378 Juniper native countries reconcile, including Korea and Hong Kong labels', async () => {
  const jobs = await runJuniper({ detailEnrichmentBudgetMs: 0, fetchJson: async () => structuredClone(fixture.listingPayload),
    fetchText: async () => assert.fail('zero detail budget must not read a role') })
  assert.equal(jobs.length, 166)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 378)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 166)
  assert.ok(jobs.every(job => job.sourceDetailComplete === false), 'A listing check does not certify descriptions')
})

for (const country of ['IN', 'India / IN']) test('explicit native India ISO country remains an eligible listing: ' + country, async () => {
  const sample = structuredClone(fixture.samples[0].listing)
  sample.country = country
  const payload = { targetedJobs: { status: 200, totalHits: 1, hits: 1, data: { jobs: [sample] } } }
  const jobs = await engine().run({ detailEnrichmentBudgetMs: 0,
    fetchText: async () => '<script>phApp.ddo = ' + JSON.stringify(payload) + '</script>' })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

for (const sample of fixture.samples.filter(sample => sample.id !== '1207295')) test('corroborated native international/placeholder postal labels retain India role ' + sample.id, async () => {
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, sample.id)
  assert.equal(job.title, sample.listing.title)
  assert.equal(job.country, 'India')
  assert.equal(job.applyUrl, sample.listing.applyUrl)
  assert.ok(job.jobDescription.length > 1000)
})

for (const [name, mutate] of [
  ['different native postal label', office => { office.postalCode = 'unrelated' }],
  ['different office country', office => { office.country = 'United States' }],
  ['different office city', office => { office.city = 'Unrelated' }],
  ['different full office region', office => { office.cityStateCountry = 'Boston, Massachusetts, United States' }],
  ['different short office region', office => { office.location = 'Unrelated, Other, 109841' }],
]) test('native postal corroboration still rejects ' + name, async () => {
  const [job] = await replay(fixture.samples[0], sample => mutate(sample.job.multi_location.at(-1)))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

test('a fully bound native model retains its stale schema title as separate evidence', async () => {
  const sample = fixture.samples.find(sample => sample.id === '1207295')
  assert.notEqual(sample.job.title, sample.posting.title)
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.title, sample.job.title)
  assert.equal(job.sourceNativeDetailEvidence.nativeTitle, sample.job.title)
  assert.equal(job.sourceNativeDetailEvidence.jsonLdTitle, sample.posting.title)
  assert.ok(job.jobDescription.length > 100)
})
