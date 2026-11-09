import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAvantelScraper, extractEmbeddedJobListings } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))

test('reads the currently rendered Avantel inventory including a native sparse array slot', async () => {
  const jobs = await createAvantelScraper().run({ fetchPage: async url => {
    const row = captures.find(row => row.requestedUrl === url)
    assert.ok(row, 'unrecorded request ' + url)
    return { status: row.status, url: row.finalUrl, html: row.html }
  } })
  assert.equal(jobs.length, 7)
  assert.equal(jobs[0].title, 'Project Manager – Communications & Defense Systems')
  assert.ok(jobs.every(job => job.jobDescription && job.jobDescription.length > 100))
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('skips only native sparse slots and still rejects executable Avantel role entries', () => {
  assert.equal(extractEmbeddedJobListings('jobListings:[{id:1,role:"Engineer",location:"Hyderabad"},,{id:2,role:"Manager",location:"Hyderabad"}]').length, 2)
  assert.deepEqual(extractEmbeddedJobListings('jobListings:[{id:1,role:globalThis.attack(),location:"Hyderabad"}]'), [])
})
