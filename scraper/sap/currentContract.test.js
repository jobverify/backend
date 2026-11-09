import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { buildSearchUrl, extractSearchResults, extractJobDetail, run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const nativeSearch = await fs.readFile(new URL('./fixtures/current-india-search.html', import.meta.url), 'utf8')
const nativeDetail = await fs.readFile(new URL('./fixtures/current-job-detail.html', import.meta.url), 'utf8')
const origin = 'https://careers.sap.com'
const row = (id, title = 'Senior Developer', location = 'Bangalore, IN, 560103') => '<tr class="data-row"><td class="colTitle"><a href="/job/Bangalore-Senior-Developer-560103/' + id + '/" class="jobTitle-link">' + title + '</a></td><td class="colLocation hidden-phone"><span class="jobLocation">' + location + '</span></td></tr>'
const page = (rows, start = 1, end = 1, total = 2) => '<title>India - SAP Jobs</title><link rel="canonical" href="' + origin + '/search/"/><div id="searchresults">Results <b>' + start + ' – ' + end + '</b> of <b>' + total + '</b><table>' + rows + '</table></div>'
const detail = (id = '1384474433', req = '441574') => {
  const html = nativeDetail.replaceAll('1384474433', id).replace(/>441574(?=\r?\n)/, '>' + req)
  assert.equal(extractJobDetail(html).requisitionId, req, 'Synthetic detail must carry its intended native requisition')
  return html
}
const fixtureRun = async (t, modify = () => {}, options = {}) => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Unexpected un-injected network') }
  t.after(() => { globalThis.fetch = originalFetch })
  const fetchPage = async (url, context) => {
    calls.push({ url, context })
    let html = url.includes('/search/') ? (new URL(url).searchParams.has('startrow') ? page(row('1384474434'), 2, 2) : page(row('1384474433'))) : detail(url.match(/\/(\d+)\//)?.[1], url.includes('1384474434') ? '441575' : '441574')
    const response = { status: 200, url, html }
    modify(response, calls)
    return response
  }
  return { jobs: await run({ fetchPage, now: () => '2026-10-09T00:00:00Z', ...options }), calls }
}
test('SAP uses the employer-published current careers host', () => {
  assert.equal(new URL(buildSearchUrl()).origin, origin)
  const rows = extractSearchResults(nativeSearch)
  assert.equal(rows.length, 25)
  assert.equal(rows[0].country, 'India')
  assert.equal(new URL(rows[0].sourceUrl).origin, origin)
})
test('SAP native detail strips nested title markup and retains explicit India evidence', () => {
  const listing = extractSearchResults(nativeSearch).find(x => x.jobId === '1384474433')
  const job = extractJobDetail(nativeDetail, listing)
  assert.equal(job.title, 'Senior Developer')
  assert.equal(job.country, 'India')
  assert.equal(job.requisitionId, '441574')
  assert.ok(job.jobDescription.length > 7000)
  assert.equal(new URL(job.applyUrl).origin, origin)
})
test('SAP never labels foreign or unknown native locations India', () => {
  for (const location of ['Palo Alto, US, 94304', 'Remote']) {
    const listing = extractSearchResults(page(row('123', 'Developer', location)))[0]
    assert.notEqual(listing.country, 'India')
    assert.equal(listing.location, location)
  }
})
test('SAP walks native ranges, reconciles snapshot, and marks parallel-platform coverage partial', async t => {
  const { jobs, calls } = await fixtureRun(t)
  assert.equal(jobs.length, 2)
  assert.ok(calls.some(x => new URL(x.url).searchParams.get('startrow') === '1'))
  assert.equal(calls.filter(x => x.url.includes('/search/')).length, 3)
  assert.ok(jobs.every(x => x.sourceListingComplete === false && x.country === 'India' && x.jobDescription.length > 7000))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /parallel|new recruiting/i)
})
for (const [name, change] of [
  ['count drift', (r, c) => { if (c.length === 2) r.html = r.html.replace('of <b>2', 'of <b>3') }],
  ['missing native range', r => { r.html = r.html.replace(/Results <b>[\s\S]*?<\/b> of <b>\d+<\/b>/, '') }],
  ['duplicate listing ID', (r, c) => { if (c.length === 2) r.html = page(row('1384474433'), 2, 2) }],
  ['malformed row', (r, c) => { if (c.length === 1) r.html = page(row('1384474433').replace('class="jobTitle-link"', 'class="unknown"')) }],
  ['off-authority redirect', r => { r.url = 'https://example.com/copied-sap/' }],
  ['foreign country', (r, c) => { if (c.length === 1) r.html = page(row('1384474433', 'Senior Developer', 'Palo Alto, US, 94304')) }],
  ['unknown country', (r, c) => { if (c.length === 1) r.html = page(row('1384474433', 'Senior Developer', 'Remote')) }],
  ['empty listing without authoritative zero', r => { r.html = '<title>India - SAP Jobs</title><div id="searchresults"></div>' }],
  ['detail location conflict', r => { if (r.url.includes('/job/')) r.html = r.html.replaceAll('Bangalore, IN, 560103', 'Palo Alto, US, 94304') }],
  ['detail title mismatch', r => { if (r.url.includes('/job/')) r.html = r.html.replaceAll('Senior Developer', 'Unrelated role') }],
  ['missing native requisition identity', r => { if (r.url.includes('/job/')) r.html = r.html.replaceAll('data-careersite-propertyid="facility"', 'data-careersite-propertyid="unknown"') }],
  ['duplicate native requisition identity', r => { if (r.url.includes('/1384474434/')) { const before = r.html; r.html = r.html.replace(/>441575(?=\r?\n)/, '>441574'); assert.notEqual(r.html, before, 'Duplicate-requisition mutation must change the synthetic native field') } }],
  ['empty native JD', r => { if (r.url.includes('/job/')) r.html = r.html.replaceAll('jobdescription', 'unknown-description') }],
  ['snapshot identity drift', (r, c) => { if (c.length === 5) r.html = page(row('1384474439')) }],
]) test('SAP fails closed on ' + name, async t => {
  await assert.rejects(fixtureRun(t, change), /SAP|HTTP/)
})
test('SAP caller caps remain incomplete and never authorize expiry', async t => {
  const { jobs } = await fixtureRun(t, undefined, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /cap/i)
})
test('SAP caller pre-abort makes no request', async t => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Unexpected un-injected network') }
  t.after(() => { globalThis.fetch = originalFetch })
  const controller = new AbortController(); controller.abort()
  let calls = 0
  await assert.rejects(run({ signal: controller.signal, fetchPage: async () => { calls++; throw new Error('Unexpected') } }), { name: 'AbortError' })
  assert.equal(calls, 0)
})

