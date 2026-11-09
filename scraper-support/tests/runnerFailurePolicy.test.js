import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyRetryPolicyToScraperError,
  classifyScraperError,
  FatalScraperPersistenceError,
  formatIstTimestamp,
  isHardSourceFailure,
  isLatePuppeteerTargetClose,
  isLatePuppeteerWaitTimeout,
  isMongoStorageQuotaWriteBlockError,
} from '../runner.js'

test('formatIstTimestamp renders UTC instants in Asia/Kolkata with milliseconds and the IST suffix', () => {
  assert.equal(
    formatIstTimestamp(new Date('2026-08-09T09:58:13.441Z')),
    '2026-08-09 -- 15:28:13.441 IST',
  )
})

test('isLatePuppeteerTargetClose recognizes a Puppeteer session-close rejection', () => {
  const error = new Error('Protocol error (Network.setUserAgentOverride): Session closed. Most likely the page has been closed.')
  error.name = 'TargetCloseError'
  error.stack = 'TargetCloseError: Protocol error\n    at CdpCDPSession.send (puppeteer-core/lib/puppeteer/cdp/CdpSession.js:69:35)'

  assert.equal(isLatePuppeteerTargetClose(error), true)
})

test('isLatePuppeteerWaitTimeout recognizes a detached Puppeteer wait-task timeout', () => {
  const error = new Error('Timed out after waiting 10000ms')
  error.name = 'TimeoutError'
  error.stack = [
    'TimeoutError: Timed out after waiting 10000ms',
    '    at file:///repo/jobverify-backend/node_modules/puppeteer-core/lib/puppeteer/common/util.js:232:19',
    '    at file:///repo/jobverify-backend/node_modules/puppeteer-core/lib/third_party/rxjs/rxjs.js:1944:31',
  ].join('\n')

  assert.equal(isLatePuppeteerWaitTimeout(error), true)
  assert.equal(isLatePuppeteerWaitTimeout(new Error('Timed out after waiting 10000ms')), false)
})

test('isLatePuppeteerWaitTimeout still recognizes the Puppeteer timeout from the stack when the error name drifts', () => {
  const error = new Error('Timed out after waiting 10000ms')
  error.name = 'Error'
  error.stack = [
    'TimeoutError: Timed out after waiting 10000ms',
    '    at file:///repo/jobverify-backend/node_modules/puppeteer-core/lib/puppeteer/common/util.js:232:19',
    '    at file:///repo/jobverify-backend/node_modules/puppeteer-core/lib/third_party/rxjs/rxjs.js:1944:31',
  ].join('\n')

  assert.equal(isLatePuppeteerWaitTimeout(error), true)
})

test('isLatePuppeteerWaitTimeout recognizes a nested Puppeteer timeout cause under a generic wrapper', () => {
  const cause = new Error('Timed out after waiting 10000ms')
  cause.name = 'TimeoutError'
  cause.stack = [
    'TimeoutError: Timed out after waiting 10000ms',
    '    at file:///repo/jobverify-backend/node_modules/puppeteer-core/lib/puppeteer/common/util.js:232:19',
    '    at file:///repo/jobverify-backend/node_modules/puppeteer-core/lib/third_party/rxjs/rxjs.js:1944:31',
  ].join('\n')

  const error = new Error('Browser worker shutdown failed')
  error.cause = cause

  assert.equal(isLatePuppeteerWaitTimeout(error), true)
})

test('isMongoStorageQuotaWriteBlockError recognizes Atlas write-block errors through nested causes', () => {
  const cause = new Error(
    'you are over your space quota, using 521 MB of 512 MB. Writes are blocked on your cluster.',
  )
  const wrapped = new FatalScraperPersistenceError('wrapper', { cause })

  assert.equal(isMongoStorageQuotaWriteBlockError(cause), true)
  assert.equal(isMongoStorageQuotaWriteBlockError(wrapped), true)
  assert.equal(
    isMongoStorageQuotaWriteBlockError(new Error('connect ETIMEDOUT 159.41.206.100:27017')),
    false,
  )
})

