import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createVserveEbusinessSolutionsScraper,
  extractEmbeddedZohoPortalUrl,
  hasOfficialCareersSignal,
} from '../../scraper/vserveebusinesssolutions/script.js'

test('Vserve accepts the current eager first-party Zoho iframe and decodes its query string', () => {
  const html = `
    <title>Current Job Openings and Opportunities in Vserve Ebusiness Solutions</title>
    <link rel="canonical" href="https://vservesolution.com/careers/">
    <nav><a href="/careers/">Careers</a></nav><h1>Where Ambition Meets Opportunity.</h1>
    <a href="mailto:jobopenings@vservesolution.com">job inquiries</a>
    <iframe src="https://recruit.zoho.com/recruit/Portal.na?iframe=false&amp;digest=current-token"></iframe>
  `
  assert.equal(hasOfficialCareersSignal(html), true)
  assert.equal(extractEmbeddedZohoPortalUrl(html), 'https://recruit.zoho.com/recruit/Portal.na?iframe=false&digest=current-token')
})

test('Vserve does not trust an arbitrary iframe or company-shaped marketing page', () => {
  assert.equal(hasOfficialCareersSignal('<h1>Where Ambition Meets Opportunity.</h1><iframe src="https://evil.example/jobs"></iframe>'), false)
})

test('Vserve reports a typed blocked failure when the careers route serves HTTP 307', async () => {
  const redirectChallenge = Object.assign(
    new Error(`HTTP 307 for ${CAREERS_URL}`),
    { status: 307 },
  )
  const requestedUrls = []

  await assert.rejects(
    createVserveEbusinessSolutionsScraper().run({
      fetchText: async (url) => {
        requestedUrls.push(url)
        throw redirectChallenge
      },
    }),
    (error) => {
      assert.match(error.message, /Vserve Ebusiness Solutions careers route is currently blocked/i)
      assert.equal(error.cause, redirectChallenge)
      assert.equal(error.failureKind, 'blocked_or_access_denied')
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.deepEqual(requestedUrls, [CAREERS_URL])
})