test('SAP handles native HTML-escaped ampersands in canonical job slugs', async t => {
  const { jobs } = await fixtureRun(t, r => { r.html = r.html.replaceAll('Senior-Developer', 'Senior-&amp;-Developer') })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(j => j.sourceUrl.includes('Senior-&-Developer')))
})

test('SAP excludes a native explicitly filled posting and retains observed raw count', async t => {
  const filled = await fs.readFile(new URL('./fixtures/current-filled-job.html', import.meta.url), 'utf8')
  const { jobs } = await fixtureRun(t, r => {
    if (r.url.includes('/1384474434/')) r.html = filled.replaceAll('1431174533', '1384474434').replaceAll('Bangalore-Associate-Data-Scientist-%281-to-2-years-of-experience%29-560066', 'Bangalore-Senior-Developer-560103')
  })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /filled|closed/i)
})

test('SAP rejects invalid caller caps before fetching', async t => {
  for (const option of [{maxPages:0},{maxJobs:0},{maxPages:-1},{maxJobs:1.5},{maxPages:'1'}]) {
    await assert.rejects(fixtureRun(t, undefined, option), /SAP.*positive integer/i)
  }
})

for (const [name, change] of [
  ['missing native title', r => { if (r.url.includes('/job/')) r.html = r.html.replaceAll('<h1', '<div').replaceAll('</h1>', '</div>') }],
  ['zero-prefixed posting-ID alias', (r,c) => { if(c.length===2) r.html = page(row('01384474433'),2,2); if(r.url.includes('/01384474433/')) r.html = r.html.replaceAll('441574', '441576') }],
  ['response query drift', (r,c) => { if(c.length===2) r.url = r.url.replace('&startrow=1','') }],
]) test('SAP rejects ' + name, async t => {
  await assert.rejects(fixtureRun(t, change), /SAP/)
})

for (const badLocation of ['Bangalore, IN, United States', 'Bangalore, IN, US', 'Bangalore, US, India']) {
  test('SAP rejects contradictory listing country ' + badLocation, async t => {
    await assert.rejects(fixtureRun(t, (r,c) => { if(c.length===1) r.html = page(row('1384474433','Senior Developer',badLocation)) }), /SAP/)
  })
  test('SAP rejects contradictory detail country ' + badLocation, async t => {
    await assert.rejects(fixtureRun(t, r => { if(r.url.includes('/job/')) r.html = r.html.replaceAll('Bangalore, IN, 560103',badLocation) }), /SAP/)
  })
}
