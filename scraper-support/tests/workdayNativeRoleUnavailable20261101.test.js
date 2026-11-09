import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { syncBuiltinESMExports } from 'node:module'
import nodeTest from 'node:test'
import { fileURLToPath } from 'node:url'
import { runWorkdayScraper, WorkdayHostCircuitBreaker } from '../myworkday/engine.js'
import { createNativeDetailRecovery, nativeDetailReceiptKey, rememberNativeDetailReceipt } from '../utils/nativeDetailRecovery.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

const test = (name, run) => nodeTest(name, { concurrency: false }, run)
// All URLs, roles and total=1 snapshots below are synthetic offline models.
// They assert a shared-engine contract, never current native company facts.
const source = 'native-status-contract', company = 'Synthetic Native Status Contract'
const baseUrl = 'https://native-status.wd5.myworkdayjobs.com/External'
const corporateUrl = 'https://native-status.example/careers'
const jobsApiUrl = 'https://native-status.wd5.myworkdayjobs.com/wday/cxs/native-status/External/jobs'
const rolePath = '/job/Bengaluru-India/Engineer_R-2298'
const roleUrl = baseUrl + rolePath
const detailUrl = jobsApiUrl.replace(/\/jobs$/, '') + rolePath
const scraperDir = fileURLToPath(new URL('../myworkday', import.meta.url))
const configFile = path.join(scraperDir, 'config.json')
const now = new Date('2026-11-01T21:21:01.461Z')
const description = '<p>Develop and maintain reliable enterprise software. Two years of professional software engineering experience required.</p>'
const profiles = ['proof', 'legacy', 'inferred']

async function exercise(t, { profile = 'legacy', mutate = () => {}, location = 'Bengaluru, India', cached = false, options = {}, handle = null } = {}) {
  const info = { title: 'Engineer', jobReqId: 'R-2298', jobPostingId: 'Engineer_R-2298', jobPostingSiteId: 'External',
    externalUrl: roleUrl, location: 'Bengaluru, India', country: { alpha2Code: 'IN' },
    jobDescription: description, startDate: '2026-10-21', endDate: '2026-11-30', posted: true, canApply: true }
  mutate(info)
  const payload = { jobPostingInfo: info }
  const inputBefore = JSON.stringify(payload)
  const listing = { total: 1, facets: [], jobPostings: [{ title: 'Engineer', externalPath: rolePath,
    locationsText: location, postedOn: 'Posted 30+ Days Ago', bulletFields: ['R-2298'] }] }
  const profileConfig = profile === 'inferred' ? {} : { listingStrategy: 'jobs-api', jobsApiUrl,
    detailUrlBase: baseUrl, locationCountry: null, searchText: '',
    ...(profile === 'proof' ? { inventoryScope: 'complete-board-country-proof', officialCareersUrl: corporateUrl } : {}) }
  const originalRead = fs.readFileSync
  const configMock = t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (String(file) === configFile) return JSON.stringify(profileConfig)
    return originalRead(file, ...args)
  })
  syncBuiltinESMExports()
  const calls = []
  const response = (url, body, type = 'application/json') => {
    const result = new Response(body, { headers: { 'content-type': type } })
    Object.defineProperty(result, 'url', { value: url })
    return result
  }
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = String(input), method = init.method || 'GET'
    calls.push({ url, method, signal: init.signal })
    if (handle) { const result = await handle({ url, method, init, calls, response, payload }); if (result !== undefined) return result }
    if (url === corporateUrl) return response(url, `<html><body><a href="${baseUrl}">Open positions</a></body></html>`, 'text/html')
    if (url === jobsApiUrl && method === 'POST') {
      if (profile === 'proof') assert.deepEqual(JSON.parse(init.body).appliedFacets, {})
      return response(url, JSON.stringify(listing))
    }
    if (url === detailUrl) return response(url, JSON.stringify(payload))
    if (url === roleUrl) return response(url, '<html><section data-automation-id="jobPostingDescription"><div><p>HTML fallback: develop reliable enterprise software with two years of experience.</p></div></section></html>', 'text/html')
    if (url.startsWith(baseUrl) && !url.includes('/job/')) return response(url, '<html><body>Workday careers</body></html>', 'text/html')
    assert.fail(`Unexpected request; external IO is prohibited: ${method} ${url}`)
  })
  let jobs, error, rejected = false
  const recovery = cached ? createNativeDetailRecovery() : null
  if (recovery) {
    const row = listing.jobPostings[0]
    const key = nativeDetailReceiptKey('workday', source, jobsApiUrl, roleUrl, row.title, location, row.postedOn, row.bulletFields)
    rememberNativeDetailReceipt(recovery, key, payload)
  }
  try {
    jobs = await runWorkdayScraper({ company, source, baseUrl, scraperDir,
      requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} }, requestTimeoutMs: 1000, retryBaseDelayMs: 0,
      circuitBreaker: new WorkdayHostCircuitBreaker(), detailCircuitBreaker: new WorkdayHostCircuitBreaker(),
      ...(recovery ? { nativeDetailRecovery: recovery } : {}), ...options })
  } catch (failure) { rejected = true; error = failure }
  finally { fetchMock.mock.restore(); configMock.mock.restore(); syncBuiltinESMExports() }
  assert.equal(JSON.stringify(payload), inputBefore)
  return { jobs, rejected, error, calls, recovery, input: payload }
}

