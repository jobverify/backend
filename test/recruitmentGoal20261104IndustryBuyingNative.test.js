import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {extractJobSummaries, mapJob} from '../scraper/industrybuying/script.js'
import {createCatalogScraper, getScraperCatalog} from '../scraper-support/providers/index.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/industrybuying-native-quality.json.gz', import.meta.url))))
const inventory = JSON.parse(capture.packets.find(p => p.requestedURL.includes('?orgId=')).bodyText)
const summaries = extractJobSummaries(inventory)
const originalDetail = summary => JSON.parse(capture.packets.find(p => p.requestedURL.endsWith('?id=' + summary.id)).bodyText).data

test('five original IndustryBuying models retain full criteria without converting office labels into India', () => {
  assert.equal(summaries.length, 5)
  for (const summary of summaries) {
    const detail = originalDetail(summary), job = mapJob({summary, detail})
    assert.equal(job.country, null)
    assert.equal(job.location, null)
    assert.equal(job.city, null)
    assert.equal(job.sourceCountryScopeUnresolved, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.deepEqual(job.rawWorkplace, {listing: summary.location, detail: detail.location})
    assert.deepEqual(job.nativeSourceRecord.listing, inventory.data.find(r => r.id === summary.id))
    assert.deepEqual(job.nativeSourceRecord.detail, detail)
    assert.ok(job.jobDescription.length > 300)
    assert.equal(job.postingDate, detail.createdAt)
  }
})

for (const location of [null, '', 'Remote', 'Georgia', 'Austin, Texas']) test('IndustryBuying does not invent India for native location ' + JSON.stringify(location), () => {
  const summary = structuredClone(summaries[0]), detail = originalDetail(summary)
  summary.location = detail.location = location
  const job = mapJob({summary, detail})
  assert.equal(job.country, null)
  assert.equal(job.city, null)
  assert.equal(job.location, null)
  assert.equal(job.rawWorkplace.detail, location)
})

for (const [name, edit] of [
  ['other employer', detail => { detail.orgId = 'org_other' }],
  ['other requisition', detail => { detail.requisitionId = 'req_other' }],
  ['other role model', detail => { detail.id = 'req_other' }],
]) test('IndustryBuying rejects a detail belonging to ' + name, () => {
  const summary = structuredClone(summaries[0]), detail = originalDetail(summary)
  edit(detail)
  assert.throws(() => mapJob({summary, detail}), /identity|requisition|employer/i)
})

test('IndustryBuying retains independent original models when callers later change the input', () => {
  const summary = structuredClone(summaries[0]), detail = originalDetail(summary)
  const expected = structuredClone(detail), job = mapJob({summary, detail})
  detail.jobDescription = 'changed input'
  assert.deepEqual(job.nativeSourceRecord.detail, expected)
})

test('registered IndustryBuying route preserves all five full country-unknown roles and original response integrity', async t => {
  const calls = []
  t.mock.method(globalThis, 'fetch', async url => {
    const original = capture.packets.find(p => p.requestedURL === String(url))
    assert.ok(original, 'Uncaptured IndustryBuying request: ' + url)
    assert.equal(createHash('sha256').update(original.bodyText).digest('hex'), original.bodySHA256)
    calls.push(String(url))
    const response = new Response(original.bodyText, {status: original.status, headers: {'content-type': original.contentType}})
    Object.defineProperty(response, 'url', {value: original.finalURL})
    return response
  })
  const provider = getScraperCatalog().find(p => p.source === 'industrybuying')
  assert.equal(provider.countryFilter, 'India')
  const jobs = await createCatalogScraper(provider).run()
  assert.equal(jobs.length, 5)
  assert.ok(jobs.every(j => j.country === null && j.sourceCountryScopeUnresolved && j.lifecycleCleanupAllowed === false))
  assert.deepEqual(jobs.map(j => j.jobId).sort(), inventory.data.map(j => j.id).sort())
  assert.equal(calls.length, 9)
})
