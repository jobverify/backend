import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createAnsysScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const captures = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
const fetchText = async url => {
  const row = captures.find(row => row.requestedUrl === url && row.status === 200)
  assert.ok(row, 'unrecorded successful request ' + url)
  return row.html
}

test('reconciles the current Ansys corporate handoff and all four native pages with full India details', async () => {
  const jobs = await createAnsysScraper().run({ fetchText })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.nativeEmployer === 'Synopsys' && job.country === 'India' && job.jobDescription.length > 1000))
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 52)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount, 4)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('accepts the exact corporate Ansys careers redirect into the Synopsys Ansys brand site', async () => {
  const jobs = await createAnsysScraper().run({ fetchText: async url => ({
    html: await fetchText(url), status: 200,
    url: url === 'https://www.ansys.com/careers' ? 'https://ansys.synopsys.com/careers' : url,
  }) })
  assert.equal(jobs.length, 4)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
})

test('rejects a corporate careers redirect outside the exact reviewed Ansys brand URL', async () => {
  await assert.rejects(createAnsysScraper().run({ fetchText: async url => ({
    html: await fetchText(url), status: 200, url: 'https://unrelated.example/careers',
  }) }), /first-party response changed/)
})

test('retains only partial evidence when the caller stops after the first Ansys page', async () => {
  const jobs = await createAnsysScraper({ maxPages: 1 }).run({ fetchText })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal, 52)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})

test('does not certify an India detail after its native country changes to a foreign country', async () => {
  const jobs = await createAnsysScraper().run({ fetchText: async url => {
    const html = await fetchText(url)
    if (!url.includes('/staff-engineer-signal-and-power-integrity/')) return html
    return html.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g, (tag, raw) => {
      const posting = JSON.parse(raw)
      if (posting['@type'] !== 'JobPosting') return tag
      const places = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
      for (const place of places) place.address.addressCountry = 'US'
      return '<script type="application/ld+json">' + JSON.stringify(posting) + '</script>'
    })
  } })
  assert.equal(jobs.find(job => job.jobId === '18818')?.sourceDetailComplete, false)
  assert.equal(jobs.find(job => job.jobId === '18818')?.jobDescription, null)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
