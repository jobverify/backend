import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../scraper-support/phenom/engine.js'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { createNativeDetailRecovery, readNativeDetailReceipt, rememberNativeDetailReceipt } from '../scraper-support/utils/nativeDetailRecovery.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/questglobal/nativeEvidence/city-alias-continuation-20261109.json.gz', import.meta.url))))
const groups = fixture.groups
for (const group of groups) for (const evidence of group.evidence) {
  assert.equal(createHash('sha256').update(readFileSync(new URL('../' + evidence.snapshot, import.meta.url))).digest('hex'), evidence.snapshotSha256)
}
const samples = new Map(fixture.cases.map(row => [row.original.listing.jobId, row]))
const registered = createCatalogScraper(getScraperCatalog().find(row => row.source === 'questglobal'))
const config = { source: 'questglobal', companyName: 'Quest Global', baseUrl: 'https://careers.quest-global.com', searchPath: '/global/en/search-results',
  scraperDir: fileURLToPath(new URL('../scraper/questglobal/', import.meta.url)), nativeBangaloreLocationAlias: true,
  nativeLocalitySuffixFormatting: true, nativeBoundUSStateCodeFormatting: true, nativeReviewedIndiaCityAliases: true,
  nativeCityDashCountryFormatting: true }
const make = extra => createPhenomScraper({ ...config, nativeReviewedIndiaCityGroups: groups, ...extra })
const html = model => '<link rel="canonical" href="' + model.canonical + '"><script>phApp.ddo = '
  + JSON.stringify({ jobDetail: { data: { job: model.structured } } }).replaceAll('<', '\\u003c') + '</script>'
  + '<script type="application/ld+json">' + JSON.stringify(model.posting).replaceAll('<', '\\u003c') + '</script>'
const replay = async (id, { operation = registered.run, live = false, mutate, recovery = false, reads, forbidDetail = false } = {}) => {
  const sample = samples.get(id), original = sample.original, model = structuredClone(original)
  if (mutate) mutate(model)
  const page = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { totalHits: 1, hits: 1,
    data: { jobs: [original.listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
  const [job] = await operation({ nativeDetailRecovery: recovery, detailEnrichmentBudgetMs: 5000, fetchText: async url => {
    if (url === 'https://careers.quest-global.com/global/en/search-results') return page
    assert.equal(url, original.sourceUrl)
    assert.equal(forbidDetail, false, 'A matching receipt must avoid another detail request')
    if (reads) reads.push(url)
    return mutate ? html(model) : live ? sample.live.body : original.html
  } })
  return job
}

for (const id of ['P-123546', 'P-104923', 'P-104924']) for (const live of [false, true]) {
  test('registered Quest ' + id + ' qualifies the fully bound ' + (live ? 'current' : 'retained') + ' city display using primary reviewed evidence', async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
    const job = await replay(id, { live })
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.jobId, id)
    assert.equal(job.sourceUrl, samples.get(id).original.sourceUrl)
    assert.equal(job.country, 'India')
    assert.ok(job.jobDescription.length > 60)
    const evidence = job.sourceNativeCountryEvidence.nativeOfficeCityAliasEvidence
    assert.equal(evidence.format, 'source-reviewed-india-city-name')
    assert.equal(evidence.offices.length, 1)
    assert.deepEqual(evidence.offices[0].group, groups[id === 'P-123546' ? 0 : 1])
    assert.equal(evidence.offices[0].nativeOffice.location, id === 'P-123546' ? 'TVM, Kerala, India' : 'Gurgaon, Haryana, India')
    assert.equal(evidence.offices[0].nativeOffice.city, id === 'P-123546' ? 'Thiruvananthapuram' : 'Gurugram')
    if (id === 'P-104924') assert.equal(samples.get(id).original.structured.ml_Description, null)
  })
}

test('Quest retains the unproved Bengaluru Urban/Bangalore Division administrative conflict', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  for (const live of [false, true]) {
    const job = await replay('P-120607', { live })
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.jobDescription, null)
  }
})

for (const id of ['P-123546', 'P-104923', 'P-104924']) {
  test('default-empty Quest reviewed groups retain the original strict office hold for ' + id, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
    const job = await replay(id, { operation: make({ nativeReviewedIndiaCityGroups: [] }).run })
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.jobDescription, null)
  })
}

