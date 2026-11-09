import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'
import { withRetry, getRetryMetadata } from '../../scraper-support/utils/retry.js'
import { applyRetryPolicyToScraperError } from '../../scraper-support/runner.js'

import {
  CAREERS_URL,
  createTechtreeItSystemsScraper,
} from './script.js'

const HOMEPAGE_URL = 'https://www.techtreeit.com/'

const SUCURI_CHALLENGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>You are being redirected...</title>
  </head>
  <body>
    <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
    <script>
      var sucuri_cloudproxy_js = ''
    </script>
  </body>
</html>
`

test('Techtree It Systems fails when homepage and careers both match the Sucuri challenge shell', async () => {
  const requestedUrls = []

  await assert.rejects(createTechtreeItSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 307,
        url,
        html: SUCURI_CHALLENGE_HTML,
      }
    },
    fetchJson: async () => {
      throw new Error('Jobs API should not be called when the verified first-party surfaces are blocked')
    },
  }), error => error.code === 'careers-blocked' && error.diagnostics.listingComplete === false)

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    HOMEPAGE_URL,
  ])
})
import { enrichJobWithDetailJson, extractJobCards, isVerifiedCareersPage } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const role = 'https://www.techtreeit.com/jobs/ui-developer/'
const detail = { id: 12193, status: 'publish', type: 'awsm_job_openings', link: role,
  date: '2024-08-28T11:34:25', date_gmt: '2024-08-28T06:04:25', modified: '2026-10-20T15:00:00',
  title: { rendered: 'UI Developer' }, content: { rendered: '<p>Develop frontend features and accessible components. Experience 1 to 3 years.</p>' } }
const job = { postId: '12193', sourceUrl: role, title: 'UI Developer', locations: ['Mumbai, India'], location: 'Mumbai, India', city: 'Mumbai, India' }
const card = (location = 'Mumbai, India', url = role) => `<div class="awsm-job-listing-item awsm-list-item" id="awsm-list-item-12193"><div><div><h2 class="awsm-job-post-title"><a href="${url}">UI Developer</a></h2><div class="awsm-job-specification-job-location"><span class="awsm-job-specification-term">${location}</span></div></div></div></div>`
const careers = (html = card()) => `<title>Careers | TechTree IT System Pvt Ltd</title><h1>CAREERS</h1>All Job Category<div class="awsm-job-listings">${html}</div>More Details`
const page = { status: 200, url: CAREERS_URL, html: careers() }
const runFixture = (overrides = {}) => createTechtreeItSystemsScraper({ now: () => '2026-10-21T17:00:00.000Z' }).run({ fetchPage: async () => page, fetchJson: async () => detail, ...overrides })

test('HTTP 500 native careers HTML fails rather than becoming healthy inventory', async () => {
  assert.equal(isVerifiedCareersPage({ ...page, status: 500 }), false)
  await assert.rejects(runFixture({ fetchPage: async () => ({ ...page, status: 500 }) }), error => error.code === 'careers-unavailable' && error.diagnostics.status === 500)
})
test('official hostname without the exact careers path is rejected', () => {
  assert.equal(isVerifiedCareersPage({ ...page, url: HOMEPAGE_URL }), false)
})
test('upstream careers network failure preserves failure classification', async () => {
  await assert.rejects(runFixture({ fetchPage: async () => { throw Error('ETIMEDOUT') } }), error => error.code === 'careers-fetch-failed' && error.diagnostics.reason === 'ETIMEDOUT')
})
test('native publication GMT survives independently of the much newer modification and scrape clocks', () => {
  const output = enrichJobWithDetailJson(job, detail)
  assert.equal(output.postingDate, '2024-08-28T06:04:25.000Z')
  assert.equal(output.postedAt, '2024-08-28T06:04:25.000Z')
  assert.equal(output.nativeDate, '2024-08-28T11:34:25')
  assert.equal(output.nativeDateGmt, '2024-08-28T06:04:25')
  assert.equal(output.nativeModified, '2026-10-20T15:00:00')
  assert.equal(output.nativeStatus, 'publish')
  assert.equal(output.nativeId, 12193)
  assert.equal(output.nativeLink, role)
})
for (const [name, patch, code] of [
  ['missing publication cannot use modified or now', { date_gmt: null }, 'native-publication-missing'],
  ['invalid GMT date', { date_gmt: '2024-02-30T06:04:25' }, 'native-publication-invalid'],
  ['malformed GMT date', { date_gmt: 'yesterday' }, 'native-publication-invalid'],
  ['wrong native id', { id: 12190 }, 'native-identity-mismatch'],
  ['wrong native role link', { link: 'https://www.techtreeit.com/jobs/another/' }, 'native-identity-mismatch'],
  ['external native link', { link: 'https://example.com/jobs/ui-developer/' }, 'native-identity-mismatch'],
  ['wrong native title', { title: { rendered: 'Different role' } }, 'native-identity-mismatch'],
  ['draft native status', { status: 'draft' }, 'native-status-not-published'],
  ['missing native status', { status: null }, 'native-status-not-published'],
  ['wrong native type', { type: 'post' }, 'native-identity-mismatch'],
  ['empty native description', { content: { rendered: '<script>fake content</script>' } }, 'native-description-missing'],
]) test(name, () => {
  assert.throws(() => enrichJobWithDetailJson(job, { ...detail, ...patch }), error => error.code === code && error.diagnostics.nativeFields.modified === detail.modified)
})
test('ambiguous city-only country evidence is rejected without adding India', () => {
  const cards = extractJobCards(careers(card('Mumbai')))
  assert.equal(cards[0].location, 'Mumbai')
  assert.throws(() => enrichJobWithDetailJson({ ...job, locations: ['Mumbai'] }, detail), error => error.code === 'native-india-country-unproven')
})
test('explicit foreign and mixed locations cannot be relabeled India', () => {
  for (const locations of [['London, United Kingdom'], ['Mumbai, India', 'London, United Kingdom']]) {
    assert.throws(() => enrichJobWithDetailJson({ ...job, locations }, detail), error => error.code === 'native-india-country-unproven')
  }
})
test('external, credentialed and non-HTTPS card URLs cannot become role or apply targets', () => {
  for (const url of ['https://example.com/jobs/ui-developer/', 'http://www.techtreeit.com/jobs/ui-developer/', 'https://user@www.techtreeit.com/jobs/ui-developer/']) assert.deepEqual(extractJobCards(careers(card('Mumbai, India', url))), [])
})
test('detail HTTP failure never publishes an incomplete base job', async () => {
  await assert.rejects(runFixture({ fetchJson: async () => { throw Error('HTTP 500') } }), error => error.code === 'detail-extraction-failed' && error.diagnostics.failures[0].reason === 'HTTP 500' && error.diagnostics.failures[0].postId === '12193')
})
test('one failed detail cannot silently turn a partial set into a healthy result', async () => {
  await assert.rejects(runFixture({ fetchJson: async () => ({ ...detail, status: 'draft' }) }), error => error.code === 'detail-extraction-failed' && error.diagnostics.failures[0].code === 'native-status-not-published')
})
test('healthy observed role keeps explicit native India, publication and incomplete pagination evidence', async () => {
  const jobs = await runFixture()
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, '2024-08-28T06:04:25.000Z')
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].sourceCompanyCoverageComplete, false)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})
test('no inline cards is a parse/scope failure, never zero jobs', async () => {
  await assert.rejects(runFixture({ fetchPage: async () => ({ ...page, html: careers('<span class="awsm-job-post-title">broken</span>') }) }), error => error.code === 'careers-cards-missing')
})

test('a verified Sucuri challenge is a blocked source failure and does not repeat outer retries', async () => {
  let attempts = 0
  await assert.rejects(withRetry(async () => {
    attempts++
    return createTechtreeItSystemsScraper().run({
      fetchPage: async url => ({ status: 307, url, html: SUCURI_CHALLENGE_HTML }),
      fetchJson: async () => { throw Error('Blocked inventory must not query roles') },
    })
  }, { attempts: 4, baseDelayMs: 0, label: 'techtree-blocked-regression' }), error => {
    assert.equal(error.code, 'careers-blocked')
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied',
    })
    assert.equal(error.abortRetries, true)
    assert.equal(getRetryMetadata(error).attemptsUsed, 1)
    assert.equal(error.cause.diagnostics.status, 307)
    return true
  })
  assert.equal(attempts, 1)
})

for (const [status, kind, outage] of [
  [403, 'blocked_or_access_denied', true],
  [500, 'network_or_timeout', true],
  [404, 'surface_drift_or_fail_closed', false],
]) test(`native HTTP ${status} retains its upstream classification without inventing an inventory`, async () => {
  await assert.rejects(runFixture({ fetchPage: async () => ({ ...page, status }) }), error => {
    assert.equal(error.code, 'careers-unavailable')
    assert.equal(error.diagnostics.status, status)
    assert.equal(error.diagnostics.listingComplete, false)
    assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: outage, failureKind: kind })
    if (status === 500) assert.notEqual(error.abortRetries, true, 'Transient server errors remain retryable')
    return true
  })
})

test('a failed fetch preserves its original network cause and retry classification', async () => {
  const cause = Object.assign(new Error('Connect timed out'), { code: 'ETIMEDOUT' })
  await assert.rejects(runFixture({ fetchPage: async () => { throw cause } }), error => {
    assert.equal(error.cause, cause)
    assert.equal(error.code, 'careers-fetch-failed')
    assert.equal(error.diagnostics.reason, cause.message)
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: true, failureKind: 'network_or_timeout',
    })
    assert.notEqual(error.abortRetries, true)
    return true
  })
})

test('unexpected fetch programming errors remain hard and preserve their cause', async () => {
  const cause = new TypeError('Cannot read properties of undefined')
  await assert.rejects(runFixture({ fetchPage: async () => { throw cause } }), error => {
    assert.equal(error.cause, cause)
    assert.equal(classifyScraperError(error).softFailure, false)
    return true
  })
})

test('unrecognized successful HTML remains a surface gap and cannot become verified zero', async () => {
  await assert.rejects(runFixture({ fetchPage: async url => ({ status: 200, url, html: '<h1>Unrelated page</h1>' }) }), error => {
    assert.equal(error.code, 'careers-unavailable')
    assert.equal(error.diagnostics.companyCoverageComplete, false)
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed',
    })
    return true
  })
})

test('a temporary HTTP 429 can recover on the next runner attempt', async () => {
  let attempts = 0
  const decisions = []
  const jobs = await withRetry(async () => {
    attempts++
    try {
      return await runFixture({ fetchPage: async () => ({ ...page, status: attempts === 1 ? 429 : 200 }) })
    } catch (error) {
      const before = error.abortRetries
      const classified = applyRetryPolicyToScraperError(error)
      decisions.push({ status: error.diagnostics.status, before, after: classified.abortRetries })
      throw classified
    }
  }, { attempts: 2, baseDelayMs: 0, label: 'techtree-rate-limit-regression' })
  assert.equal(attempts, 2)
  assert.deepEqual(decisions, [{ status: 429, before: false, after: false }])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].postingDate, '2024-08-28T06:04:25.000Z')
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('runner retry policy honors an explicit retryable source decision', () => {
  const error = Object.assign(new Error('Temporary upstream rate limit'), {
    softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied', abortRetries: false,
  })
  assert.equal(applyRetryPolicyToScraperError(error).abortRetries, false)
})
