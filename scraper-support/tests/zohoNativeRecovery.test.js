import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { makeZohoFixture, zohoFixtureOptions } from './fixtures/zohoNativeOptions.js'
const run = async (data, overrides = {}) => (await import(`../../scraper/${data.spec.source}/script.js`)).run({ ...zohoFixtureOptions(data), ...overrides })

for (const source of ['agilisium', 'npci', 'fasal']) test(`${source} reads full native details and reconciles current board/API inventory`, async () => {
  const data = makeZohoFixture(source), jobs = await run(data)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, data.spec.company)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, '2026-10-24')
  assert.equal(jobs[0].applyUrl, data.details[data.rows[0].id].$appy_url)
  assert.match(jobs[0].jobDescription, /Responsibilities[\s\S]*payment infrastructure[\s\S]*Requirements[\s\S]*distributed systems/)
  assert.doesNotMatch(jobs[0].jobDescription, /Listing summary only/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  assert.equal(data.requests.filter(url => url === data.spec.board).length, 2)
})
test('NPCI city/state evidence recovers India jobs when the native Country field is absent', async () => {
  const data = makeZohoFixture('npci'), jobs = await run(data)
  assert.equal(jobs[0].location, 'Mumbai, Maharashtra, India')
  assert.equal(jobs[0].nativeEmployerEntity, 'NPCI')
  assert.equal(jobs[0].department, 'Technology')
})
test('NPCI subsidiary entities remain outside the exact NPCI source', async () => {
  const data = makeZohoFixture('npci'); data.details[data.rows[0].id].Entity = 'NIPL'
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 1)
})
for (const [label, mutate] of [
  ['unknown NPCI entity', d => { d.details[d.rows[0].id].Entity = null }],
  ['unresolved India geography', d => { d.rows[0].City = d.details[d.rows[0].id].City = 'Remote'; d.rows[0].State = d.details[d.rows[0].id].State = null }],
]) test(`${label} stays partial and is not returned as a proven India role`, async () => {
  const data = makeZohoFixture('npci'); mutate(data)
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
for (const [label, mutate] of [
  ['wrong organization ID', d => { d.meta.org_info.id = 'other' }],
  ['wrong company name', d => { d.meta.org_info.company_name = 'Other Employer' }],
  ['wrong reciprocal website', d => { d.meta.org_info.website = 'https://other.example/' }],
  ['wrong page ID', d => { d.meta.page_id = 'other' }],
  ['foreign detail identity', d => { d.details[d.rows[0].id].id = 'other' }],
  ['foreign detail URL', d => { d.rows[0].$url = d.rows[0].$url.replace('agilisium.zohorecruit.com', 'other.zohorecruit.com') }],
  ['foreign apply identity', d => { d.details[d.rows[0].id].$appy_url = 'https://other.example/apply' }],
  ['repeated native record', d => { d.rows.push(structuredClone(d.rows[0])) }],
  ['embedded/API mismatch', d => { d.boardRows = [] }],
  ['native continuation', d => { d.apiInfo = { more_records: true } }],
  ['empty active description', d => { d.details[d.rows[0].id].Job_Description = '<div hidden>Example description only</div>' }],
  ['contradictory native date', d => { d.details[d.rows[0].id].Date_Opened = '2026-10-25' }],
  ['impossible native date', d => { d.details[d.rows[0].id].Date_Opened = '2026-02-30' }],
]) test(`rejects ${label}`, async () => {
  const data = makeZohoFixture(); mutate(data)
  await assert.rejects(run(data))
})
test('the current exact employer-bound empty Fasal inventory is verified empty', async () => {
  const data = makeZohoFixture('fasal'); data.rows = []
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})
test('an additional hiring surface retains partial scope alongside recovered India jobs', async () => {
  const data = makeZohoFixture(); data.homepage += '<a href="https://another.zohorecruit.com/jobs/Careers">See job openings</a>'
  const jobs = await run(data)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
for (const wrapper of ['<!--{link}-->', '<div hidden>{link}</div>', '<script>const example="{link}"</script>']) test(`inactive employer handoff cannot bind native inventory: ${wrapper}`, async () => {
  const data = makeZohoFixture(); data.homepage = wrapper.replace('{link}', data.homepage)
  await assert.rejects(run(data))
})
test('native public HTML descriptions retain all visible sections and omit inert text', async () => {
  const data = makeZohoFixture(); data.details[data.rows[0].id].Job_Description += '<span hidden>Draft prose</span>'
  assert.doesNotMatch((await run(data))[0].jobDescription, /Draft prose/)
})
test('a detail transport failure preserves recovered jobs with incomplete evidence', async () => {
  const data = makeZohoFixture(), row = structuredClone(data.rows[0]); row.id = '123456789012345679'; row.$url = row.$url.replace(data.rows[0].id, row.id)
  data.rows.push(row); data.unavailableId = row.id
  const jobs = await run(data)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
test('output caps preserve partial cleanup markers and native India count', async () => {
  const data = makeZohoFixture(), row = structuredClone(data.rows[0]); row.id = '123456789012345679'; row.$url = row.$url.replace(data.rows[0].id, row.id)
  data.rows.push(row); data.details[row.id] = { ...structuredClone(data.details[data.rows[0].id]), id: row.id, $appy_url: row.$url + '&$apply=true' }
  const jobs = await run(data, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 2)
})
test('cancellation never certifies empty inventory', async () => {
  await assert.rejects(run(makeZohoFixture(), { signal: AbortSignal.abort() }))
})
test('registered Agilisium extraction uses the new native runtime and metadata', async () => {
  const data = makeZohoFixture(), provider = getScraperCatalog().find(p => p.source === data.spec.source)
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.backfillMode, 'live-parser')
  const jobs = await createCatalogScraper(provider).run(zohoFixtureOptions(data))
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
test('a closing publication-state change excludes the unpublished role and retains partial evidence', async () => {
  const data = makeZohoFixture(), base = zohoFixtureOptions(data)
  let boards = 0, listings = 0
  const jobs = await run(data, { fetchPage: async (url, init) => {
    const page = await base.fetchPage(url, init)
    if (url === data.spec.board && ++boards === 2) page.html = page.html.replace(/&quot;Publish&quot;:true/g, '&quot;Publish&quot;:false')
    return page
  }, fetchJson: async (url, init) => {
    const payload = structuredClone(await base.fetchJson(url, init))
    if (new URL(url).pathname.endsWith('/Job_Openings') && ++listings === 2) payload.data[0].Publish = false
    return payload
  } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('a non-web reciprocal website cannot bind the employer', async () => {
  const data = makeZohoFixture(); data.meta.org_info.website = 'ftp://www.agilisium.com/'
  await assert.rejects(run(data))
})
test('malformed native Country cannot become missing-country city/state evidence', async () => {
  const data = makeZohoFixture('npci'); data.rows[0].Country = data.details[data.rows[0].id].Country = 42
  await assert.rejects(run(data))
})
test('an advertised native total larger than both carriers cannot certify complete inventory', async () => {
  const data = makeZohoFixture(); data.apiInfo = { total_records: 10 }
  await assert.rejects(run(data))
})
test('a listing may omit Remote_Job while board and full native detail retain it', async () => {
  const data = makeZohoFixture(); data.boardRows = structuredClone(data.rows); data.boardRows[0].Remote_Job = false
  delete data.rows[0].Remote_Job
  const jobs = await run(data)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].remoteStatus, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
test('an unknown nonempty NPCI entity cannot certify complete exclusion', async () => {
  const data = makeZohoFixture('npci'); data.details[data.rows[0].id].Entity = 'Unknown'
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('an additional SmartRecruiters handoff prevents verified empty inventory', async () => {
  const data = makeZohoFixture('fasal'); data.rows = []
  data.homepage += '<a href="https://careers.smartrecruiters.com/Wolkus">Explore opportunities</a>'
  assert.equal(readInventoryEvidence(await run(data)).listingComplete, false)
})
test('additional recruiting links on the native board retain partial scope', async () => {
  const data = makeZohoFixture('fasal'); data.rows = []; const opts = zohoFixtureOptions(data)
  const jobs = await run(data, { fetchPage: async (url, init) => {
    const page = await opts.fetchPage(url, init)
    if (url === data.spec.board) page.html += '<a href="https://other.zohorecruit.com/jobs/Careers">India openings</a>'
    return page
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('relative additional careers pages on a first-party board retain partial scope', async () => {
  const data = makeZohoFixture('npci'), opts = zohoFixtureOptions(data)
  const jobs = await run(data, { fetchPage: async (url, init) => {
    const page = await opts.fetchPage(url, init)
    page.html += '<a href="/jobs/OtherCareers">Other openings</a>'
    return page
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('an active advertised board role outside both native carriers remains unresolved', async () => {
  const data = makeZohoFixture(), opts = zohoFixtureOptions(data)
  const jobs = await run(data, { fetchPage: async (url, init) => {
    const page = await opts.fetchPage(url, init)
    if (url === data.spec.board) page.html += `<a href="${data.spec.board}/999999999999999999/Missing?source=CareerSite">Platform Engineer</a>`
    return page
  } })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
