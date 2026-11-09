import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { filterIndiaJobs } from '../utils/indiaLocationFilter.js'
import { buildJobDerivedFields } from '../../src/utils/jobDerivedFields.js'
import * as applied from '../../scraper/appliedcloudcomputing/script.js'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence, isCompleteScraperAttempt } from '../utils/inventoryEvidence.js'
import { buildScraperAttemptDiagnostics, isAuthoritativeEmptyScrape } from '../runner.js'
import { inventoryCleanupOptions, finishScraperProcessing } from '../utils/scraperOutcome.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

const text = readFileSync(new URL('./wave7baScript.test.js', import.meta.url), 'utf8')
const ast = parse(text, { sourceType: 'module', ecmaVersion: 'latest' })
const literal = n => n.type === 'Literal' ? n.value : n.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked
  : n.type === 'ArrayExpression' ? n.elements.map(literal) : n.type === 'ObjectExpression' ? Object.fromEntries(n.properties.map(p => [p.key.name ?? p.key.value, literal(p.value)])) : assert.fail('Unsupported static fixture')
const value = name => literal(ast.body.filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).find(n => n.id.name === name).init)
const original = { board: value('appliedCloudBoardHtml'), listing: value('appliedCloudListingPayload'), details: value('appliedCloudDetailPayloadById'), clock: value('FIXED_SCRAPED_AT') }
const captured = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/appliedcloudcomputing/native-captures/ownership-20261101.json.gz', import.meta.url))))
const sha = value => createHash('sha256').update(value).digest('hex')
const provider = getScraperCatalog().find(p => p.source === applied.SOURCE)
const listingURL = applied.PROVIDER_METADATA.config.discovery.listingApiUrl + '?limit=100&country=in&offset=0'
function input(data) {
  const calls = [], payloads = []
  return { calls, fetchText: async url => { calls.push(url); assert.equal(url, applied.BOARD_URL); return data.board }, fetchJson: async url => {
    calls.push(url)
    const result = url === listingURL ? structuredClone(data.listing) : structuredClone(data.details[new URL(url).pathname.split('/').at(-1)])
    if (!result) throw new Error('Uncaptured optional detail in controlled model')
    payloads.push([result, structuredClone(result)]); return result
  }, unchanged() { for (const [a, b] of payloads) assert.deepEqual(a, b) } }
}
const invoke = (route, data) => route === 'factory' ? applied.createAppliedCloudComputingScraper().run(data) : createCatalogScraper(provider).run(data)
const negatives = [
  ['foreign listing account', d => { d.listing.content[0].company.identifier = 'ControlledForeignAccount' }],
  ['foreign listing ref', d => { d.listing.content[0].ref = d.listing.content[0].ref.replace('/AppliedCloudComputing/', '/ControlledForeignAccount/') }],
  ['aliased listing ID', d => { d.listing.content[0].id = '0' + d.listing.content[0].id }],
  ['foreign supplied detail URLs', d => { const r = d.details[d.listing.content[0].id]; for (const k of ['postingUrl', 'applyUrl']) r[k] = r[k].replace('/AppliedCloudComputing/', '/ControlledForeignAccount/') }],
  ['different detail ID', d => { d.details[d.listing.content[0].id].id = d.listing.content[1].id }],
  ['different supplied detail title', d => { d.details[d.listing.content[0].id].name = d.listing.content[1].name }],
  ['supplied foreign detail company', d => { d.details[d.listing.content[0].id].company = { identifier: 'ControlledForeignAccount' } }],
  ['template-only board', d => { d.board = '<template>' + d.board + '</template>' }],
  ['stylesheet-hidden homepage backlink', d => { d.board = '<style>a { display:none }</style>' + d.board }],
  ['malformed homepage attribute', d => { d.board = d.board.replace('href="https://www.appliedcloudcomputing.com/', '=href="https://www.appliedcloudcomputing.com/') }],
  ['listing/detail country conflict', d => { d.details[d.listing.content[0].id].location.country = 'us' }],
  ['country conflict after India label', d => { for (const r of [d.listing.content[0], d.details[d.listing.content[0].id]]) r.location.fullLocation = 'Pune, India, United States' }],
]
for (const route of ['factory', 'registry']) {
  test('Applied owned ' + route + ' preserves original four-role model without requiring detail.company', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
    const model = structuredClone(original), transport = input(model), reference = input(model)
    assert.ok(Object.values(model.details).every(d => !Object.hasOwn(d, 'company')))
    const before = await runApiPortalScraper({ provider: applied.PROVIDER_METADATA, fetchJson: reference.fetchJson })
    const expected = before.map(j => ({ ...j, department: typeof j.department === 'string' ? j.department : null })).sort((a, b) => a.title.localeCompare(b.title))
    const jobs = await invoke(route, transport)
    for (let i = 0; i < jobs.length; i++) for (const k of Reflect.ownKeys(expected[i])) assert.deepEqual(jobs[i][k], expected[i][k], String(k))
    assert.equal(jobs.length, 4); assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
    assert.equal(readInventoryEvidence(jobs).verifiedAt, original.clock)
    assert.deepEqual(model, original); transport.unchanged(); reference.unchanged()
  })
  for (const [name, mutate] of negatives) test('Applied owned ' + route + ' rejects ' + name + ' before complete authority', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
    const model = structuredClone(original); mutate(model); const transport = input(model), snapshot = structuredClone(model)
    await assert.rejects(invoke(route, transport), error => error.code === 'APPLIED_CLOUD_OWNERSHIP_MISMATCH' && error.incompleteScope === true && error.abortRetries === true)
    if (/board|homepage/.test(name)) assert.deepEqual(transport.calls, [applied.BOARD_URL])
    assert.deepEqual(model, snapshot); transport.unchanged()
  })
}

