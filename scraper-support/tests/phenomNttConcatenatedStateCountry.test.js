import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../phenom/engine.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/phenom/ntt-malformed-state-country-20261025.json', import.meta.url), 'utf8'))
const engine = enabled => createPhenomScraper({
  source: 'nttdataservices', companyName: 'NTT Data Services', baseUrl: 'https://careers.nttdata.com',
  searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)),
  nativeConcatenatedStateCountry: enabled,
})
const replay = (sample, change = () => {}, enabled = true) => {
  const copy = structuredClone(sample)
  change(copy)
  const listingHtml = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
    status: 200, totalHits: 1, hits: 1, data: { jobs: [copy.listing],
      aggregations: [{ field: 'country', value: { India: 1 } }] },
  } }) + '</script>'
  const detailHtml = '<link rel="canonical" href="' + copy.canonical + '"><script>phApp.ddo = '
    + JSON.stringify({ jobDetail: { status: 200, data: { job: copy.job } } }).replaceAll('<', '\\u003c') + '</script>'
    + '<script type="application/ld+json">' + JSON.stringify(copy.posting).replaceAll('<', '\\u003c') + '</script>'
  return engine(enabled).run({ fetchText: async url => {
    if (url.endsWith('/search-results')) return listingHtml
    assert.equal(url, sample.canonical)
    return detailHtml
  } })
}

for (const sample of fixture.samples) test('current NTT native redundant concatenation preserves exact India role ' + sample.listing.reqId, async () => {
  assert.equal(sample.job.multi_location[0].stateCountry, 'IndiaIN-TN, ')
  const [job] = await replay(sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, sample.listing.reqId)
  assert.equal(job.title, 'Medical Recs Coding & Transc. Senior Rep')
  assert.equal(job.country, 'India')
  assert.equal(job.location, sample.listing.cityStateCountry)
  assert.equal(job.applyUrl, sample.listing.applyUrl)
  assert.equal(job.jobDescription, sample.job.ml_Description.trim())
  assert.equal(job.postingDate, sample.job.postedDate)
})

test('the captured NTT concatenation requires its explicit adapter contract', async () => {
  const [job] = await replay(fixture.samples[0], () => {}, false)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

for (const [name, change] of [
  ['different explicit office country', sample => { sample.job.multi_location[0].country = 'United States' }],
  ['different explicit office state', sample => { sample.job.multi_location[0].state = 'IN-KA' }],
  ['different full office region', sample => { sample.job.multi_location[0].cityStateCountry = 'Coimbatore, IN-KA, India' }],
  ['different short office region', sample => { sample.job.multi_location[0].location = 'Coimbatore, IN-KA, India' }],
  ['different city-country label', sample => { sample.job.multi_location[0].cityCountry = 'Coimbatore, United States' }],
  ['the malformed state composite duplicated into city-country', sample => { sample.job.multi_location[0].cityCountry = sample.job.multi_location[0].stateCountry }],
  ['different concatenated state', sample => { sample.job.multi_location[0].stateCountry = 'IndiaIN-KA, ' }],
  ['foreign concatenated country', sample => { sample.job.multi_location[0].stateCountry = 'United StatesIN-TN, ' }],
  ['different composite format', sample => { sample.job.multi_location[0].stateCountry = 'IndiaIN-TN, India' }],
  ['conflicting schema country', sample => { sample.posting.jobLocation.address.addressCountry = 'United States' }],
  ['different native role', sample => { sample.job.reqId = 'unrelated-role' }],
  ['different native sequence', sample => { sample.job.jobSeqNo = 'unrelated-sequence' }],
  ['changed application URL', sample => { sample.job.applyUrl = 'https://unrelated.example/apply' }],
]) test('NTT redundant composite recovery rejects ' + name, async () => {
  const [job] = await replay(fixture.samples[0], change)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
