import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const bytes = readFileSync(new URL('./fixtures/empty-only-recovery/codeclouds20261110.json.gz', import.meta.url))
assert.equal(sha(bytes), '6171d63640c4f900633c55f0067f0e933f4fe9aa6cee02ce4581548612f1d507')
const fixture = JSON.parse(gunzipSync(bytes)), packets = new Map(fixture.responses.map(packet => [packet.requestedURL, packet]))
for (const packet of packets.values()) {
  const body = Buffer.from(packet.bodyBase64, 'base64')
  assert.equal(sha(body), packet.bodySHA256)
  assert.equal(body.length, packet.bodyBytes)
}

// The public native role is old: collection recovery is separate from the
// publication age filter, which must continue to reject it for publication.
test('genuine current CodeClouds pages recover an authored India detail while preserving its publication age', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    const packet = packets.get(String(url))
    assert.ok(packet, 'No unretained public response may be fabricated: ' + url)
    const response = new Response(Buffer.from(packet.bodyBase64, 'base64'), {
      status: packet.status, headers: { 'content-type': packet.contentType },
    })
    Object.defineProperty(response, 'url', { value: packet.finalURL })
    return response
  })
  const provider = getScraperCatalog().find(provider => provider.source === 'codeclouds')
  const collector = createCatalogScraper(provider)
  const original = await collector.run({ emptyOnlyRecovery: false })
  assert.equal(original.length, 0)
  const jobs = await collector.run({ now: () => '2026-11-10T04:00:00.000Z', sourceTimeoutMs: 10000 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Full Stack Developer')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, 'https://careers.codeclouds.com/jobs/full-stack-developer/')
  assert.equal(jobs[0].nativeHiringOrganization.name, 'CodeClouds')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.match(jobs[0].sourceDescription, /PHP|Laravel/)
  const analysis = analyzePublishableJobs(jobs, { now: '2026-11-10T04:00:00.000Z' })
  assert.equal(analysis.indiaJobs.length, 1)
  assert.equal(analysis.eligibleJobs.length, 0)
  assert.equal(analysis.filterCounts.old, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})
