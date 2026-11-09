import assert from 'node:assert/strict'
import test from 'node:test'
import { createVerifiedRecruitmentScraper, RECRUITMENT_OBSERVATIONS } from '../utils/verifiedRecruitment.js'
import { classifyScraperError } from '../utils/failureClassification.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test.beforeEach(t => {
  t.mock.method(globalThis, 'fetch', () => assert.fail('These diagnostic controls forbid live HTTP'))
})

const config = { source: 'diagnosticfixture', companyName: 'Example Diagnostics',
  companyCareerPage: 'https://example-diagnostics.test/careers/' }
const failedAttempt = async (fetchPage, overrides = {}) => {
  try {
    await createVerifiedRecruitmentScraper({ ...config, ...overrides }).run({ fetchPage, maxRequests: 5 })
  } catch (error) { return error }
  assert.fail('Expected the source attempt to fail')
}

for (const [status, kind] of [[403, 'blocked_or_access_denied'], [503, 'network_or_timeout']]) {
  test(`primary HTTP ${status} keeps its status and request diagnosis through existing message serialization`, async () => {
    const error = await failedAttempt(async url => ({ status, url, html: 'Unavailable' }))
    assert.equal(error.status, status)
    assert.equal(error.cause.status, status)
    assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: true, failureKind: kind })
    assert.equal(error.abortRetries, true)
    assert.equal(error.recruitmentObservations.requestCount, 1)
    assert.equal(error.recruitmentObservations.nativeRecords, 0)
    assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
    assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
    const serialized = JSON.parse(JSON.stringify({ error: error.message, failureKind: error.failureKind }))
    assert.match(serialized.error, /official-page/)
    assert.match(serialized.error, /example-diagnostics\.test\/careers\//)
    assert.match(serialized.error, new RegExp('HTTP ' + status))
    assert.equal(error.recruitmentObservations.failures[0].status, status)
  })
}

test('a primary nested network error retains its code and bounded cause instead of becoming a scope gap', async () => {
  const error = await failedAttempt(async () => {
    throw new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo failed'), { code: 'ENOTFOUND' }) })
  })
  assert.equal(error.code, 'ENOTFOUND')
  assert.equal(error.cause.cause.code, 'ENOTFOUND')
  assert.equal(classifyScraperError(error).failureKind, 'network_or_timeout')
  assert.equal(error.upstreamOutage, true)
  assert.equal(error.abortRetries, true)
  assert.equal(error.recruitmentObservations.receipts.length, 0)
  assert.match(error.message, /ENOTFOUND/)
  assert.match(JSON.stringify(error.recruitmentObservations.failures), /ENOTFOUND/)
})

test('successful HTML without qualified inventory remains a semantic coverage gap', async () => {
  const error = await failedAttempt(async url => ({ status: 200, url, html: '<h1>Careers</h1><p>Welcome</p>' }))
  assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap' })
  assert.equal(error.abortRetries, true)
  assert.equal(error.recruitmentObservations.failures.length, 0)
  assert.deepEqual(error.recruitmentObservations.unresolved, ['current-native-recruitment-contract-not-discovered'])
})

test('incompatible primary transport failure classes retain an explicit ambiguous coverage gap', async () => {
  const error = await failedAttempt(async url => ({ status: url.endsWith('/careers/') ? 403 : 503, url, html: 'Unavailable' }),
    { officialHomepageUrl: 'https://example-diagnostics.test/' })
  assert.equal(error.failureKind, 'coverage_gap')
  assert.equal(error.upstreamOutage, false)
  assert.equal(error.status, undefined)
  assert.equal(error.recruitmentObservations.failures.length, 2)
  assert.match(error.message, /HTTP 403/)
  assert.match(error.message, /HTTP 503/)
})

