import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { createPhenomScraper } from '../scraper-support/phenom/engine.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../scraper/snowflake/nativeEvidence/widget-overlap-20261109.json.gz', import.meta.url))))
for (const packet of [...fixture.single.packets, ...fixture.paged.packets]) {
  assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
}
const provider = getScraperCatalog().find(row => row.source === 'snowflake')
const registered = createCatalogScraper(provider)
const nativeResponse = () => JSON.parse(fixture.single.packets[1].body)
const rowCount = response => response.refineSearch.data.jobs.length
const archivedPages = new Map(fixture.paged.packets.slice(1).map(packet => [JSON.parse(packet.requestBody).from, JSON.parse(packet.body)]))
const details = new Map(fixture.single.packets.slice(2).map(packet => [packet.url, packet.body]))

const replay = async ({ operation = registered.run, responseFor, options = {}, mutateDetail, defaultTransport = false, t } = {}) => {
  const requests = []
  const text = async url => {
    if (url === fixture.single.packets[0].url || url === fixture.single.packets[0].url + '?from=1') return fixture.single.packets[0].body
    assert.ok(details.has(String(url)), 'Only the exact captured official detail URLs may be read: ' + url)
    return mutateDetail ? mutateDetail(details.get(String(url)), String(url)) : details.get(String(url))
  }
  const json = async (url, init) => {
    assert.equal(String(url), 'https://careers.snowflake.com/widgets')
    assert.equal(init.method, 'POST')
    const body = JSON.parse(init.body)
    requests.push(body)
    const response = responseFor ? responseFor(body) : body.size === 500 ? nativeResponse() : structuredClone(archivedPages.get(body.from))
    assert.ok(response, 'A captured offset response must exist')
    return response
  }
  if (defaultTransport) t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const body = String(url).endsWith('/widgets') ? JSON.stringify(await json(url, init)) : await text(String(url))
    return new Response(body, { status: 200, headers: { 'content-type': String(url).endsWith('/widgets') ? 'application/json' : 'text/html' } })
  })
  else t.mock.method(globalThis, 'fetch', () => assert.fail('Uncaptured network request'))
  const jobs = await operation({ nativeDetailRecovery: false, detailEnrichmentBudgetMs: 15000,
    ...(defaultTransport ? {} : { fetchText: text, fetchJson: json }), ...options })
  return { jobs, requests, evidence: readInventoryEvidence(jobs) }
}

test('the original Snowflake 100-row offsets retain the one-role overlap and incomplete inventory', async t => {
  const archived = createPhenomScraper({ source: 'snowflake', companyName: 'Snowflake', baseUrl: 'https://careers.snowflake.com', searchPath: '/us/en/search-results', nativeUnspecifiedState: true })
  const { jobs, evidence, requests } = await replay({ t, operation: archived.run })
  const raw = [...archivedPages.values()].flatMap(page => page.refineSearch.data.jobs)
  assert.equal(raw.length, 380)
  assert.equal(new Set(raw.map(row => row.jobSeqNo || row.jobId)).size, 379)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(jobs.length, 11)
  assert.equal(requests.length, 4)
})

test('registered Snowflake requests the bounded native 500-row page and completes all eleven captured details', async t => {
  const { jobs, evidence, requests } = await replay({ t })
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 380)
  assert.equal(evidence.indiaFacetCount, 11)
  assert.equal(evidence.pagesFetched, 1)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].size, 500)
  assert.equal(requests[0].from, 0)
  assert.equal(jobs.length, 11)
  assert.deepEqual(jobs.map(row => row.jobId).sort(), fixture.single.jobs.map(row => row.jobId).sort())
  assert.ok(jobs.every(row => row.sourceDetailComplete === true && row.jobDescription.length > 500 && row.country === 'India'))
})

test('registered Snowflake default HTTP transport uses the same bounded native widget route', async t => {
  const { jobs, evidence, requests } = await replay({ t, defaultTransport: true })
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(requests[0].size, 500)
  assert.ok(jobs.length === 11 && jobs.every(row => row.sourceDetailComplete === true))
})

