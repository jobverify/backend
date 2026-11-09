import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { run } from './script.js'
import { createPhenomScraper, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/country-before-postcode-20261031.json.gz', import.meta.url))))
for (const sample of fixture.samples) assert.equal(createHash('sha256').update(sample.body).digest('hex'), sample.sha256)
const other = createPhenomScraper({ source: 'unopted-postal', companyName: 'Allianz', baseUrl: 'https://careers.allianz.com',
  searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)) })
const replay = async (id, mutate, operation = run) => {
  const sample = fixture.samples.find(row => row.reqId === id)
  const listing = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { status: 200, totalHits: 1, hits: 1,
    data: { jobs: [sample.listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
  let body = sample.body
  if (mutate) {
    const model = extractPhAppDdo(body)
    mutate(model.jobDetail.data.job)
    body = '<link rel="canonical" href="' + sample.url + '"><script>phApp.ddo = '
      + JSON.stringify(model).replaceAll('<', '\\u003c') + '</script>'
      + [...sample.body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/g)].map(match => match[0]).join('')
  }
  const [job] = await operation({ nativeDetailRecovery: false, fetchText: async url => {
    if (url.endsWith('/search-results')) return listing
    assert.equal(url, sample.url)
    return body
  } })
  return job
}

for (const id of ['97895', '105457']) test('captured Allianz country-before-postal label keeps exact native city/state/country/postal binding for ' + id, async () => {
  const job = await replay(id)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.country, 'India')
  assert.equal(job.jobId, id)
})

const office = job => job.multi_location.find(row => row.location.endsWith(', 695581'))
for (const [name, mutate] of [
  ['wrong typed postal code', job => { office(job).postalCode = '000000' }],
  ['wrong display postal code', job => { office(job).location = 'Trivandrum, Kerala, India, 000000' }],
  ['foreign display country', job => { office(job).location = 'Trivandrum, Kerala, United States, 695581' }],
  ['wrong typed country', job => { office(job).country = 'United States' }],
  ['absent explicit country', job => { delete office(job).country }],
  ['wrong typed city', job => { office(job).city = 'Mumbai' }],
  ['wrong typed state', job => { office(job).state = 'Maharashtra' }],
  ...['United States', 'Maharashtra'].map(extra => ['extra ' + extra + ' in agreeing full and postal labels', job => {
    // The typed city/state stay Trivandrum/Kerala. Agreement between redundant
    // display labels cannot bind an additional country or region to that office.
    const value = office(job)
    value.cityStateCountry = 'Trivandrum, Kerala, ' + extra + ', India'
    value.location = value.cityStateCountry + ', 695581'
    value.cityStatePostalCode = 'Trivandrum, Kerala, ' + extra + ', 695581'
  }]),
  ['different postal alias city', job => { office(job).cityStatePostalCode = 'Pune, Kerala, 695581' }],
  ['different postal alias code', job => { office(job).cityStatePostalCode = 'Trivandrum, Kerala, 000000' }],
  ['empty supplied postal alias', job => { office(job).cityStatePostalCode = '' }],
  ['conflicting supplied zip alias', job => { office(job).cityStateZipCode = 'Trivandrum, Kerala, 000000' }],
  ['another native requisition', job => { job.reqId = 'unrelated-role' }],
]) test('Allianz postal-country representation rejects ' + name, async () => {
  const job = await replay('97895', mutate)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

test('Allianz postal formatting cannot erase an actual schema title conflict', async () => {
  assert.equal((await replay('104376')).sourceDetailComplete, false)
})
test('Allianz postal formatting cannot fill an actual missing JSON-LD country', async () => {
  assert.equal((await replay('108589')).sourceDetailComplete, false)
})
test('country-before-postal formatting stays disabled for another adapter', async () => {
  assert.equal((await replay('97895', null, other.run)).sourceDetailComplete, false)
})
