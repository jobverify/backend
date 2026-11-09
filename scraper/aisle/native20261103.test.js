import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, OFFICIAL_HOMEPAGE_URL, LISTING_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz', import.meta.url))))

test('the currently declared Freshteam500 records unknown current inventory rather than a successful empty board', async () => {
  assert.match(native.outage, /500/)
  const jobs = await run({ fetchText: async url => {
    if (url === OFFICIAL_HOMEPAGE_URL) return native.company
    assert.equal(url, LISTING_URL)
    throw Error('HTTP 500 for '+url)
  } })
  const evidence = readInventoryEvidence(jobs)
  assert.ok(evidence)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /HTTP 500/)
})

test('Aisle cancellation settles a public fetch override which ignores its signal', async () => {
  const controller = new AbortController(), reason = Error('stop Aisle')
  const pending = run({ signal: controller.signal, fetchText: () => { controller.abort(reason); return new Promise(() => {}) } })
  await assert.rejects(pending, error => error === reason)
})