test('a successful entry beside a denied entry keeps the unresolved source as a coverage gap', async () => {
  const error = await failedAttempt(async url => ({
    status: url.endsWith('/careers/') ? 200 : 403, url, html: '<h1>Careers</h1><p>Welcome</p>',
  }), { officialHomepageUrl: 'https://example-diagnostics.test/' })
  assert.equal(error.failureKind, 'coverage_gap')
  assert.equal(error.upstreamOutage, false)
  assert.equal(error.status, undefined)
  assert.equal(error.abortRetries, true)
  assert.equal(error.recruitmentObservations.nativeRecords, 0)
  assert.deepEqual(error.recruitmentObservations.receipts.map(row => row.status), [200, 403])
  assert.equal(error.recruitmentObservations.sourceScopeComplete, false)
  assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed, false)
  assert.match(error.message, /HTTP 403/)
})

test('a qualified role beside an optional denied page stays useful and incomplete', async () => {
  const roleURL = 'https://example-diagnostics.test/careers/jobs/native-role'
  const deniedURL = 'https://example-diagnostics.test/careers/jobs/unavailable-role'
  const description = '<p>Design and operate production software services, investigate distributed system failures, review API contracts and collaborate with the engineering team on reliable delivery.</p>'
  const record = { '@type': 'JobPosting', identifier: { value: 'native-1' }, title: 'Software Engineer',
    hiringOrganization: { name: config.companyName }, url: roleURL, description,
    jobLocation: { address: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }, datePosted: '2026-10-30' }
  const jobs = await createVerifiedRecruitmentScraper(config).run({ fetchPage: async url => ({ url,
    status: url === deniedURL ? 403 : 200,
    html: url === deniedURL ? 'Denied' : url === roleURL
      ? '<h1>Software Engineer</h1>' + description + '<script type="application/ld+json">' + JSON.stringify(record) + '</script>'
      : '<h1>Careers</h1><a href="' + roleURL + '">Open job</a><a href="' + deniedURL + '">Other job</a>',
  }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDescription, description)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].failures[0].status, 403)
})

test('failure messages and causes are bounded and omit query secrets, payloads and headers', async () => {
  const secret = 'DO_NOT_PRINT_PRIVATE_VALUE'
  for (const message of ['fetch failed Authorization: Bearer ' + secret
    + ' https://user:' + secret + '@example-diagnostics.test/request?token=' + secret
    + ' {"password":"' + secret + '"} ' + 'x'.repeat(20000),
  'fetch failed Authorization: Bearer ' + secret + ' https://user:' + secret
    + '@example-diagnostics.test/request?token=' + secret,
  'fetch failed password=' + secret + ' Cookie: session=' + secret]) {
    const cause = Object.assign(new Error(message), { code: 'ENOTFOUND', headers: { Authorization: secret }, body: secret })
    let tail = cause
    for (let index = 0; index < 8; index++) tail = tail.cause = new Error(message)
    tail.cause = cause
    const error = await failedAttempt(async () => { throw cause },
      { companyCareerPage: config.companyCareerPage + '?token=' + secret })
    assert.equal(error.failureKind, 'network_or_timeout')
    assert.ok(error.message.length <= 1600)
    assert.doesNotMatch(error.message, new RegExp(secret))
    assert.doesNotMatch(JSON.stringify(error.recruitmentObservations.failures), new RegExp(secret))
    assert.doesNotMatch(JSON.stringify(error.recruitmentObservations.failures), /headers|password/)
    let depth = 0
    for (let current = error.cause; current; current = current.cause) {
      assert.ok(++depth <= 4, 'Retained causes must not preserve a cycle or unbounded chain')
      assert.doesNotMatch(current.message, new RegExp(secret))
      assert.equal(current.headers, undefined)
      assert.equal(current.body, undefined)
    }
  }
})

test('caller cancellation reasons survive before and during source requests', async () => {
  for (const during of [false, true]) {
    const controller = new AbortController(), reason = Object.freeze({ caller: during ? 'during-request' : 'before-request' })
    let requests = 0
    if (!during) controller.abort(reason)
    await assert.rejects(createVerifiedRecruitmentScraper(config).run({ signal: controller.signal,
      fetchPage: async () => {
        requests++
        controller.abort(reason)
        throw new TypeError('fetch failed')
      },
    }), error => error === reason)
    assert.equal(requests, during ? 1 : 0)
  }
})
