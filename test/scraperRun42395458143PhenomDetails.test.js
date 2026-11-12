import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../scraper-support/phenom/engine.js'
import { createNativeDetailRecovery, readNativeDetailReceipt, rememberNativeDetailReceipt } from '../scraper-support/utils/nativeDetailRecovery.js'

const { cases, observedAt: detailCaptureObservedAt } = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/scraperRun42395458143PhenomDetails.json.gz', import.meta.url))))
// The immutable capture's expectedRepaired records the original November8 policy.
// Only the actual Quest source now additionally binds these three native city
// displays to its reviewed government publications (see continuation regressions).
const continuedQuestOfficeRoles = new Set(['P-123546', 'P-104923', 'P-104924'])
const wrappedSources = new Set(['bcg', 'collinsaerospace', 'juniper', 'nttdataservices'])
const replay = async (fixture, html = fixture.html, override, options = {}) => {
  const scraper = override || (wrappedSources.has(fixture.source)
    ? createPhenomScraper({ ...fixture, scraperDir: fileURLToPath(new URL('../scraper-support/phenom', import.meta.url)), ...fixture.options, nativeBoundModelTitlePreference: true, nativeReviewedTitleBindings: capturedTitleBindingsFor(fixture.source) })
    : await import(new URL('../' + fixture.modulePath, import.meta.url)))
  const page = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { totalHits: 1, hits: 1,
    data: { jobs: [fixture.listing], aggregations: [{ field: 'country', value: { [fixture.listing.country]: 1 } }] } } }) + '</script>'
  return scraper.run({ maxPages: 1, maxJobs: 1, detailEnrichmentBudgetMs: 5000, ...options, fetchText: async url => {
    if (url.includes('/search-results')) return page
    assert.equal(url, fixture.sourceUrl)
    options.observeDetailRequest?.(url)
    return html
  } })
}

for (const fixture of cases) test('captured ' + fixture.source + ' role ' + fixture.listing.jobId + ' retains verified native detail boundaries', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const [job] = await replay(fixture)
  assert.ok(job)
  const continuedQuestOffice = fixture.source === 'questglobal' && continuedQuestOfficeRoles.has(fixture.listing.jobId)
  const continuedRoyalOffice = fixture.source === 'royalenfield' && fixture.listing.jobId === 'P-101048'
  assert.equal(job.sourceDetailComplete, fixture.expectedRepaired || continuedQuestOffice || continuedRoyalOffice)
  assert.equal(job.jobId, fixture.listing.jobId)
  assert.equal(job.country, 'India')
  if (fixture.source === 'opentext') {
    assert.equal(job.sourceNativeDetailEvidence.nativeTitle, 'Premium Support Specialist ( SMAX)')
    assert.equal(job.sourceNativeDetailEvidence.jsonLdTitle, 'Premium Support Developer ( SMAX)')
  }
  if (fixture.expectedRepaired) assert.ok(job.jobDescription.length > 100)
  else if (continuedQuestOffice || continuedRoyalOffice) assert.ok(job.jobDescription.length > 60)
  else assert.equal(job.jobDescription, null)
})

function capturedTitleBindingsFor(source) {
  const normalized = value => String(value || '').replace(/\s+/g, ' ').trim()
  return cases.filter(row => row.source === source && row.posting?.title
    && normalized(row.posting.title) !== normalized(row.structured?.title)).map(row => ({
    source: row.source, jobId: row.listing.jobId, reqId: row.structured.reqId, jobSeqNo: row.structured.jobSeqNo,
    listingTitle: row.listing.title, nativeTitle: row.structured.title, jsonLdTitle: row.posting.title,
    canonical: row.canonical, fixture: 'test/test-data/scraperRun42395458143PhenomDetails.json.gz', observedAt: detailCaptureObservedAt,
    nativeModelSha256: createHash('sha256').update(JSON.stringify(row.structured)).digest('hex'),
  }))
}

