import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const provider = getScraperCatalog().find(p => p.source === 'cloudflare')
// Full public native response captured 2026-10-26T06:31:51.661Z. The response's
// 455-row total is unchanged; this is not a fabricated complete subset.
const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/cloudflare-native-20261026.json.gz', import.meta.url))))

test('Cloudflare extracts the 20 native India roles hidden behind non-geographic workplace labels', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(capture))
  const jobs = await createCatalogScraper(provider).run()
  assert.equal(jobs.length, 20)
  const engineer = jobs.find(job => String(job.jobId) === '8220770')
  assert.equal(engineer.location, 'Bengaluru, India')
  assert.equal(engineer.company, 'Cloudflare')
  assert.equal(engineer.applyUrl, 'https://boards.greenhouse.io/cloudflare/jobs/8220770?gh_jid=8220770')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 455)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 20)
})

test('Cloudflare does not infer India from Hybrid, Distributed, or globally remote work modes', async t => {
  const jobs = capture.jobs.filter(job => [8220770, 8275927].includes(job.id)).map(job => ({ ...job,
    location: { name: 'Hybrid' }, metadata: [], offices: [],
  }))
  t.mock.method(globalThis, 'fetch', async () => Response.json({ jobs, meta: { total: 2 } }))
  const result = await createCatalogScraper(provider).run()
  assert.equal(result.length, 0)
  assert.equal(readInventoryEvidence(result).listingComplete, false)
  assert.notEqual(readInventoryEvidence(result).status, 'verified-empty')
})
