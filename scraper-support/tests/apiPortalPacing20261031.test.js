import assert from 'node:assert/strict'
import test from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../providers/apiPortalTemplates.js'
import { withRetry, getRetryMetadata } from '../utils/retry.js'
import { pacingProvider, pacingPayload, pacingHttpError } from './apiPortalPacing20261031.fixture.js'

test('explicit Eightfold configuration pageSize 10 remains 10 instead of being promoted', async () => {
  const provider = pacingProvider(undefined, { detail: false })
  provider.atsPlatform = 'eightfold'
  provider.config.pagination = { ...provider.config.pagination, strategy: 'offset-limit', pageSize: 10 }
  const jobs = await runApiPortalScraper({ provider, fetchJson: async url => {
    assert.equal(new URL(url).searchParams.get('limit'), '10')
    return pacingPayload(url)
  } })
  assert.deepEqual(jobs.map(job => job.jobId), ['one', 'two', 'three'])
  assert.equal(provider.config.pagination.pageSize, 10)
})

test('Eightfold template retains its effective default 50 while accepting an explicit option 10', async () => {
  for (const pageSize of [undefined, 10]) {
    const provider = expandApiPortalProviderTemplate({ source: 'pacing-eightfold', companyName: 'Pacing',
      companyCareerPage: 'https://careers.pacing.invalid/jobs', atsPlatform: 'eightfold', template: 'eightfold',
      templateOptions: { host: 'careers.pacing.invalid', domain: 'pacing.invalid', ...(pageSize == null ? {} : { pageSize }) } })
    await runApiPortalScraper({ provider, fetchJson: async url => {
      assert.equal(new URL(url).searchParams.get('limit'), pageSize == null ? '50' : '10')
      return { data: { positions: [], count: 0 } }
    } })
  }
})

test('concurrent detail workers reserve distinct paced request starts', async () => {
  const starts = []
  const jobs = await runApiPortalScraper({ provider: pacingProvider({ minimumIntervalMs: 40 }), fetchJson: async url => {
    starts.push({ url, at: performance.now() })
    return pacingPayload(url)
  } })
  assert.equal(jobs.length, 3)
  assert.equal(starts.length, 4)
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i].at - starts[i - 1].at >= 30, 'concurrent requests must remain at least 40 ms apart, allowing clock resolution')
})

test('a server Retry-After longer than the exponential cap is a minimum delay', async () => {
  const starts = []
  let failedAt
  const jobs = await runApiPortalScraper({ provider: pacingProvider({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 }, { detail: false }), fetchJson: async url => {
    starts.push(performance.now())
    if (starts.length === 1) { const error = pacingHttpError(url, 429, '0.08'); failedAt = performance.now(); throw error }
    return pacingPayload(url)
  } })
  assert.equal(jobs.length, 3)
  assert.equal(starts.length, 2)
  assert.ok(starts[1] - failedAt >= 65, '80 ms Retry-After must not be shortened to the 1 ms local cap')
})

test('a detail rate limit pauses queued peer details as well as its own retry', async () => {
  const events = [], counts = new Map()
  let rateLimitedAt
  const jobs = await runApiPortalScraper({ provider: pacingProvider({ minimumIntervalMs: 10, maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 }), fetchJson: async url => {
    const count = (counts.get(url) || 0) + 1
    counts.set(url, count)
    events.push({ url, at: performance.now() })
    if (url.endsWith('/one') && count === 1) {
      const error = pacingHttpError(url, 429, '0.08')
      rateLimitedAt = performance.now()
      throw error
    }
    return pacingPayload(url)
  } })
  assert.equal(jobs.length, 3)
  const peers = events.filter(event => /\/api\/job\/(two|three)$/.test(event.url))
  assert.equal(peers.length, 2)
  assert.ok(peers.every(event => event.at - rateLimitedAt >= 65), 'queued peers must observe the shared 80 ms server cooldown')
})

test('ordinary pacing spaces starts while preserving concurrent requests in flight', async () => {
  let active = 0, peak = 0
  const jobs = await runApiPortalScraper({ provider: pacingProvider({ minimumIntervalMs: 10 }), fetchJson: async url => {
    if (!url.endsWith('/api/jobs')) {
      peak = Math.max(peak, ++active)
      await sleep(80)
      active--
    }
    return pacingPayload(url)
  } })
  assert.equal(jobs.length, 3)
  assert.equal(peak, 3)
})

