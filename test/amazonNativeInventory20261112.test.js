import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { createAmazonScraper } from '../scraper/amazon/script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/amazon-native-inventory-20261112.json.gz', import.meta.url))))
const sap = fixture.pages[0].jobs.find(row => row.id_icims === '10603016')
const records = [sap, ...fixture.pages[0].jobs.filter(row => row.id_icims !== sap.id_icims)].slice(0, 3)
const payload = (rows, offset, limit) => {
  const page = structuredClone(fixture.pages[0])
  const request = JSON.parse(page.job_posting_search_request)
  request.jobPostingSearchRequest.start = String(offset)
  request.jobPostingSearchRequest.size = String(limit)
  page.job_posting_search_request = JSON.stringify(request)
  page.hits = rows.length
  page.jobs = structuredClone(rows.slice(offset, offset + limit))
  return page
}
const replay = (options = {}) => {
  const rows = structuredClone(options.rows || records)
  const reads = [], details = []
  let openings = 0
  const fetchJson = async (url) => {
    reads.push(url)
    const parsed = new URL(url)
    const offset = Number(parsed.searchParams.get('offset'))
    const limit = Number(parsed.searchParams.get('result_limit'))
    if (offset === 0) openings++
    const page = payload(rows, offset, limit)
    options.mutate?.(page, { offset, limit, closing: openings > 1 })
    return page
  }
  const fetchText = async (url) => {
    if (url.includes('/en/jobs/')) { details.push(url); throw new Error('No separate detail body is available in this controlled replay') }
    if (url === fixture.client.url) return options.client ?? fixture.client.body
    if (url.startsWith('https://www.amazon.jobs/en/search?')) return options.shell ?? fixture.shell.body
    throw new Error('Unadvertised first-party read: ' + url)
  }
  return { reads, details, rows, run: extra => createAmazonScraper({ pageSize: options.pageSize }).run({ fetchJson, fetchText, ...extra }) }
}

test('Amazon uses100-row pages and retains all native qualification sections without serial detail requests', async () => {
  const source = replay()
  const jobs = await source.run()
  assert.equal(new URL(source.reads[0]).searchParams.get('result_limit'), '100')
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].experienceRequired, '10+ years')
  assert.match(jobs[0].minimumQualification, /10\+ years implementing SAP S\/4HANA SD/)
  assert.match(jobs[0].preferredQualification, /Experience in SAP S\/4HANA/)
  assert.match(jobs[0].jobDescription, /10\+ years implementing SAP S\/4HANA SD/)
  assert.match(jobs[0].jobDescription, /Experience in SAP S\/4HANA/)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  assert.equal(source.details.length, 0)
})

test('Amazon completes only the reconciled India inventory with official search/client binding and a full closing pass', async () => {
  const source = replay({ pageSize: 2 })
  const jobs = await source.run()
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'complete-inventory')
  assert.equal(inventory.reportedTotal, 3)
  assert.equal(inventory.indiaFacetCount, 3)
  assert.equal(inventory.listingComplete, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), false)
  assert.ok(jobs.every(job => job.sourceListingComplete === true && job.sourceScopeComplete === true))
  const offsets = source.reads.map(url => Number(new URL(url).searchParams.get('offset')))
  assert.deepEqual(offsets, [0, 2, 3, 0, 2, 3])
})

