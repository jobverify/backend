import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createBharatPeScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const fetchPage = async url => {
  const row = captures.find(row => row.requestedUrl === url)
  assert.ok(row, 'unrecorded request ' + url)
  return { status: row.status, url: row.finalUrl, html: row.html }
}

test('uses the current corporate Darwinbox handoff and hydrates full India role details', async () => {
  const jobs = await createBharatPeScraper().run({ fetchPage,
    fetchListingPage: async () => ({ status: 'success', job_counts: 2, data: [
      { id: 'india-role', title: 'Software Engineer', country: 'India', locations: 'Gurugram, Haryana, India', jd: '' },
      { id: 'foreign-role', title: 'Accountant', country: 'United States', locations: 'New York, United States', jd: '' },
    ] }),
    fetchJobDetail: async ({ jobId }) => ({ status: 'success', message: { job: [
      { id: jobId, title: 'Software Engineer', country: 'India', officelocation_show_arr: 'Gurugram, Haryana, India', jd: '<p>Build reliable merchant payments. Design reconciliation, recovery, and transaction processing services.</p>' },
    ] } }),
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'BharatPe')
  assert.match(jobs[0].applyUrl, /^https:\/\/bharatpe\.darwinbox\.in\//)
  assert.match(jobs[0].jobDescription, /reconciliation, recovery/)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('requires the visible same-company corporate handoff before trusting Darwinbox inventory', async () => {
  await assert.rejects(createBharatPeScraper().run({ fetchPage: async url => {
    const page = await fetchPage(url)
    page.html = page.html.replaceAll('https://bharatpe.darwinbox.in/', 'https://other.darwinbox.in/')
    return page
  }, fetchListingPage: async () => { throw new Error('untrusted native fetch reached') } }), /handoff/i)
})
