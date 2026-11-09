import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { CAREERS_URL, createAivenScraper, extractIndiaJobUrls, extractJobFromDetail, hasOfficialCareersSignal } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const html = captures.find(row => row.requestedUrl === CAREERS_URL).html

test('recognizes the current Aiven listing with careers subdomain role links and count checked India zero', async () => {
  assert.equal(hasOfficialCareersSignal(html), true)
  const jobs = await createAivenScraper().run({ fetchText: async url => { assert.equal(url, CAREERS_URL); return html } })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 40)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 0)
})

test('follows India roles only on the employer published Aiven job hosts', () => {
  const cards = '<a href="https://careers.aiven.io/openings/123">Engineer Bengaluru, Karnataka, India</a><a href="https://attacker.example/careers/job/456">Engineer India</a><a href="https://careers.aiven.io/openings/789">Engineer Indianapolis, USA</a>'
  assert.deepEqual(extractIndiaJobUrls(cards), ['https://careers.aiven.io/openings/123'])
})

test('retains complete native JobPosting descriptions on the current Aiven role surface', () => {
  const url = 'https://careers.aiven.io/openings/123'
  const detail = '<script type="application/ld+json">' + JSON.stringify({ '@type': 'JobPosting', title: 'Backend Engineer', hiringOrganization: { name: 'Aiven' }, jobLocation: { address: { addressLocality: 'Bengaluru', addressRegion: 'Karnataka', addressCountry: 'IN' } }, description: '<p>Build reliable database services.</p><h2>Requirements</h2><p>Design durable recovery and replication systems.</p>' }) + '</script>'
  const job = extractJobFromDetail(url, detail)
  assert.equal(job?.title, 'Backend Engineer')
  assert.equal(job?.country, 'India')
  assert.equal(job?.jobId, '123')
  assert.match(job?.jobDescription || '', /Design durable recovery and replication systems/)
  assert.equal(extractJobFromDetail(url, detail.replace('"name":"Aiven"', '"name":"Other"')), null)
})
