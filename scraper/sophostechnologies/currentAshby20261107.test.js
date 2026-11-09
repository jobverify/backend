import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261107/current-public.json.gz', import.meta.url))))
// Model the retired Lever endpoint's observed empty response without network.
const run = options => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'sophostechnologies')).run({ fetchJson: async () => [], ...options })
const careers = 'https://www.sophos.com/en-us/company/careers'
const api = 'https://api.ashbyhq.com/posting-api/job-board/sophos'
const replay = change => async (url, init = {}) => {
  assert.equal(init.credentials, 'omit')
  assert.equal(init.redirect, 'manual')
  const row = fixture.find(row => row.url === url)
  assert.ok(row, 'Only the currently advertised source may be read: ' + url)
  const body = change?.(row.body, url) ?? row.body
  const response = new Response(body, { status: row.status, headers: { 'content-type': row.contentType } })
  Object.defineProperty(response, 'url', { value: url })
  return response
}

test('registered Sophos reads all 16 current Ashby India roles after the retired Lever feed becomes empty', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'sophostechnologies')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.jobsBoardUrl, 'https://jobs.ashbyhq.com/sophos')
  const jobs = await run({ fetchImpl: replay() })
  assert.equal(jobs.length, 16)
  assert.ok(jobs.some(job => job.jobId === '0b9af89e-23ae-4e34-a206-8db40e2c10f4'))
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.source, 'sophostechnologies')
    assert.equal(job.atsPlatform, 'ashby')
    assert.match(job.sourceUrl, /^https:\/\/jobs\.ashbyhq\.com\/sophos\//)
    assert.ok(job.sourceDescription.length > 100)
    assert.equal(job.sourceDescription, job.nativeSourceRecord.descriptionHtml)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Sophos refuses an absent current Ashby publisher handoff before reading the feed', async () => {
  const reads = []
  await assert.rejects(run({ fetchImpl: async (url, init) => {
    reads.push(url)
    return replay((body, target) => target === careers ? body.replaceAll('https://jobs.ashbyhq.com/sophos', 'https://jobs.ashbyhq.com/another') : body)(url, init)
  } }), /handoff|binding/i)
  assert.deepEqual(reads, [careers])
})

test('Sophos rejects an Ashby feed containing a foreign board application identity', async () => {
  await assert.rejects(run({ fetchImpl: replay((body, url) => url === api
    ? body.replaceAll('https://jobs.ashbyhq.com/sophos/', 'https://jobs.ashbyhq.com/another/') : body) }),
  error => error.abortRetries === true && /board|identity/i.test(error.message))
})

test('Sophos marks a malformed native inventory as a permanent contract failure', async () => {
  await assert.rejects(run({ fetchImpl: replay((body, url) => url === api ? '{"apiVersion":"1","jobs":{}}' : body) }),
    error => error.abortRetries === true && error.failureKind === 'surface_drift_or_fail_closed')
})

test('Sophos preserves the full native plain criteria when its HTML field is semantically empty', async () => {
  const native = JSON.parse(fixture.find(row => row.url === api).body).jobs.find(row => row.id === '0b9af89e-23ae-4e34-a206-8db40e2c10f4')
  const jobs = await run({ fetchImpl: replay((body, url) => {
    if (url !== api) return body
    const payload = JSON.parse(body)
    payload.jobs.find(row => row.id === native.id).descriptionHtml = '<p>&nbsp;</p>'
    return JSON.stringify(payload)
  }) })
  const job = jobs.find(job => job.jobId === native.id)
  assert.ok(hasSourceDescription(job))
  assert.equal(job.sourceDescription, native.descriptionPlain)
})

test('an empty migrated Sophos feed retains incomplete source evidence', async () => {
  const jobs = await run({ fetchImpl: replay((body, url) => url === api ? '{"apiVersion":"1","jobs":[]}' : body) })
  assert.equal(jobs.length, 0)
  assert.notEqual(readInventoryEvidence(jobs), null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})
