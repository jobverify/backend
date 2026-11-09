import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createBlueBrixScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))

test('follows the published blueBriX All roles handoff and retains full India role descriptions', async () => {
  const jobs = await createBlueBrixScraper().run({ fetchText: async url => {
    const row = captures.find(row => row.requestedUrl === url)
    assert.ok(row, 'unrecorded request ' + url)
    return row.html
  } })
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map(job => job.country), ['India', 'India', 'India'])
  assert.ok(jobs.every(job => job.jobDescription.length > 1000))
  assert.match(jobs.find(job => job.title === 'AR Caller')?.jobDescription || '', /Growth Into RCM Specializations/)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 4)
})

test('rejects a truncated blueBriX listing that disagrees with its published department counts', async () => {
  await assert.rejects(createBlueBrixScraper().run({ fetchText: async url => {
    const row = captures.find(row => row.requestedUrl === url)
    assert.ok(row, 'unrecorded request ' + url)
    return url.endsWith('/all-roles/') ? row.html.replace(/<div class="job-roles-card-info">[\s\S]*?<\/div>/, '') : row.html
  } }), /inventory|count|incomplete/i)
})
