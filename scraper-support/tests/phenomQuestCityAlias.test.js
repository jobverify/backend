import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { run as runQuest } from '../../scraper/questglobal/script.js'
import { createPhenomScraper } from '../phenom/engine.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/phenom/quest-bangalore-city-label-20261025.json', import.meta.url), 'utf8'))
const defaultScraper = createPhenomScraper({
  source: 'other-phenom', companyName: 'Other Phenom', baseUrl: 'https://careers.quest-global.com',
  searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)),
})
const replay = (sample, change = () => {}, run = runQuest) => {
  const copy = structuredClone(sample)
  change(copy)
  const listing = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
    status: 200, totalHits: 1, hits: 1, data: { jobs: [copy.listing],
      aggregations: [{ field: 'country', value: { India: 1 } }] },
  } }) + '</script>'
  const detail = '<link rel="canonical" href="' + copy.canonical + '"><script>phApp.ddo = '
    + JSON.stringify({ jobDetail: { status: 200, data: { job: copy.job } } }).replaceAll('<', '\\u003c') + '</script>'
    + (copy.posting ? '<script type="application/ld+json">' + JSON.stringify(copy.posting).replaceAll('<', '\\u003c') + '</script>' : '')
  return run({ fetchText: async url => {
    if (url.endsWith('/search-results')) return listing
    assert.equal(url, sample.nativeDetailURL)
    return detail
  } })
}

for (const sample of fixture.samples) test('current Quest native Bangalore label corroborates its explicit Bengaluru office for ' + sample.listing.reqId, async () => {
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, sample.listing.reqId)
  assert.equal(job.title, sample.listing.title)
  assert.equal(job.country, 'India')
  assert.equal(job.location, 'Bangalore, Karnataka, India')
  assert.equal(job.sourceUrl, sample.nativeDetailURL)
  assert.equal(job.jobDescription, sample.job.ml_Description.trim())
  assert.equal(job.postingDate, sample.listing.reqId === 'P-123744' ? '2026-10-15T00:00:00.000+0000' : '2026-10-08')
})

test('the observed Quest city alias does not change another adapter contract', async () => {
  const [job] = await replay(fixture.samples[1], () => {}, defaultScraper.run)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

for (const [name, change] of [
  ['another short city', sample => { sample.job.multi_location[0].location = 'Pune, Karnataka, India' }],
  ['another short state', sample => { sample.job.multi_location[0].location = 'Bangalore, Maharashtra, India' }],
  ['foreign short country', sample => { sample.job.multi_location[0].location = 'Bangalore, Karnataka, United States' }],
  ['foreign explicit office country', sample => { sample.job.multi_location[0].country = 'United States' }],
  ['different explicit city', sample => { sample.job.multi_location[0].city = 'Pune' }],
  ['different city-state label', sample => { sample.job.multi_location[0].cityState = 'Pune, Karnataka' }],
  ['different city-country label', sample => { sample.job.multi_location[0].cityCountry = 'Pune, India' }],
  ['different native role identity', sample => { sample.job.reqId = 'unrelated-role' }],
  ['different native sequence', sample => { sample.job.jobSeqNo = 'unrelated-sequence' }],
  ['foreign schema country', sample => { sample.posting.jobLocation.address.addressCountry = 'United States' }],
]) test('Quest native city alias still rejects ' + name, async () => {
  const [job] = await replay(fixture.samples[1], change)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
