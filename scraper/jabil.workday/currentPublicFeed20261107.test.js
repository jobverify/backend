import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const records = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-public.json.gz', import.meta.url))))
const run = options => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'jabil')).run({
  now: () => '2026-11-07T05:00:00.000Z', requestIntervalMs: 0, ...options,
})
const replay = change => async (url, init = {}) => {
  const row = records.find(row => row.url === url)
  assert.ok(row, 'Only captured current declarations may be requested: ' + url)
  assert.equal(init.credentials, 'omit')
  assert.equal(createHash('sha256').update(row.body).digest('hex'), row.sha256)
  const response = new Response(change?.(row.body, url) ?? row.body, { status: row.status, headers: { 'content-type': row.contentType } })
  Object.defineProperty(response, 'url', { value: url }); return response
}
const detailURL = 'https://careers.jabil.com/.rest/delivery/jobs?jobId=J2468657'

test('registered Jabil reads every current first-party India role with native full details and application identities', async () => {
  const jobs = await run({ fetchImpl: replay() })
  assert.equal(jobs.length, 86)
  const remote = jobs.find(job => job.jobId === 'J2468657')
  assert.equal(remote.title, 'Market Intelligence Analyst')
  assert.equal(remote.country, 'India')
  for (const job of jobs) {
    assert.equal(job.source, 'jabil')
    assert.equal(job.sourceDescription, job.nativeSourceRecord.Job_Description)
    assert.equal(job.applyUrl, job.nativeSourceRecord.External_Apply_URL)
    assert.equal(job.nativeSourceRecord.Status, 'Open')
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.sourceScopeComplete, false)
    assert.ok(job.sourceDescription.length > 100)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const change of ['country', 'closed']) test('Jabil holds a full native role with ' + change + ' evidence', async () => {
  const jobs = await run({ fetchImpl: replay((body, url) => {
    if (url !== detailURL) return body
    const payload = JSON.parse(body)
    if (change === 'closed') payload.jobs[0].Status = 'Closed'
    else for (const place of payload.jobs[0].All_Job_Posting_Locations_for_Job_Requisition_group) place['Location_Address_-_Country'] = 'United States'
    return JSON.stringify(payload)
  }) })
  assert.equal(jobs.length, 85)
  assert.ok(jobs.every(job => job.jobId !== 'J2468657'))
})

test('Jabil refuses an unrelated native application board', async () => {
  await assert.rejects(run({ fetchImpl: replay((body, url) => url === detailURL
    ? body.replaceAll('https://jabil.wd5.myworkdayjobs.com/', 'https://another.wd5.myworkdayjobs.com/') : body) }), /application|board/i)
})

for (const value of [null, 'not a URL']) test('Jabil classifies a malformed native application URL as a permanent contract failure: ' + value, async () => {
  await assert.rejects(run({ fetchImpl: replay((body, url) => {
    if (url !== detailURL) return body
    const payload = JSON.parse(body)
    payload.jobs[0].External_Apply_URL = value
    return JSON.stringify(payload)
  }) }), error => error.abortRetries === true && error.failureKind === 'coverage_gap')
})

test('Jabil refuses a removed corporate handoff before delegating to the native feed', async () => {
  await assert.rejects(run({ fetchImpl: replay((body, url) => url === 'https://www.jabil.com/'
    ? body.replaceAll('https://careers.jabil.com/', 'https://another.example/') : body) }), /handoff|publisher|binding/i)
})

test('Jabil refuses an unreviewed current jobs renderer', async () => {
  await assert.rejects(run({ fetchImpl: replay((body, url) => url.includes('/dist/common~') ? body + '\n/* changed native renderer */' : body) }), /client|renderer/i)
})
