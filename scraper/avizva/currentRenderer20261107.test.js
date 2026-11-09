import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261105.json.gz', import.meta.url))))
const renderer = gunzipSync(readFileSync(new URL('./test-data/current-renderer-20261107.js.gz', import.meta.url))).toString('utf8')
const provider = getScraperCatalog().find(row => row.source === 'avizva')
function replay(program = renderer) {
  const seen = new Map(), calls = []
  return { calls, options: { now: () => fixture.capturedAt, requestIntervalMs: 0,
    async fetchImpl(url) {
      calls.push(url)
      const candidates = fixture.responses.filter(row => row.requestedUrl === url)
      const ordinal = seen.get(url) || 0
      seen.set(url, ordinal + 1)
      const row = candidates[ordinal]
      assert.ok(row, 'unexpected public URL ' + url)
      const body = url.includes('/careers/api/embedjobs/js/') ? program : row.body
      return new Response(body, { status: row.status || 200, headers: { 'content-type': row.headers['content-type'] } })
    },
  } }
}

test('registered AVIZVA source accepts the reviewed current renderer without changing native job proof', async () => {
  const { options } = replay()
  const jobs = await createCatalogScraper(provider).run(options)
  assert.deepEqual(jobs.map(job => job.jobId).sort(), ['120944', '158305'])
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('an unreviewed renderer activation still stops before reading the native active feed', async () => {
  const { options, calls } = replay(renderer + '\nfetch("https://foreign.example/jobs");')
  await assert.rejects(createCatalogScraper(provider).run(options), /native renderer contract changed/)
  assert.equal(calls.some(url => url.includes('/api/embedjobs/default/active/')), false)
})