test('Snowflake preserves the explicit HTML lane with an injected HTML fetcher', async t => {
  const page = fixture.single.packets[0].body
  t.mock.method(globalThis, 'fetch', () => assert.fail('The HTML lane cannot implicitly switch to the widget transport'))
  await assert.rejects(registered.run({ fetchText: async () => page, maxPages: 1, nativeDetailRecovery: false }), /PHENOM_INCOMPLETE_SNAPSHOT/)
})

for (const [name, responseFor] of [
  ['a missing native row', () => { const p = nativeResponse(); p.refineSearch.data.jobs.pop(); return p }],
  ['a duplicate native row', () => { const p = nativeResponse(); p.refineSearch.data.jobs[0] = structuredClone(p.refineSearch.data.jobs[1]); return p }],
  ['an unaccounted target-country facet', () => { const p = nativeResponse(); const a = p.refineSearch.data.aggregations.find(row => row.field === 'country'); a.value.India += 1; return p }],
]) test('Snowflake retains an incomplete inventory for ' + name, async t => {
  const { evidence } = await replay({ t, responseFor, options: { maxPages: 1 } })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.status, 'discovery-only')
})

test('Snowflake rejects a native total smaller than its unique role set', async t => {
  await assert.rejects(replay({ t, responseFor: () => { const p = nativeResponse(); p.refineSearch.totalHits--; return p } }), /PHENOM_INCOMPLETE_SNAPSHOT/)
})

for (const options of [{ maxJobs: 5 }, { initialFrom: 1 }, { maxPages: 1 }]) test('Snowflake does not certify capped or incomplete larger inventories: ' + JSON.stringify(options), async t => {
  const { evidence } = await replay({ t, options, responseFor: body => {
    const p = nativeResponse()
    if (options.maxPages) { p.refineSearch.totalHits = 600; p.refineSearch.hits = rowCount(p) }
    return p
  } })
  assert.equal(evidence.listingComplete, false)
})

test('Snowflake follows an actual native response cap without skipping offsets', async t => {
  const { requests, evidence } = await replay({ t, responseFor: body => {
    const p = nativeResponse()
    p.refineSearch.data.jobs = p.refineSearch.data.jobs.slice(body.from, body.from + 100)
    p.refineSearch.hits = rowCount(p)
    return p
  } })
  assert.equal(evidence.status, 'complete-inventory')
  assert.deepEqual(requests.map(row => [row.size, row.from]), [[500, 0], [500, 100], [500, 200], [500, 300]])
})

test('Snowflake still holds the retained overlapping offsets if the native endpoint caps its response', async t => {
  const { evidence, requests } = await replay({ t, responseFor: body => structuredClone(archivedPages.get(body.from)) })
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.ok(requests.every(row => row.size === 500))
})

test('Snowflake reconciles every role across pages if the native inventory grows beyond five hundred', async t => {
  const all = nativeResponse().refineSearch.data.jobs
  const foreign = all.find(row => row.country === 'United States' && row.multi_location.every(value => !value.endsWith(', India')))
  for (let i = 0; i < 150; i++) all.push({ ...structuredClone(foreign), jobId: 'synthetic-foreign-' + i,
    reqId: 'synthetic-foreign-' + i, jobSeqNo: 'synthetic-foreign-sequence-' + i })
  const { evidence, jobs, requests } = await replay({ t, responseFor: body => {
    const p = nativeResponse()
    p.refineSearch.totalHits = all.length
    p.refineSearch.data.jobs = all.slice(body.from, body.from + body.size)
    p.refineSearch.hits = rowCount(p)
    return p
  } })
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 530)
  assert.equal(jobs.length, 11)
  assert.deepEqual(requests.map(row => [row.size, row.from]), [[500, 0], [500, 500]])
})

test('Snowflake keeps detail failures separate from a complete native role inventory', async t => {
  let changed = false
  const { jobs, evidence } = await replay({ t, mutateDetail: body => {
    if (changed) return body
    changed = true
    // Change only the retained canonical role identity; the listing inventory stays untouched.
    return body.replace(/(<link[^>]+rel="canonical"[^>]+href=")[^"]+/, '$1https://careers.snowflake.com/us/en/job/foreign/Foreign')
  } })
  assert.equal(evidence.listingComplete, true)
  assert.ok(jobs.some(row => row.sourceDetailComplete === false && row.jobDescription === null))
})
