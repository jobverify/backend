import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAnoraInstrumentationScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))

test('reads the current HTTPS Anoralabs shell and all native India roles from its published bundle', async () => {
  const jobs = await createAnoraInstrumentationScraper().run({ fetchText: async url => {
    const row = captures.find(row => row.requestedUrl === url && row.status === 200)
    assert.ok(row, 'unrecorded successful request ' + url)
    return row.html
  } })
  assert.deepEqual(jobs.map(job => job.title), ['Assembly Manager', 'Operations Program Manager', 'Assembly Engineering Manager'])
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription))
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})
