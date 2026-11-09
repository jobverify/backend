import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { run } from './script.js'
import { createPhenomScraper, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/city-aliases-20261031.json.gz', import.meta.url))))
for (const sample of fixture.samples) assert.equal(createHash('sha256').update(sample.body).digest('hex'), sample.sha256)
const samples = new Map(fixture.samples.map(sample => [sample.listing.reqId, sample]))
const unopted = createPhenomScraper({ source: 'unopted-phenom', companyName: 'Quest Global', baseUrl: 'https://careers.quest-global.com',
  searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)), nativeBangaloreLocationAlias: true,
  nativeLocalitySuffixFormatting: true, nativeBoundUSStateCodeFormatting: true })
const replay = async (id, { mutate, operation = run } = {}) => {
  const sample = samples.get(id)
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

const cases = [
  ['P-124033', 'Belgaum', 'Belagavi', 'Karnataka'],
  ['P-123690', 'Hubli', 'Hubballi', 'Karnataka'],
  ['P-123803', 'Trivandrum', 'Thiruvananthapuram', 'Keralam'],
]
for (const [id, displayed, canonical, state] of cases) {
  test('officially reviewed ' + displayed + '/' + canonical + ' names keep the current role-owned India/state binding', async () => {
    const job = await replay(id)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.country, 'India')
    assert.equal(job.jobId, id)
    assert.equal(job.sourceUrl, samples.get(id).url)
    assert.ok(samples.get(id).body.includes(displayed))
    assert.ok(samples.get(id).body.includes(state))
  })
  const office = job => job.multi_location.find(value => value.location.startsWith(displayed + ','))
  for (const [name, mutate] of [
    ['another typed city', job => { office(job).city = 'Mumbai' }],
    ['another typed state', job => { office(job).state = 'Gujarat' }],
    ['another typed country', job => { office(job).country = 'Canada' }],
    ['absent explicit country', job => { delete office(job).country }],
    ['absent explicit state', job => { delete office(job).state }],
    ['another display city', job => { office(job).location = 'Mumbai, ' + state + ', India' }],
    ['another display state', job => { office(job).location = displayed + ', Gujarat, India' }],
    ['another requisition', job => { job.reqId = 'unrelated-role' }],
  ]) test(displayed + ' alias rejects ' + name, async () => {
    const job = await replay(id, { mutate })
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
  })
}

test('three reviewed city aliases remain disabled for another Phenom adapter', async () => {
  for (const [id] of cases) assert.equal((await replay(id, { operation: unopted.run })).sourceDetailComplete, false)
})

test('TVM abbreviation remains unresolved despite the native India/state fields', async () => {
  const job = await replay('P-123546')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