test('runner ignores late unhandled rejections when they classify as upstream soft failures', async () => {
  const runner = await import('../runner.js')
  const dnsError = new Error('queryAaaa ENOTFOUND arjunaresearchandfinancialservices.in')
  dnsError.code = 'ENOTFOUND'

  assert.equal(typeof runner.shouldIgnoreUnhandledRejection, 'function')
  assert.equal(runner.shouldIgnoreUnhandledRejection(dnsError), true)
  assert.equal(
    runner.shouldIgnoreUnhandledRejection(new Error('Workday jobs API returned HTTP_500 at https://example.com/jobs')),
    true,
  )
  assert.equal(
    runner.shouldIgnoreUnhandledRejection(new TypeError('Cannot read properties of undefined')),
    false,
  )
})

test('hard-source diagnostic counts exclude upstream soft failures', () => {
  assert.equal(
    isHardSourceFailure({
      success: false,
      softFailure: true,
      upstreamOutage: true,
    }),
    false,
  )
})

test('classifyScraperError treats external drift and access errors as soft failures', () => {
  assert.deepEqual(
    classifyScraperError(new Error('Verified first-party surface changed materially')),
    {
      softFailure: true,
      upstreamOutage: false,
      failureKind: 'surface_drift_or_fail_closed',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('HTTP 403 for https://example.com/jobs')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'blocked_or_access_denied',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('Workday jobs API returned HTTP_500 at https://example.com/jobs')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('fetch failed')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    },
  )

  for (const message of [
    'HTTP 307 for https://www.winjit.com/',
    'Aress official careers page exposes no structured public job cards',
    'Unable to find Cornerstone OnDemand CSOD context in career page HTML',
    'Qbss first-party careers surface is now publicly enumerable and needs a structured scraper',
  ]) {
    assert.deepEqual(
      classifyScraperError(new Error(message)),
      {
        softFailure: true,
        upstreamOutage: false,
        failureKind: 'surface_drift_or_fail_closed',
      },
    )
  }
})

test('classifyScraperError normalizes the legacy upstream-unavailable contract', () => {
  const error = Object.assign(new Error('Current inventory is unavailable'), {
    failureType: 'upstream_unavailable',
  })

  assert.deepEqual(
    classifyScraperError(error),
    {
      softFailure: true,
      upstreamOutage: false,
      failureKind: 'upstream_unavailable',
    },
  )
})

test('classifyScraperError keeps parser and contract errors hard', () => {
  assert.deepEqual(
    classifyScraperError(new TypeError('Cannot read properties of undefined')),
    {
      softFailure: false,
      upstreamOutage: false,
      failureKind: 'parser_or_contract_error',
    },
  )
})

test('classifyScraperError recognizes remaining external and transient failure signatures', () => {
  assert.deepEqual(
    classifyScraperError(new Error('HTTP 406 for https://www.bfil.co.in/apply-for-job.php')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'blocked_or_access_denied',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('Execution context was destroyed, most likely because of a navigation.')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('net::ERR_FAILED at https://www.aindra.in/')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('HTTP 405 for https://globalcareers-lennox.icims.com/jobs/search?ss=1&in_iframe=1')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'blocked_or_access_denied',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('connect ETIMEDOUT 45.114.246.99:443')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('This operation was aborted')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error('unable to verify the first certificate; if the root CA is installed locally, try running Node.js with --use-system-ca')),
    {
      softFailure: true,
      upstreamOutage: true,
      failureKind: 'network_or_timeout',
    },
  )

  assert.deepEqual(
    classifyScraperError(new Error(
      'OdNest Company canonical first-party hosts now resolve; re-verify the official careers surface before trusting []',
    )),
    {
      softFailure: true,
      upstreamOutage: false,
      failureKind: 'surface_drift_or_fail_closed',
    },
  )
})

test('retryAfterMongoQuotaRecovery retries the blocked write after deleting expired jobs', async () => {
  const runner = await import('../runner.js')
  let writes = 0
  let purges = 0
  const quotaError = new Error(
    'you are over your space quota, using 521 MB of 512 MB. Writes are blocked on your cluster.',
  )

  const result = await runner.retryAfterMongoQuotaRecovery(
    async () => {
      writes += 1
      if (writes === 1) throw quotaError
      return 'persisted'
    },
    {
      purgeExpiredJobs: async () => {
        purges += 1
        return { deletedCount: 4, estimatedBytes: 10 * 1024 * 1024 }
      },
    },
  )

  assert.equal(result, 'persisted')
  assert.equal(writes, 2)
  assert.equal(purges, 1)
})

