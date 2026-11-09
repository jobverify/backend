import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { run } from './script.js'
import { createPhenomScraper, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'
import { createNativeDetailRecovery } from '../../scraper-support/utils/nativeDetailRecovery.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/office-formatting-20261031.json.gz', import.meta.url))))
for (const sample of fixture.samples) assert.equal(createHash('sha256').update(sample.body).digest('hex'), sample.sha256)
const samples = new Map(fixture.samples.map(sample => [sample.listing.reqId, sample]))
const unopted = createPhenomScraper({ source: 'unopted-phenom', companyName: 'Quest Global', baseUrl: 'https://careers.quest-global.com',
  searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)), nativeBangaloreLocationAlias: true })
const replay = async (id, { mutate, operation = run, recovery = false, forbidDetail = false } = {}) => {
  const sample = samples.get(id)
  const listing = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { status: 200, totalHits: 1, hits: 1,
    data: { jobs: [sample.listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
  let body = sample.body, changedJob
  if (mutate) {
    const model = extractPhAppDdo(body)
    changedJob = model.jobDetail.data.job
    mutate(changedJob)
    // Negative controls retain the captured model, canonical URL and JSON-LD.
    // Only their explicitly supplied structured fields are changed.
    body = '<link rel="canonical" href="' + sample.url + '"><script>phApp.ddo = '
      + JSON.stringify(model).replaceAll('<', '\\u003c') + '</script>'
      + [...sample.body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/g)].map(match => match[0]).join('')
  }
  const jobs = await operation({ nativeDetailRecovery: recovery, fetchText: async url => {
    if (url.endsWith('/search-results')) return listing
    assert.equal(url, sample.url)
    assert.equal(forbidDetail, false, 'A fresh same-listing recovery receipt must retain its standardized-office binding')
    return body
  } })
  return { job: jobs[0], changedJob }
}

for (const [id, name] of [
  ['P-124171', 'leading locality before a fully bound city/state/country'],
  ['P-124167', 'leading locality before a fully bound state/country with absent canonical city'],
  ['P-124186', 'US state abbreviations bound to unique same-job standardized offices'],
  ['P-124125', 'secondary locality before Noida in a mixed native office list'],
  ['P-123995', 'Baner before the bound Pune office'],
]) test('current Quest native formatting accepts ' + name, async () => {
  const { job } = await replay(id)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.country, 'India')
  assert.equal(job.jobId, id)
  assert.equal(job.sourceUrl, samples.get(id).url)
})

test('empty canonical city stays absent while country and state remain bound', async () => {
  const { job, changedJob } = await replay('P-124167', { mutate() {} })
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(changedJob.multi_location[0].city, '')
  assert.equal(changedJob.multi_location[0].cityStateCountry, 'Keralam, India')
})

for (const id of ['P-123698', 'P-123663']) test('actual contradictory native title remains rejected for ' + id, async () => {
  const { job } = await replay(id)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

for (const [name, mutate] of [
  ['different typed city', job => { job.multi_location[0].city = 'Mumbai' }],
  ['different typed state', job => { job.multi_location[0].state = 'Gujarat' }],
  ['different typed country', job => { job.multi_location[0].country = 'United States' }],
  ['different canonical city', job => { job.multi_location[0].cityStateCountry = 'Mumbai, Maharashtra, India' }],
  ['different display state', job => { job.multi_location[0].location = 'Yerwada, Pune, Gujarat, India' }],
  ['a foreign-country locality prefix', job => { job.multi_location[0].location = 'United States, Pune, Maharashtra, India' }],
  ['a conflicting compound-country locality prefix', job => { job.multi_location[0].location = 'United States / India, Pune, Maharashtra, India' }],
  ['unrecognized typed country', job => { job.multi_location[0].country = 'unknown' }],
  ['absent explicit typed country', job => { delete job.multi_location[0].country }],
  ['another native role', job => { job.reqId = 'unrelated-role' }],
]) test('Quest locality formatting rejects ' + name, async () => {
  const { job } = await replay('P-124171', { mutate })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

test('an arbitrary equal-length Mumbai label cannot replace the bound Noida city', async () => {
  const { job } = await replay('P-124125', { mutate: job => { job.multi_location[1].location = 'Mumbai, Uttar Pradesh, India' } })
  assert.equal(job.sourceDetailComplete, false)
})

test('empty canonical city is not backfilled to excuse a conflicting supplied city', async () => {
  const { job } = await replay('P-124167', { mutate: job => { job.multi_location[0].city = 'Mumbai' } })
  assert.equal(job.sourceDetailComplete, false)
})

const usOffice = job => job.multi_location.find(office => office.city === 'Greenville')
const usStandard = job => job.standardised_multi_location.find(office => office.standardisedCity === 'Greenville')
for (const [name, mutate] of [
  ['ambiguous standardized office matches', job => { job.standardised_multi_location.push(structuredClone(usStandard(job))) }],
  ['wrong standardized city', job => { usStandard(job).standardisedCity = 'Miami' }],
  ['wrong standardized state', job => { usStandard(job).standardisedState = 'New York' }],
  ['wrong standardized country', job => { usStandard(job).standardisedCountry = 'India' }],
  ['wrong standardized code', job => { usStandard(job).standardisedStateCode = 'NY' }],
  ['unbound standardized coordinates', job => { usStandard(job).latlong.lat = 1; usStandard(job).latitude = '1' }],
  ['contradictory coordinate representations', job => { usStandard(job).latitude = '1' }],
  ['unbound native country', job => { delete usOffice(job).country }],
  ['a conflicting supplied native city', job => { usOffice(job).city = 'Miami' }],
]) test('Quest state-code formatting rejects ' + name, async () => {
  const { job } = await replay('P-124186', { mutate })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

test('the opt-in formatting rules do not change another Phenom adapter', async () => {
  for (const id of ['P-124171', 'P-124167', 'P-124186']) {
    const { job } = await replay(id, { operation: unopted.run })
    assert.equal(job.sourceDetailComplete, false)
  }
})

test('same-run recovery retains the standardized-office evidence used by a verified US abbreviation', async () => {
  const recovery = createNativeDetailRecovery()
  const first = await replay('P-124186', { recovery })
  assert.equal(first.job.sourceDetailComplete, true)
  const second = await replay('P-124186', { recovery, forbidDetail: true })
  assert.equal(second.job.sourceDetailComplete, true)
  assert.equal(second.job.sourceDetailFromRecovery, true)
})