test('Amazon retains the real HVH India role and its explicit optional null preferred qualifications', async () => {
  const hvh = fixture.pages.flatMap(page => page.jobs).find(row => row.id_icims === 'SF260123206')
  const jobs = await replay({ rows: [hvh] }).run()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'SF260123206')
  assert.equal(jobs[0].applyUrl, 'https://hvr-amazon.my.site.com/JobDetails?reqid=a0Rar000002XkAzEAK&isapply=1')
  assert.equal(jobs[0].preferredQualification, null)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

for (const [label, mutate] of [
  ['changed closing total', (page, state) => { if (state.closing) page.hits++ }],
  ['changed middle role criteria', (page, state) => { if (state.closing && page.jobs[1]) page.jobs[1].basic_qualifications += '<p>A newly added mandatory qualification.</p>' }],
  ['changed middle native identity', (page, state) => { if (state.closing && page.jobs[1]) page.jobs[1].id += '-changed' }],
  ['wrong echoed country', page => { const echo = JSON.parse(page.job_posting_search_request); echo.jobPostingSearchRequest.filterFacets[0].values[0].name = 'USA'; page.job_posting_search_request = JSON.stringify(echo) }],
  ['additional native business filter', page => { const echo = JSON.parse(page.job_posting_search_request); echo.jobPostingSearchRequest.filterFacets.push({ name: 'businessCategory', values: [{ name: 'aws' }] }); page.job_posting_search_request = JSON.stringify(echo) }],
  ['unexhausted boundary', (page, state) => { if (state.offset === 3) page.jobs = [structuredClone(records[0])] }],
]) test('Amazon holds cleanup for ' + label + ' without dropping the known India roles', async () => {
  const jobs = await replay({ mutate }).run()
  assert.equal(jobs.length, 3)
  assert.notEqual(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

for (const [label, shell, client] of [
  ['missing official branding', '<html>Unbound job search</html>', undefined],
  ['foreign search bundle', fixture.shell.body.replaceAll('//static.amazon.jobs/assets/bundles/search/', '//example.invalid/assets/bundles/search/'), undefined],
  ['changed client endpoint', undefined, fixture.client.body.replaceAll('/search.json?', '/unknown-search?')],
]) test('Amazon keeps native jobs incomplete for ' + label, async () => {
  const jobs = await replay({ shell, client }).run()
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Amazon unknown native country remains an explicit incomplete source, never certified zero', async () => {
  const rows = structuredClone(records)
  rows[0].country_code = null
  const jobs = await replay({ rows }).run()
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Amazon does not replace an empty native description with description_short', async () => {
  const rows = structuredClone(records)
  rows[0].description = ''
  const jobs = await replay({ rows }).run({ now: '2020-01-01' })
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const cap of [{ maxPages: 1 }, { maxJobs: 1 }]) test('Amazon preserves explicit cap ' + JSON.stringify(cap), async () => {
  const jobs = await replay({ pageSize: 2 }).run(cap)
  assert.equal(jobs.length, cap.maxJobs || 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Amazon proves an actual empty India query only after binding and closing checks', async () => {
  const source = replay({ rows: [] })
  const jobs = await source.run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

test('Amazon missing native total stays unknown on an empty response', async () => {
  const jobs = await replay({ rows: [], mutate: page => { delete page.hits } }).run()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Amazon full current native response replay preserves all2113 IDs and full criteria', async () => {
  const rows = fixture.pages.flatMap(page => page.jobs)
  const jobs = await replay({ rows }).run()
  assert.equal(jobs.length, 2113)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 2113)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(extractionDetailHealth(jobs).complete, true)
})

test('Amazon caller cancellation during the new source-binding read preserves the exact reason', async () => {
  const controller = new AbortController()
  const reason = new Error('cancel Amazon public scope proof')
  const source = replay()
  await assert.rejects(source.run({ signal: controller.signal, fetchText: async () => {
    controller.abort(reason)
    return new Promise(() => {})
  } }), error => error === reason)
})

test('Amazon scope-check budget retains the enumerated roles and prohibits cleanup', async () => {
  const source = replay()
  const jobs = await source.run({ collectionBudgetMs: 20, fetchText: () => new Promise(() => {}) })
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /budget-exhausted/)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Amazon unknown nested native country prevents full-source certification', async () => {
  const rows = structuredClone(records)
  const location = JSON.parse(rows[0].locations[0])
  delete location.normalizedCountryCode
  rows[0].locations[0] = JSON.stringify(location)
  const jobs = await replay({ rows }).run()
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Amazon mismatched native detail URLs prevent full-source certification', async () => {
  const rows = structuredClone(records)
  rows[0].job_path = rows[1].job_path
  const jobs = await replay({ rows }).run()
  assert.equal(jobs.length, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})