test('applyRetryPolicyToScraperError stops retries for definitive upstream soft failures', () => {
  const blockedError = new Error('HTTP 405 for https://globalcareers-lennox.icims.com/jobs/search?ss=1&in_iframe=1')
  const driftError = new Error('Akbar Travels verified India homepage no longer matches the known public surface')

  assert.deepEqual(applyRetryPolicyToScraperError(blockedError), Object.assign(blockedError, {
    softFailure: true,
    upstreamOutage: true,
    failureKind: 'blocked_or_access_denied',
    abortRetries: true,
  }))

  assert.deepEqual(applyRetryPolicyToScraperError(driftError), Object.assign(driftError, {
    softFailure: true,
    upstreamOutage: false,
    failureKind: 'surface_drift_or_fail_closed',
    abortRetries: true,
  }))
})

test('applyRetryPolicyToScraperError keeps transient network failures retriable', () => {
  const timeoutError = new Error('connect ETIMEDOUT 45.114.246.99:443')
  const classifiedError = applyRetryPolicyToScraperError(timeoutError)

  assert.equal(classifiedError, timeoutError)
  assert.equal(classifiedError.softFailure, true)
  assert.equal(classifiedError.upstreamOutage, true)
  assert.equal(classifiedError.failureKind, 'network_or_timeout')
  assert.equal(classifiedError.abortRetries, undefined)
})

test('classifyScraperError keeps runner-enforced source timeouts as local hard failures', () => {
  const timeoutError = new Error('[abb] timed out after 300000ms')
  timeoutError.localTimeout = true
  timeoutError.abortRetries = true
  timeoutError.failureKind = 'runner_timeout'

  assert.deepEqual(
    classifyScraperError(timeoutError),
    {
      softFailure: false,
      upstreamOutage: false,
      failureKind: 'runner_timeout',
    },
  )
})

test('hard-source diagnostic counts include ordinary source failures', () => {
  assert.equal(
    isHardSourceFailure({
      success: false,
      softFailure: false,
    }),
    true,
  )
})

test('hard-source diagnostic counts exclude successful and skipped runs', () => {
  assert.equal(isHardSourceFailure({ success: true }), false)
  assert.equal(isHardSourceFailure({ success: false, skipped: true }), false)
})


test('Workday maintenance HTML is classified as an upstream outage even inside a JSON error', () => {
  const error = new Error('Expected JSON from https://example.wd1.myworkdayjobs.com/wday/cxs/example/jobs/jobs but received HTML (Workday is currently unavailable.)')
  assert.deepEqual(classifyScraperError(error), {softFailure: true, upstreamOutage: true, failureKind: 'network_or_timeout'})
})

test('transaction aborts are operational database warnings through wrapped causes', () => {
  const cause = Object.assign(new Error('Transaction with { txnNumber: 195 } has been aborted.'), {
    name: 'MongoServerError', code: 251, errorLabels: ['TransientTransactionError'],
  })
  assert.deepEqual(classifyScraperError(new Error('persistence failed', { cause })), {
    softFailure: true, upstreamOutage: false, failureKind: 'database_unavailable',
  })
})

test('database recovery retries transient errors with bounded backoff and preserves code errors', async () => {
  const { retryAfterMongoQuotaRecovery } = await import('../runner.js')
  const delays = []
  let calls = 0
  const transient = Object.assign(new Error('transaction aborted'), { code: 251, name: 'MongoServerError' })
  const result = await retryAfterMongoQuotaRecovery(async () => {
    if (++calls < 3) throw transient
    return 'saved'
  }, { wait: async delay => delays.push(delay) })
  assert.equal(result, 'saved')
  assert.deepEqual(delays, [250, 500])
  calls = 0
  await assert.rejects(retryAfterMongoQuotaRecovery(async () => {
    calls++
    throw transient
  }, { wait: async () => {} }), error => error === transient)
  assert.equal(calls, 3)
  calls = 0
  const bug = new TypeError('invalid query construction')
  await assert.rejects(retryAfterMongoQuotaRecovery(async () => { calls++; throw bug }), error => error === bug)
  assert.equal(calls, 1)
})
