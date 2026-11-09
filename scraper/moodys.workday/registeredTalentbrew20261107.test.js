import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = new URL('../moodyscorporation.workday/test-data-20261106/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', directory)))
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value
const key = (url, init) => JSON.stringify([init.method || 'GET', url, init.body ? canonical(JSON.parse(init.body)) : null])
const run = () => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'moodys'))

test("the Moody's catalog name reaches the native India facet and retains its own source identity", async () => {
  const queues = new Map()
  for (const row of manifest.requests) {
    const id = key(row.url, row)
    if (!queues.has(id)) queues.set(id, [])
    queues.get(id).push(row)
  }
  const fetchImpl = async (url, init = {}) => {
    const row = queues.get(key(url, init))?.shift()
    assert.ok(row, 'Uncaptured request: ' + url)
    const body = gunzipSync(readFileSync(new URL(row.bodySHA256 + '.gz', directory)))
    assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
    const response = new Response(body, { status: row.status, headers: { 'content-type': row.contentType,
      ...(row.location ? { location: row.location } : {}) } })
    Object.defineProperty(response, 'url', { value: row.finalURL })
    return response
  }
  const jobs = await run().run({ fetchImpl, now: () => '2026-11-06T18:30:00.000Z' })
  assert.equal(jobs.length, 44)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), [...manifest.expectedIndiaIds].sort())
  for (const job of jobs) {
    assert.equal(job.source, 'moodys')
    assert.equal(job.company, "Moody's")
    assert.equal(job.country, 'India')
    assert.equal(job.nativeHiringOrganization.name, "Moody's")
    assert.equal(job.sourceDescription, job.nativeClosingSourceRecord.description)
    assert.equal(job.nativeTalentbrewEvidence.listingClosingConfirmed, true)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