const office = model => model.structured.multi_location[0]
for (const [label, mutate] of [
  ['another city', m => { office(m).city = 'Mumbai' }],
  ['another state', m => { office(m).state = 'Haryana' }],
  ['another country', m => { office(m).country = 'United States' }],
  ['an absent country', m => { delete office(m).country }],
  ['an absent state', m => { delete office(m).state }],
  ['an absent city-state', m => { delete office(m).cityState }],
  ['an absent city-country', m => { delete office(m).cityCountry }],
  ['another redundant city-country', m => { office(m).cityCountry = 'Mumbai, India' }],
  ['another redundant state-country', m => { office(m).stateCountry = 'Haryana, India' }],
  ['a different display city', m => { office(m).location = 'Mumbai, Kerala, India' }],
  ['a city substring', m => { office(m).location = 'TVM district, Kerala, India' }],
  ['an extra display component', m => { office(m).location = 'Locality, TVM, Kerala, India' }],
  ['a different display state', m => { office(m).location = 'TVM, Haryana, India' }],
  ['a foreign display country', m => { office(m).location = 'TVM, Kerala, United States' }],
  ['a foreign role', m => { m.structured.reqId = 'foreign-role' }],
  ['a foreign sequence', m => { m.structured.jobSeqNo = 'foreign-sequence' }],
  ['a conflicting JSON-LD title', m => { m.posting.title = 'Another real role' }],
  ['a conflicting JSON-LD country', m => { (Array.isArray(m.posting.jobLocation) ? m.posting.jobLocation[0] : m.posting.jobLocation).address.addressCountry = 'US' }],
  ['a foreign canonical', m => { m.canonical = 'https://foreign.example/job/P-123546/Foreign' }],
]) test('Quest source-reviewed city display rejects ' + label, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const job = await replay('P-123546', { mutate })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
  assert.equal(job.sourceNativeCountryEvidence?.nativeOfficeCityAliasEvidence, undefined)
})

for (const [label, changed] of [
  ['a non-array', {}], ['too many groups', Array(9).fill(groups[0])],
  ['a foreign source', [{ ...groups[0], source: 'foreign' }]],
  ['another country', [{ ...groups[0], country: 'US' }]],
  ['an absent state', [{ ...groups[0], states: [] }]],
  ['an unnormalized state', [{ ...groups[0], states: ['Kerala'] }]],
  ['a comma city phrase', [{ ...groups[0], names: ['tvm, kerala', 'thiruvananthapuram'] }]],
  ['duplicate names', [{ ...groups[0], names: ['tvm', 'tvm'] }]],
  ['missing provenance', [{ ...groups[0], evidence: [] }]],
  ['unbounded provenance', [{ ...groups[0], evidence: Array(5).fill(groups[0].evidence[0]) }]],
  ['foreign URL credentials', [{ ...groups[0], evidence: [{ ...groups[0].evidence[0], url: 'https://user:pass@example.com/proof' }] }]],
  ['an invalid snapshot hash', [{ ...groups[0], evidence: [{ ...groups[0].evidence[0], snapshotSha256: 'missing' }] }]],
]) test('source-reviewed city policy rejects ' + label, () => {
  assert.throws(() => make({ nativeReviewedIndiaCityGroups: changed }), /reviewed India city/i)
})

test('reviewed India city groups require a strict boolean opt-in', () => {
  assert.throws(() => make({ nativeReviewedIndiaCityAliases: 'true' }), /boolean/i)
})

test('unchanged reviewed city evidence is revalidated on a fresh same-policy receipt', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const recovery = createNativeDetailRecovery(), operation = make().run, reads = []
  assert.equal((await replay('P-123546', { operation, recovery, reads })).sourceDetailComplete, true)
  const job = await replay('P-123546', { operation, recovery, forbidDetail: true })
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.sourceDetailFromRecovery, true)
  assert.equal(reads.length, 1)
  assert.deepEqual(job.sourceNativeCountryEvidence.nativeOfficeCityAliasEvidence.offices[0].group, groups[0])
})

for (const [label, extra] of [['disabled opt-in', { nativeReviewedIndiaCityAliases: false }],
  ['removed source groups', { nativeReviewedIndiaCityGroups: [] }],
  ['changed source city group', { nativeReviewedIndiaCityGroups: [{ ...groups[0], names: ['unreviewed', 'thiruvananthapuram'] }] }]]) {
  test('a cached city alias cannot authorize ' + label, async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
    const recovery = createNativeDetailRecovery(), reads = []
    assert.equal((await replay('P-123546', { operation: make().run, recovery, reads })).sourceDetailComplete, true)
    const job = await replay('P-123546', { operation: make(extra).run, recovery, reads })
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.jobDescription, null)
    assert.equal(reads.length, 2)
  })
}

test('a mutated cached native office cannot inherit reviewed alias authority', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const recovery = createNativeDetailRecovery(), operation = make().run
  assert.equal((await replay('P-123546', { operation, recovery })).sourceDetailComplete, true)
  const key = [...recovery.receipts.keys()][0], receipt = readNativeDetailReceipt(recovery, key)
  receipt.payload.structured.multi_location[0].location = 'Mumbai, Kerala, India'
  rememberNativeDetailReceipt(recovery, key, receipt.payload, receipt.fetchedAt)
  const job = await replay('P-123546', { operation, recovery, forbidDetail: true })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})
