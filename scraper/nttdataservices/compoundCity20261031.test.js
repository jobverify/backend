import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { run } from './script.js'
import { createPhenomScraper, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'
import { createNativeDetailRecovery, readNativeDetailReceipt } from '../../scraper-support/utils/nativeDetailRecovery.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/compound-city-20261031.json.gz', import.meta.url))))
for (const sample of [...fixture.samples, ...fixture.preflight]) assert.equal(createHash('sha256').update(sample.body).digest('hex'), sample.sha256)
const other = createPhenomScraper({ source: 'unopted-compound-city', companyName: 'NTT Data Services', baseUrl: 'https://careers.nttdata.com',
  searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)), nativeConcatenatedStateCountry: true })
const replay = async (id, mutate, operation = run, { recovery = false, forbidDetail = false } = {}) => {
  const sample = fixture.samples.find(row => row.reqId === id)
  const listing = { refineSearch: { status: 200, totalHits: 1, hits: 1, data: { jobs: [sample.listing],
    aggregations: [{ field: 'country', value: { India: 1 } }] } } }
  let body = sample.body
  if (mutate) {
    const model = extractPhAppDdo(body)
    mutate(model.jobDetail.data.job)
    body = '<link rel="canonical" href="' + sample.url + '"><script>phApp.ddo = '
      + JSON.stringify(model).replaceAll('<', '\\u003c') + '</script>'
      + [...sample.body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/g)].map(match => match[0]).join('')
  }
  const [job] = await operation({ useWidgetApi: true, nativeDetailRecovery: recovery,
    fetchJson: async url => { assert.equal(url, 'https://careers.nttdata.com/widgets'); return listing },
    fetchText: async url => {
      const preflight = fixture.preflight.find(row => row.url === url)
      if (preflight) return preflight.body
      assert.equal(url, sample.url)
      assert.equal(forbidDetail, false, 'A matching recovery receipt must retain the original literal city for revalidation')
      return body
    },
  })
  return job
}

test('captured NTT literal compound city binds all native city/state/country fields without normalization', async () => {
  const job = await replay('324313')
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, '324313')
  assert.equal(job.country, 'India')
})

for (const [name, mutate] of [
  ['different literal city', job => { job.multi_location[0].city = 'Delhi, India' }],
  ['different native state', job => { job.multi_location[0].state = 'IN-UP' }],
  ['different native country', job => { job.multi_location[0].country = 'United States' }],
  ['absent explicit native country', job => { delete job.multi_location[0].country }],
  ['different city/state label', job => { job.multi_location[0].cityState = 'Bengaluru, India, IN-UP' }],
  ['different city/country label', job => { job.multi_location[0].cityCountry = 'Delhi, India, India' }],
  ['different concatenated state/country label', job => { job.multi_location[0].stateCountry = 'IndiaIN-UP, ' }],
  ['another native requisition', job => { job.reqId = 'unrelated-role' }],
  ['an arbitrary multicity string even when its redundant fields match', job => {
    const office = job.multi_location[0]
    office.city = 'Noida, Bangalore, Hyd'
    office.state = 'IN-UP'
    office.cityState = office.city + ', IN-UP'
    office.cityCountry = office.city + ', India'
    office.location = office.cityStateCountry = office.cityState + ', India'
    office.stateCountry = 'IndiaIN-UP, '
  }],
  ['a shortened city/country field that drops a literal token', job => { job.multi_location[0].cityCountry = 'Bengaluru, India' }],
  ['a slash-separated multicity value inside one city token', job => {
    const office = job.multi_location[0]
    office.city = 'Noida / Bangalore, India'
    office.cityState = office.city + ', IN-KA'
    office.cityCountry = office.city + ', India'
    office.location = office.cityStateCountry = office.cityState + ', India'
  }],
  ['an explicit foreign country inside otherwise matching literal city fields', job => {
    const office = job.multi_location[0]
    office.city = 'Bengaluru, United States'
    office.cityState = 'Bengaluru, United States, IN-KA'
    office.cityCountry = 'Bengaluru, United States, India'
    office.location = office.cityStateCountry = 'Bengaluru, United States, IN-KA, India'
  }],
]) test('NTT compound city rejects ' + name, async () => {
  const job = await replay('324313', mutate)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

for (const separator of [' & ', ' and ', ' or ', ' AND ', ' and/or ', ' + ', ' / ', ' | ', ' ; ', ' \\ ', ' • ', ' · ', '，', '、']) {
  test('NTT compound city rejects a coordinated city list with separator ' + JSON.stringify(separator) + ' even when every office label agrees', async () => {
    const job = await replay('324313', native => {
      const office = native.multi_location[0]
      office.city = 'Noida' + separator + 'Bangalore, India'
      office.cityState = office.city + ', IN-KA'
      office.cityCountry = office.city + ', India'
      office.location = office.cityStateCountry = office.cityState + ', India'
    })
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
  })
}

for (const id of ['359375', '390358']) test('NTT compound-city validation preserves actual title conflict for ' + id, async () => {
  assert.equal((await replay(id)).sourceDetailComplete, false)
})
test('literal compound-city format stays disabled for another adapter', async () => {
  assert.equal((await replay('324313', null, other.run)).sourceDetailComplete, false)
})

test('NTT recovery retains the raw two-component city and revalidates it without another native detail read', async () => {
  const recovery = createNativeDetailRecovery()
  assert.equal((await replay('324313', null, run, { recovery })).sourceDetailComplete, true)
  const receipt = readNativeDetailReceipt(recovery, [...recovery.receipts.keys()][0])
  assert.equal(receipt.payload.structured.multi_location[0].city, 'Bengaluru, India')
  const reused = await replay('324313', null, run, { recovery, forbidDetail: true })
  assert.equal(reused.sourceDetailComplete, true)
  assert.equal(reused.sourceDetailFromRecovery, true)
  assert.equal(receipt.payload.structured.multi_location[0].city, 'Bengaluru, India')
})