test('providers without a pacing policy retain concurrent details and do not add request retries', async () => {
  let active = 0, peak = 0, failedCalls = 0
  const provider = pacingProvider()
  const jobs = await runApiPortalScraper({ provider, fetchJson: async url => {
    if (!url.endsWith('/api/jobs')) { peak = Math.max(peak, ++active); await sleep(15); active-- }
    return pacingPayload(url)
  } })
  assert.equal(jobs.length, 3)
  assert.equal(peak, 3)
  await assert.rejects(runApiPortalScraper({ provider, fetchJson: async url => { failedCalls++; throw pacingHttpError(url) } }), error => error.status === 429)
  assert.equal(failedCalls, 1)
})

test('explicit request retry budgets cannot be multiplied by outer source retries', async () => {
  let calls = 0
  await assert.rejects(withRetry(() => runApiPortalScraper({ provider: pacingProvider({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 }, { detail: false }), fetchJson: async url => {
    calls++
    throw pacingHttpError(url)
  } }), { attempts: 3, baseDelayMs: 0, label: 'portal-budget-regression' }), error => {
    assert.equal(getRetryMetadata(error).attemptsUsed, 1)
    return true
  })
  assert.equal(calls, 2)
})

test('caller cancellation clears queued pacing slots before any detail starts', async t => {
  const controller = new AbortController(), reason = Error('cancel queued details'), calls = []
  let timer
  t.after(() => clearTimeout(timer))
  await assert.rejects(runApiPortalScraper({ signal: controller.signal, provider: pacingProvider({ minimumIntervalMs: 500 }), fetchJson: async url => {
    calls.push(url)
    if (calls.length === 1) timer = setTimeout(() => controller.abort(reason), 20)
    return pacingPayload(url)
  } }), error => error === reason)
  assert.equal(calls.length, 1)
})

test('caller cancellation interrupts Retry-After with the exact reason and no extra request', async t => {
  const controller = new AbortController(), reason = Error('cancel server cooldown')
  let calls = 0, timer
  t.after(() => clearTimeout(timer))
  await assert.rejects(runApiPortalScraper({ signal: controller.signal, provider: pacingProvider({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 }, { detail: false }), fetchJson: async url => {
    calls++
    if (calls === 1) { timer = setTimeout(() => controller.abort(reason), 20); throw pacingHttpError(url, 429, '5') }
    return pacingPayload(url)
  } }), error => error === reason)
  assert.equal(calls, 1)
})

for (const maxRetries of [Infinity, -1, 1.5]) test('invalid maxRetries ' + maxRetries + ' fails before issuing a request', async () => {
  let calls = 0
  await assert.rejects(runApiPortalScraper({ provider: pacingProvider({ maxRetries }, { detail: false }), fetchJson: async url => { calls++; return pacingPayload(url) } }), /rate.limit.*maxRetries/i)
  assert.equal(calls, 0)
})

test('unusable Retry-After values cannot overflow a timer into an immediate retry', async () => {
  let calls = 0
  await assert.rejects(runApiPortalScraper({ provider: pacingProvider({ maxRetries: 1, baseDelayMs: 1, maxDelayMs: 1 }, { detail: false }), fetchJson: async url => { calls++; throw pacingHttpError(url, 429, '2147484') } }), error => error.status === 429)
  assert.equal(calls, 1)
})

test('an exhausted portal rate-limit budget stops queued details after source failure', async () => {
  const calls = []
  await assert.rejects(runApiPortalScraper({ provider: pacingProvider({ minimumIntervalMs: 20, maxRetries: 0 }), fetchJson: async url => {
    calls.push(url)
    if (url.endsWith('/one')) throw pacingHttpError(url, 429, '5')
    return pacingPayload(url)
  } }), error => error.status === 429)
  await sleep(80)
  assert.deepEqual(calls, ['https://careers.pacing.invalid/api/jobs', 'https://careers.pacing.invalid/api/job/one'])
})

test('unconfigured portals retain the existing outer source retry behavior', async () => {
  let calls = 0
  const jobs = await withRetry(() => runApiPortalScraper({ provider: pacingProvider(undefined, { detail: false }), fetchJson: async url => {
    if (++calls === 1) throw pacingHttpError(url)
    return pacingPayload(url)
  } }), { attempts: 2, baseDelayMs: 0, label: 'unconfigured-portal-source-retry' })
  assert.equal(jobs.length, 3)
  assert.equal(calls, 2)
  assert.deepEqual(getRetryMetadata(jobs), { attemptsUsed: 2, retries: 1, retryDelayMs: 0 })
})
