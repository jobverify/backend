import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createLogeliteScraper,
  extractJobCards,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
<html>
  <head>
    <title>Join Our Dynamic Digital Marketing &amp; Web Development Team</title>
  </head>
  <body>
    <p>Open Job Positions</p>
    <h2>Your Career <span>Starts Here</span></h2>
    <div class="career-page-card">
      <div class="card-header">
        <h3 class="card-title"><a href="https://logelite.com/career/human-resource-executive/" class="card-title-link">Human Resource Executive</a></h3>
        <span class="card-status">Total Openings 1</span>
      </div>
      <div class="card-meta">
        <p class="card-meta-item">Lucknow</p>
        <p class="card-meta-item">Subject to Interview</p>
      </div>
      <p class="card-disc">We&#039;re looking for a dynamic Human Resource Executive to join our team and contribute to a positive work environment.</p>
      <a href="https://logelite.com/wp-content/uploads/2026/05/Human-Resource-Executive.pdf" class="apply-now-btn">
        <span class="text">Download Details</span>
      </a>
      <a href="https://logelite.com/job-apply/?apply_for=Human+Resource+Executive" class="apply-now-btn">
        <span class="text">Apply Now</span>
      </a>
    </div>
    <div class="career-page-card">
      <div class="card-header">
        <h3 class="card-title"><a href="https://logelite.com/career/seo-executive/" class="card-title-link">SEO Executive</a></h3>
        <span class="card-status">Total Openings 10</span>
      </div>
      <div class="card-meta">
        <p class="card-meta-item">Lucknow</p>
        <p class="card-meta-item">Subject to Interview</p>
      </div>
      <p class="card-disc">Logelite is calling a talented SEO Executive! If you think you are the right fit, don't miss this opportunity to join our team.</p>
      <a href="https://logelite.com/wp-content/uploads/2026/05/SEO-Executive.pdf" class="apply-now-btn">
        <span class="text">Download Details</span>
      </a>
      <a href="https://logelite.com/job-apply/?apply_for=SEO+Executive" class="apply-now-btn">
        <span class="text">Apply Now</span>
      </a>
    </div>
  </body>
</html>
`

test('Logelite historical short card previews and city-only labels cannot qualify current native roles or body-only reads', async () => {
  assert.equal(hasOfficialCareersSignal(careersHtml), false)
  assert.throws(() => extractJobCards(careersHtml), /publisher heading|native role grid/i)
  let reads = 0
  await assert.rejects(createLogeliteScraper().run({ fetchText: async () => { reads++; return careersHtml } }), /HTTP response metadata required/)
  assert.equal(reads, 0, 'A body-only callback cannot bypass original response provenance')
})

test('Logelite current factory replays all six original role/PDF documents through paired native closing reads', async () => {
  const fixture = JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/logelite-native-quality.json.gz', import.meta.url))))
  const packets = new Map(fixture.packets.map(packet => [packet.requestedURL, packet]))
  assert.equal(packets.size, 13)
  const requestedUrls = []

  const jobs = await createLogeliteScraper().run({
    minIntervalMs: 0,
    fetchImpl: async (url, init) => {
      requestedUrls.push(url)
      const packet = packets.get(url)
      assert.ok(packet, `Only genuine declared Logelite HTML/PDF entities: ${url}`)
      assert.equal(packet.replayed, false)
      const bytes = packet.bodyBase64 ? Buffer.from(packet.bodyBase64, 'base64') : Buffer.from(packet.bodyText)
      assert.equal(bytes.length, packet.bodyBytes)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.bodySHA256)
      assert.equal(init.method, 'GET')
      assert.equal(init.credentials, 'omit')
      assert.equal(init.redirect, 'manual')
      assert.equal(init.body, undefined)
      const response = new Response(bytes, { status: packet.status, headers: packet.headers })
      Object.defineProperty(response, 'url', { value: packet.finalURL })
      return response
    },
    now: () => '2026-11-06T12:00:00.000Z',
  })

  const phase = fixture.packets.map(packet => packet.requestedURL)
  assert.equal(phase[0], CAREERS_URL)
  assert.deepEqual(requestedUrls, [...phase, ...phase])
  assert.equal(jobs.length, 6)
  for (const job of jobs) {
    const original = fixture.pdfModels.find(model => model.url === job.nativeSourceRecord.listing.pdfURL).pdf
    assert.equal(job.company, COMPANY)
    assert.equal(job.source, SOURCE)
    assert.equal(job.nativePDFDescription, original.text)
    assert.ok(job.sourceDescription.endsWith(original.text) && job.sourceDescription.includes(original.pages[1].text))
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.nativeRoleClosingReconciled, true)
    assert.equal(job.country, 'India')
    assert.equal(job.sourceWorksiteCountryProof.literalRoleCountry, true)
    assert.equal(job.jobId, null)
    assert.equal(job.requisitionId, null)
    assert.equal(job.postingDate, null)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
    assert.equal(job.scrapedAt, '2026-11-06T12:00:00.000Z')
  }
  assert.ok(requestedUrls.every(url => !url.includes('/job-apply/')))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})