const assertUnavailable = (result, field) => {
  const metrics = analyzePublishableJobs(result.jobs || [], { now })
  assert.equal(result.rejected, true, `Explicit ${field}:false emitted ${result.jobs?.length} rows/${metrics.eligibleJobs.length} eligible`)
  assert.equal(result.error?.code, 'WORKDAY_NATIVE_ROLE_UNAVAILABLE')
  assert.equal(result.error?.name, 'WorkdayNativeRoleUnavailableError')
  assert.equal(result.error?.abortRetries, true)
  assert.equal(result.error?.partial, true)
  assert.equal(result.error?.sourceScopeComplete, false)
  assert.equal(result.error?.sourceListingComplete, false)
  assert.equal(result.error?.lifecycleCleanupAllowed, false)
  assert.equal(result.error?.nativeStatus?.[field], false)
  assert.equal(result.jobs, undefined)
  assert.equal(readInventoryEvidence(result.jobs), null)
  assert.equal(metrics.eligibleJobs.length, 0)
  assert.equal(metrics.filterCounts.closed, 0, 'Unknown/unavailable is not a proven closure')
  assert.equal(result.calls.filter(call => call.url === roleUrl).length, 0, 'Unavailable native evidence cannot fall through to HTML')
}

for (const profile of profiles) {
  for (const field of ['posted', 'canApply']) {
    test(`${profile}: exact native ${field}:false cannot become eligible through structured details`, async t => {
      assertUnavailable(await exercise(t, { profile, mutate: info => { info[field] = false } }), field)
    })
    test(`${profile}: exact native ${field}:false with empty JD cannot fall through HTML or listing fallback`, async t => {
      assertUnavailable(await exercise(t, { profile, mutate: info => { info[field] = false; info.jobDescription = '' } }), field)
    })
  }
  for (const policy of ['true', 'absent', 'not-boolean-false']) {
    test(`${profile}: ${policy} native flags retain the existing positive/unknown policy and exact native dates`, async t => {
      const result = await exercise(t, { profile, mutate: info => {
        if (policy === 'absent') { delete info.posted; delete info.canApply }
        if (policy === 'not-boolean-false') { info.posted = 0; info.canApply = 'false' }
      } })
      assert.equal(result.rejected, false, result.error?.stack)
      assert.equal(result.jobs.length, 1)
      const job = result.jobs[0]
      assert.equal(job.title, 'Engineer')
      assert.equal(job.requisitionId, 'R-2298')
      assert.equal(job.link, roleUrl)
      assert.equal(job.sourceDetailComplete, true)
      assert.deepEqual(job.sourceRawDates, { startDate: '2026-10-21', endDate: '2026-11-30' })
      assert.equal(job.postingDatePrecision, 'calendar-date')
      assert.equal(job.sourcePostingDateIsExact, false)
      assert.equal(job.sourceClosingDateIsExact, false)
      assert.equal(analyzePublishableJobs(result.jobs, { now }).eligibleJobs.length, 1)
      assert.equal(result.calls.filter(call => call.url === roleUrl).length, 0)
    })
  }
}