test('Applied explicit foreign country remains foreign despite Pune or Remote text', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
  for (const label of ['Pune', 'Remote', 'Pune, United States']) {
    const model = structuredClone(original), first = model.listing.content[0], detail = model.details[first.id]
    for (const row of [first, detail]) Object.assign(row.location, { country: 'us', fullLocation: label })
    const transport = input(model), jobs = await invoke('registry', transport)
    assert.equal(jobs.length, 3)
    assert.ok(jobs.every(j => j.jobId !== first.id && j.country === 'India'))
    assert.equal(readInventoryEvidence(jobs).reportedTotal, 4)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 3)
    transport.unchanged()
  }
})

test('Applied native IN Remote remains admitted and every-row unknown country cannot certify zero', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
  const remote = structuredClone(original), first = remote.listing.content[0]
  first.location.fullLocation = 'Remote'; remote.details[first.id].location.fullLocation = 'Remote'
  const jobs = await invoke('factory', input(remote))
  assert.equal(jobs.length, 4); assert.equal(jobs.find(j => j.jobId === first.id).country, 'India')
  const missing = structuredClone(original)
  for (const row of [...missing.listing.content, ...Object.values(missing.details)]) { delete row.location.country; row.location.fullLocation = 'Remote' }
  const unknown = await invoke('registry', input(missing))
  assert.equal(unknown.length, 4)
  assert.ok(unknown.every(job => job.country === null && job.city === null && job.location === null && job.nativeGeographyQualified === false))
  assert.equal(readInventoryEvidence(unknown).status, 'discovery-only')
  assert.equal(readInventoryEvidence(unknown).indiaFacetCount, null)
  assert.deepEqual(inventoryCleanupOptions({ inventoryEvidence: readInventoryEvidence(unknown) }), { replaceExisting: false })
  assert.equal(isAuthoritativeEmptyScrape({ name: provider.source, provider }, unknown), false)
  assert.deepEqual(filterIndiaJobs(unknown), [])
})

test('Applied explicit US cannot become India through an unchanged India location label', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
  const model = structuredClone(original), first = model.listing.content[0]
  first.location.country = 'us'; model.details[first.id].location.country = 'us'
  await assert.rejects(invoke('registry', input(model)), e => e.incompleteScope === true)
})

const packet = label => captured.packets.find(p => p.label === label)
const nativeListing = JSON.parse(packet('listing').bodyUTF8), nativeDetail = JSON.parse(packet('detail').bodyUTF8)
const nativeClock = [...captured.packets].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))[0].completedAt
test('Applied current captured primary qualifies only active native branding and backlink', () => {
  assert.equal(applied.hasVerifiedBoardSignal(packet('official').bodyUTF8), true)
  assert.equal(applied.hasVerifiedBoardSignal('<template>' + packet('official').bodyUTF8 + '</template>'), false)
  for (const p of captured.packets) assert.equal(sha(Buffer.from(p.bodyUTF8)), p.bodySHA256)
})

test('Applied one-role synthetic envelope preserves actual whitespace, slug, oga and August publication', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(nativeClock) })
  const row = nativeListing.content.find(r => r.id === nativeDetail.id)
  // Only this wrapper is synthetic: original full4 packet and native raw fields remain untouched.
  const model = { board: packet('official').bodyUTF8, listing: { ...nativeListing, totalFound: 1, content: [structuredClone(row)] }, details: { [row.id]: structuredClone(nativeDetail) } }
  const transport = input(model), jobs = await invoke('registry', transport)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, row.id); assert.equal(jobs[0].requisitionId, 'REF94E')
  assert.equal(jobs[0].title, row.name)
  assert.equal(jobs[0].sourceUrl, nativeDetail.postingUrl); assert.equal(jobs[0].applyUrl, nativeDetail.applyUrl)
  assert.equal(jobs[0].postingDate, '2026-08-13T07:11:51.063Z')
  assert.equal(jobs[0].jobDescription, nativeDetail.jobAd.sections.jobDescription.text)
  assert.notEqual(jobs[0].sourceScopeComplete, true)
  assert.ok(jobs[0].sourceGlobalJobCount == null && jobs[0].sourceIndiaJobCount == null)
  assert.equal(nativeListing.totalFound, 4); assert.equal(nativeListing.content.length, 4)
  transport.unchanged()
})

