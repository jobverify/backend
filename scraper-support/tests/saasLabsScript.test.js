import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

import {
  CAREERS_URL,
  extractJobsFromListingHtml,
  hasKulaListingSignal,
  createSaaSLabsScraper,
} from '../../scraper/saaslabs/script.js'

const listingHtml = `
  <html>
    <head><title>Work at SaaS Labs | Careers for Innovators</title></head>
    <body>
      <h1>SaaS Labs Careers</h1>
      <h2>Open Positions</h2>
      <a href="/saas-labs/25493/">Principal Product Manager, AI</a>
      <span>Bengaluru, Karnataka, India</span>
      <span>Full Time - On-Site</span>
      <a href="/saas-labs/25538/">Sales Engineer - SaaS Labs</a>
      <span>Noida, Uttar Pradesh, India</span>
      <span>Full Time - On-Site</span>
    </body>
  </html>
`

test('recognizes the verified SaaS Labs Kula listing surface', () => {
  assert.equal(hasKulaListingSignal(listingHtml), true)
})

test('extracts India SaaS Labs positions from Kula listing HTML', () => {
  assert.deepEqual(extractJobsFromListingHtml(listingHtml), [
    {
      title: 'Principal Product Manager, AI',
      company: 'SaaS Labs',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      source: 'saaslabs',
      sourceUrl: 'https://careers.kula.ai/saas-labs/25493/',
      applyUrl: 'https://careers.kula.ai/saas-labs/25493/',
      jobId: '25493',
      requisitionId: '25493',
      employmentType: 'Full Time',
      remoteStatus: 'On-site',
      atsPlatform: 'kula',
    },
    {
      title: 'Sales Engineer - SaaS Labs',
      company: 'SaaS Labs',
      location: 'Noida, Uttar Pradesh, India',
      city: 'Noida',
      country: 'India',
      source: 'saaslabs',
      sourceUrl: 'https://careers.kula.ai/saas-labs/25538/',
      applyUrl: 'https://careers.kula.ai/saas-labs/25538/',
      jobId: '25538',
      requisitionId: '25538',
      employmentType: 'Full Time',
      remoteStatus: 'On-site',
      atsPlatform: 'kula',
    },
  ])
})

test('uses the card title when Kula places Apply Now inside the detail link', () => {
  const html = listingHtml.replace(
    '<a href="/saas-labs/25493/">Principal Product Manager, AI</a>',
    '<p>Principal Product Manager, AI</p><a href="/saas-labs/25493/">Apply Now</a>',
  )

  assert.equal(extractJobsFromListingHtml(html)[0].title, 'Principal Product Manager, AI')
})

test('scraper recovers the authentic native India records while keeping source scope unverified', async () => {
  const archive = JSON.parse(gunzipSync(readFileSync(
    new URL('../../scraper/saaslabs/fixtures/retained-http-20261029.json.gz', import.meta.url),
  )))
  const html = Buffer.from(archive.bodyBase64, 'base64').toString('utf8')
  const requestedUrls = [], audits = []
  const jobs = await createSaaSLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url !== archive.receipt.url) throw Error('Native application not retained in this listing-only archive')
      return html
    },
    onAudit: audit => audits.push(audit),
  })

  assert.equal(requestedUrls[0], CAREERS_URL)
  assert.equal(requestedUrls.length, 18)
  assert.equal(jobs.length, 17)
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === false))
  assert.ok(jobs.every(job => job.sourceListingDescriptionComplete === true && job.sourceNativeCriteriaCopyComplete === false))
  assert.deepEqual(new Set(requestedUrls.slice(1)), new Set(jobs.map(job => job.applyUrl)))
  assert.ok(jobs.every(job => job.jobDescription && job.sourceNativeDescription))
  assert.equal(audits.length, 1)
  assert.equal(audits[0].originalNativeHTML, html)
  assert.equal(audits[0].nativeRecords.length, 17)
  assert.equal(audits[0].currentLiveQualification, false)
  assert.equal(audits[0].lifecycleCleanupAllowed, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.firstParty, false)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})