for (const field of ['posted', 'canApply']) {
  test(`proof required-country receipt: ${field}:false rejects before country/detail completeness or closing zero`, async t => {
    assertUnavailable(await exercise(t, { profile: 'proof', location: 'Bengaluru', mutate: info => { info[field] = false } }), field)
  })
  for (const profile of ['legacy', 'inferred']) {
    test(`${profile} cached receipt: ${field}:false cannot bypass validation or initiate a replacement detail read`, async t => {
      const result = await exercise(t, { profile, cached: true, mutate: info => { info[field] = false } })
      assertUnavailable(result, field)
      assert.equal(result.calls.filter(call => call.url === detailUrl).length, 0)
    })
  }
}

for (const [field, mutate] of [
  ['requisition', info => { info.jobReqId = 'R-OTHER' }],
  ['title', info => { info.title = 'Another role' }],
  ['canonical', info => { info.externalUrl = roleUrl.replace('native-status.wd5', 'foreign.wd5') }],
]) {
  test(`explicit false cannot replace the existing mismatched ${field} diagnostic`, async t => {
    const result = await exercise(t, { mutate: info => { info.posted = false; mutate(info) } })
    assert.equal(result.rejected, true)
    assert.equal(result.error?.code, 'WORKDAY_NATIVE_ROLE_MISMATCH')
    assert.equal(result.calls.filter(call => call.url === roleUrl).length, 0)
  })
}

test('invalid provided native date retains its strict failure before false-state qualification', async t => {
  const result = await exercise(t, { mutate: info => { info.canApply = false; info.startDate = '2026-02-30' } })
  assert.equal(result.rejected, true)
  assert.equal(result.error?.code, 'WORKDAY_NATIVE_DATE_INVALID')
  assert.equal(result.calls.filter(call => call.url === roleUrl).length, 0)
})

test('invalid provided country retains its strict failure before false-state qualification', async t => {
  const result = await exercise(t, { profile: 'proof', mutate: info => { info.canApply = false; info.country = { alpha2Code: 'ZZ' } } })
  assert.equal(result.rejected, true)
  assert.equal(result.error?.code, 'WORKDAY_NATIVE_COUNTRY_MISMATCH')
})

test('unobserved flags do not impose a new native-open-proof requirement when optional detail is disabled', async t => {
  const result = await exercise(t, { mutate: info => { info.canApply = false }, options: { detailEnrichmentBudgetMs: 0 } })
  assert.equal(result.rejected, false)
  assert.equal(result.calls.filter(call => call.url === detailUrl).length, 0)
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].sourceDetailComplete, false)
  assert.equal(analyzePublishableJobs(result.jobs, { now }).eligibleJobs.length, 1)
})

test('caller pre-abort reasons remain exact and prevent every native read', async t => {
  for (const reason of [new Error('caller'), Object.freeze({ opaque: true }), 'opaque string', null, 0]) {
    const controller = new AbortController(); controller.abort(reason)
    const result = await exercise(t, { options: { signal: controller.signal } })
    assert.equal(result.rejected, true); assert.equal(result.error, reason); assert.equal(result.calls.length, 0)
  }
})

test('caller abort while receiving a false-state payload outranks the typed native failure with the exact frozen reason', async t => {
  const controller = new AbortController(), reason = Object.freeze({ opaque: 'during false-state read' })
  const result = await exercise(t, { options: { signal: controller.signal }, mutate: info => { info.canApply = false },
    handle: ({ url, response, payload }) => {
      if (url !== detailUrl) return
      controller.abort(reason)
      return response(url, JSON.stringify(payload))
    } })
  assert.equal(result.rejected, true)
  assert.equal(result.error, reason)
  assert.equal(result.calls.filter(call => call.url === roleUrl).length, 0)
})