const titleFixture = cases.find(row => row.source === 'opentext')
const detailHtml = model => '<link rel="canonical" href="' + model.canonical + '">'
  + '<script>phApp.ddo = ' + JSON.stringify({ jobDetail: { data: { job: model.structured } } }) + '</script>'
  + '<script type="application/ld+json">' + JSON.stringify(model.posting) + '</script>'
for (const [label, mutate] of [
  ['foreign native role', m => { m.structured.jobId = 'foreign-role' }],
  ['foreign native requisition', m => { m.structured.reqId = 'foreign-role' }],
  ['foreign native sequence', m => { m.structured.jobSeqNo = 'foreign-sequence' }],
  ['foreign JSON-LD role', m => { m.posting.identifier.value = 'foreign-role' }],
  ['foreign JSON-LD country', m => { m.posting.jobLocation.address.addressCountry = 'US' }],
  ['foreign native country', m => { m.structured.country = 'US' }],
  ['foreign canonical', m => { m.canonical = m.canonical.replace('careers.opentext.com', 'different.example') }],
  ['oversized alternate title', m => { m.posting.title = 'x'.repeat(513) }],
  ['absent native sequence', m => { delete m.structured.jobSeqNo }],
  ['absent native full description', m => { delete m.structured.ml_Description }],
]) test('stale JSON-LD title reconciliation rejects ' + label, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const model = structuredClone(titleFixture)
  mutate(model)
  const [job] = await replay(titleFixture, detailHtml(model))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [source, mutateCases] of [
  ['royalenfield', [
    ['different postal field', o => { o.postalCode = '111111' }],
    ['absent postal field', o => { delete o.postalCode }],
    ['different typed state', o => { o.state = 'Maharashtra' }],
    ['foreign typed office country', o => { o.country = 'United States' }],
  ]],
  ['snowflake', [
    ['a real contradictory state', o => { o.state = 'Maharashtra' }],
    ['an unknown state marker', o => { o.state = 'Unverified State' }],
    ['foreign typed office country', o => { o.country = 'United States' }],
    ['different redundant city country', o => { o.cityCountry = 'Mumbai, India' }],
  ]],
]) for (const [label, mutate] of mutateCases) test(source + ' native office format rejects ' + label, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const fixture = cases.find(c => c.source === source)
  const model = structuredClone(fixture)
  mutate(model.structured.multi_location[0])
  const [job] = await replay(fixture, detailHtml(model))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

for (const [label, body] of [
  ['application prompt', '<p>Apply now</p>'],
  ['section label', '<p>Job Description</p>'],
  ['inactive full body', '<p>Apply now</p><template>' + titleFixture.structured.ml_Description + '</template>'],
  ['markup-padded prompt', '<p>Apply now</p><!--' + 'padding '.repeat(100) + '-->'],
  ['repeated navigation prompt', '<p>' + 'Apply now '.repeat(40) + '</p>'],
]) test('stale-title native preference rejects ' + label + ' as a full body', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const model = structuredClone(titleFixture)
  model.structured.ml_Description = body
  const [job] = await replay(titleFixture, detailHtml(model))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
  assert.equal(job.sourceNativeDetailEvidence, undefined)
})

for (const optIn of [undefined, false, 'true']) test('stale-title native preference requires explicit boolean opt-in: ' + String(optIn), async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const strict = createPhenomScraper({ ...titleFixture, ...titleFixture.options,
    source: 'unopted-stale-title', scraperDir: fileURLToPath(new URL('../scraper-support/phenom', import.meta.url)),
    nativeBoundModelTitlePreference: optIn })
  const [job] = await replay(titleFixture, titleFixture.html, strict)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(job.jobDescription, null)
  assert.equal(job.sourceNativeDetailEvidence, undefined)
})