test('Applied default registered HTTP replay preserves all4 raw rows and one detail as partial', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(nativeClock) })
  const before = structuredClone(captured), calls = [], served = new Set()
  t.mock.method(globalThis, 'fetch', async (value, init = {}) => {
    const url = String(value); calls.push(url)
    assert.equal(init.method || 'GET', 'GET')
    const p = captured.packets.find(p => p.url === url)
    if (!p) { assert.ok(url.startsWith(applied.PROVIDER_METADATA.config.discovery.listingApiUrl + '/')); throw Object.assign(Error('Uncaptured optional detail in bounded replay'), { abortRetries: true }) }
    served.add(p.label)
    assert.equal(sha(Buffer.from(p.bodyUTF8)), p.bodySHA256)
    const r = new Response(p.bodyUTF8, { status: p.status, headers: { 'content-type': p.contentType } })
    Object.defineProperty(r, 'url', { value: p.responseUrl }); return r
  })
  const jobs = await createCatalogScraper(provider).run()
  assert.deepEqual([...served].sort(), ['detail', 'listing', 'official'])
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map(j => j.jobId).sort(), nativeListing.content.map(j => j.id).sort())
  assert.equal(jobs.filter(j => j.jobDescription).length, 1)
  const full = jobs.find(j => j.jobId === nativeDetail.id)
  assert.equal(full.sourceUrl, nativeDetail.postingUrl); assert.equal(full.applyUrl, nativeDetail.applyUrl)
  assert.equal(full.postingDate, nativeDetail.releasedDate)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only'); assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 4); assert.equal(evidence.verifiedAt, nativeClock)
  const analysis = analyzePublishableJobs(jobs), diagnostics = buildScraperAttemptDiagnostics(jobs, analysis, provider)
  assert.equal(isCompleteScraperAttempt({ success: true, ...diagnostics, completedAt: nativeClock }), false)
  assert.deepEqual(inventoryCleanupOptions(diagnostics), { replaceExisting: false })
  assert.equal(finishScraperProcessing({ success: true, ...diagnostics, completedAt: nativeClock }).partial, true)
  assert.equal(isAuthoritativeEmptyScrape({ name: provider.source, provider }, jobs), false)
  assert.deepEqual(captured, before)
  assert.equal(calls.length, 6)
})

for (const mode of ['missing-listing', 'unknown-listing', 'missing-detail']) test('Applied preserves healthy India and raw unknown partial observation: ' + mode, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
  const model = structuredClone(original), first = model.listing.content[0], detail = model.details[first.id]
  if (mode === 'unknown-listing') first.location.country = 'zz'
  else if (mode === 'missing-listing') delete first.location.country
  else delete detail.location.country
  const transport = input(model), snapshot = structuredClone(model), jobs = await invoke('registry', transport)
  assert.equal(jobs.length, 4)
  assert.equal(jobs.filter(job => job.country === 'India').length, 3)
  const unknown = jobs.find(job => job.jobId === first.id)
  assert.equal(unknown.country, null); assert.equal(unknown.location, null); assert.equal(unknown.city, null); assert.equal(unknown.state, null)
  assert.equal(unknown.nativeGeographyQualified, false)
  assert.deepEqual(unknown.sourceNativeWorkplace, { listing: first.location, detail: detail.location })
  assert.equal(unknown.jobDescription, detail.jobAd.sections.jobDescription.text)
  for (const row of [unknown, normalizeScrapedJob(unknown, provider)]) {
    assert.equal(row.country, null); assert.equal(row.location, null); assert.equal(row.city, null)
    assert.deepEqual(filterIndiaJobs([row]), [])
    const derived = buildJobDerivedFields(row)
    assert.equal(derived.isPublicIndia, false); assert.ok(!derived.publicCityKey)
  }
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only'); assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 4); assert.equal(evidence.indiaFacetCount, null); assert.equal(evidence.verifiedAt, original.clock)
  const diagnostics = buildScraperAttemptDiagnostics(jobs, analyzePublishableJobs(jobs), provider)
  assert.equal(isCompleteScraperAttempt({ success: true, ...diagnostics, completedAt: original.clock }), false)
  assert.deepEqual(inventoryCleanupOptions(diagnostics), { replaceExisting: false })
  assert.equal(finishScraperProcessing({ success: true, ...diagnostics, completedAt: original.clock }).partial, true)
  assert.equal(isAuthoritativeEmptyScrape({ name: provider.source, provider }, jobs), false)
  assert.deepEqual(model, snapshot); transport.unchanged()
})

test('Applied explicit foreign UK location token cannot be silently treated as an India region', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(original.clock) })
  const model = structuredClone(original), first = model.listing.content[0]
  for (const row of [first, model.details[first.id]]) row.location.fullLocation = 'Pune, UK'
  await assert.rejects(invoke('registry', input(model)), error => error.code === 'APPLIED_CLOUD_OWNERSHIP_MISMATCH' && error.incompleteScope === true)
})