test('a cached native title preference cannot override a disabled source policy', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const recovery = createNativeDetailRecovery()
  const make = enabled => createPhenomScraper({ ...titleFixture, ...titleFixture.options,
    source: 'opentext', nativeReviewedTitleBindings: capturedTitleBindingsFor('opentext'), scraperDir: fileURLToPath(new URL('../scraper-support/phenom', import.meta.url)),
    nativeBoundModelTitlePreference: enabled })
  const [warm] = await replay(titleFixture, titleFixture.html, make(true), { nativeDetailRecovery: recovery })
  assert.equal(warm.sourceDetailComplete, true)
  assert.equal(recovery.receipts.size, 1)
  const [strict] = await replay(titleFixture, titleFixture.html, make(false), { nativeDetailRecovery: recovery })
  assert.equal(strict.sourceDetailComplete, false)
  assert.equal(strict.sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(strict.jobDescription, null)
  assert.equal(strict.sourceNativeDetailEvidence, undefined)
})

for (const fixture of cases.filter(row => capturedTitleBindingsFor(row.source).some(pair => pair.jobId === row.listing.jobId))) {
  test('reviewed ' + fixture.source + ' role ' + fixture.listing.jobId + ' rejects an unreviewed alternate title', async t => {
    t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
    const model = structuredClone(fixture)
    model.posting.title = 'Unreviewed alternate role for ' + fixture.source
    const [job] = await replay(fixture, detailHtml(model))
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceNativeDetailEvidence, undefined)
  })
}

for (const [label, mutate] of [
  ['unreviewed native/listing title pair', model => { model.structured.title = 'Unreviewed native title'; model.listing.title = model.structured.title }],
  ['unreviewed canonical slug', model => { model.canonical += '-Unreviewed' }],
]) test('reviewed role rejects ' + label, async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const model = structuredClone(titleFixture)
  mutate(model)
  model.sourceUrl = createPhenomScraper({ ...model, ...model.options,
    scraperDir: fileURLToPath(new URL('../scraper-support/phenom', import.meta.url)) }).buildJobDetailUrl(model.listing)
  const [job] = await replay(model, detailHtml(model))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(job.jobDescription, null)
})

test('a source preference boolean alone cannot authorize an unreviewed title pairing', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const scraper = createPhenomScraper({ ...titleFixture, ...titleFixture.options,
    scraperDir: fileURLToPath(new URL('../scraper-support/phenom', import.meta.url)),
    nativeBoundModelTitlePreference: true })
  const [job] = await replay(titleFixture, titleFixture.html, scraper)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

test('a warmed receipt cannot authorize a changed unreviewed alternate title', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const recovery = createNativeDetailRecovery()
  const scraper = createPhenomScraper({ ...titleFixture, ...titleFixture.options,
    scraperDir: fileURLToPath(new URL('../scraper-support/phenom', import.meta.url)),
    nativeBoundModelTitlePreference: true, nativeReviewedTitleBindings: capturedTitleBindingsFor('opentext') })
  const [warm] = await replay(titleFixture, titleFixture.html, scraper, { nativeDetailRecovery: recovery })
  assert.equal(warm.sourceDetailComplete, true)
  const key = [...recovery.receipts.keys()][0], receipt = readNativeDetailReceipt(recovery, key)
  receipt.payload.posting.title = 'Unreviewed cached alternate role'
  rememberNativeDetailReceipt(recovery, key, receipt.payload, receipt.fetchedAt)
  const [job] = await replay(titleFixture, titleFixture.html, scraper, { nativeDetailRecovery: recovery })
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

test('reviewed-title policy changes invalidate old receipt identity', async t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const recovery = createNativeDetailRecovery()
  const make = bindings => createPhenomScraper({ ...titleFixture, ...titleFixture.options,
    scraperDir: fileURLToPath(new URL('../scraper-support/phenom', import.meta.url)),
    nativeBoundModelTitlePreference: true, nativeReviewedTitleBindings: bindings })
  let detailReads = 0
  const options = { nativeDetailRecovery: recovery, observeDetailRequest: () => { detailReads++ } }
  const [warm] = await replay(titleFixture, titleFixture.html, make(capturedTitleBindingsFor('opentext')), options)
  assert.equal(warm.sourceDetailComplete, true)
  const model = structuredClone(titleFixture)
  model.posting.title = 'Unreviewed new title after policy change'
  const [job] = await replay(titleFixture, detailHtml(model), make([]), options)
  assert.equal(detailReads, 2)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})
