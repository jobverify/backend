import assert from 'node:assert/strict'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'

const { runScraperWithTimeout, withSourceLifecycleTimeout } = await import('../runner.js')
const { createCatalogScraper, getScraperCatalog } = await import('../providers/index.js')
const provider = getScraperCatalog().find(row => row.source === 'cognex')
assert.ok(provider)
const makeSource = () => createCatalogScraper(provider)
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const observed = promise => promise.then(value => ({ rejected: false, value }), error => ({ rejected: true, error }))
const flush = async () => { for (let i = 0; i < 6; i++) await setImmediate() }
const within = async (promise, ms) => { let timer; try { return await Promise.race([promise.then(result => ({ settled: true, result })), new Promise(resolve => { timer = setTimeout(() => resolve({ settled: false }), ms) })]) } finally { clearTimeout(timer) } }
const input = kind => {
  let reads = 0
  const trap = Object.freeze(new Error('Opaque caller reason getter was inspected'))
  const reason = kind === 'Error' ? Object.freeze(new Error('controlled caller')) : kind === 'null' ? null : kind === 'zero' ? 0 : kind === 'false' ? false : kind === 'empty' ? ''
    : Object.freeze(Object.defineProperties(Object.create(null), Object.fromEntries(['abortPipeline', 'persistenceBlocked', 'cause', 'message', 'name', 'code'].map(key => [key, { get() { reads++; throw trap } }]))))
  return { reason, reads: () => reads, trap }
}
const report = row => console.log('RUNNER_ABORT_OBSERVATION ' + JSON.stringify(row))

for (const stage of ['headers', 'body']) for (const kind of ['Error', 'null', 'zero', 'false', 'empty', 'opaque']) {
  test(`actual runner ${stage}/${kind}: caller is bounded, same-shard admission stays held, no late semantic reads`, async t => {
    const caller = new AbortController(), request = deferred(), started = deferred(), bodyStarted = deferred(), item = input(kind)
    const counters = { fetches: 0, activeSlots: 0, releases: 0, lateStatus: 0, lateHeaders: 0, lateBodyStarts: 0, lateOk: 0, lateUrl: 0, cancels: 0, peerStarts: 0 }
    let aborted = false
    const headers = { get: name => { if (aborted) counters.lateHeaders++; return name.toLowerCase() === 'content-type' ? 'text/html' : null } }
    const response = { get status() { if (aborted) counters.lateStatus++; return 200 }, get ok() { if (aborted) counters.lateOk++; return true },
      get url() { if (aborted) counters.lateUrl++; return 'https://www.cognex.com/en/company/careers' }, headers,
      body: { cancel: async () => { counters.cancels++ } }, text: async () => { if (aborted) counters.lateBodyStarts++; bodyStarted.resolve(); return stage === 'body' ? request.promise : '<html><body>Controlled aborted response</body></html>' } }
    t.mock.method(globalThis, 'fetch', async () => { counters.fetches++; started.resolve(); return stage === 'headers' ? request.promise : response })
    const registered = makeSource()
    const firstSource = { ...registered, run: options => registered.run({ ...options, nativeDetailRecovery: false, requestTimeoutMs: 1000, retryBaseDelayMs: 0,
      requestScheduler: { acquire: async () => { counters.activeSlots++; return () => { counters.activeSlots--; counters.releases++ } }, recordRateLimit() {} } }) }
    const first = observed(runScraperWithTimeout(firstSource, 1000, { nativeDetailRecovery: false, signal: caller.signal, abortGraceMs: 10, admissionTimeoutMs: 1000 }))
    const tasks = [first]
    let outcome, shortResult, held, afterDrain, lateReads
    try {
      await started.promise
      if (stage === 'body') await bodyStarted.promise
      const queued = name => ({ ...registered, name, run: async () => { counters.peerStarts++; return [] } })
      const short = observed(runScraperWithTimeout(queued('controlled-queue-deadline'), 1000, { nativeDetailRecovery: false, abortGraceMs: 10, admissionTimeoutMs: 30 }))
      const long = observed(runScraperWithTimeout(queued('controlled-after-drain'), 1000, { nativeDetailRecovery: false, abortGraceMs: 10, admissionTimeoutMs: 1000 }))
      tasks.push(short, long)
      aborted = true; caller.abort(item.reason)
      outcome = await within(first, 150)
      shortResult = await short
      held = { activeSlots: counters.activeSlots, peerStarts: counters.peerStarts, sourceSettled: outcome.settled }
      request.resolve(stage === 'headers' ? response : '<html><body>Controlled aborted response</body></html>')
      await Promise.all(tasks); await flush()
      lateReads = counters.lateStatus + counters.lateHeaders + counters.lateBodyStarts + counters.lateOk + counters.lateUrl
      afterDrain = { ...counters }
      report({ stage, kind, settledWithin150ms: outcome.settled, exactReason: outcome.result?.error === item.reason,
        reasonGetterReads: item.reads(), held, queueErrorCode: shortResult.error?.code, queueErrorPhase: shortResult.error?.phase,
        afterDrain, lateSemanticReads: lateReads, nativeHTTP: 0 })
      assert.equal(outcome.settled, true)
      assert.equal(held.activeSlots, 1); assert.equal(held.peerStarts, 0)
      assert.equal(shortResult.rejected, true); assert.equal(shortResult.error?.code, 'WORKDAY_SOURCE_ADMISSION_TIMEOUT'); assert.equal(shortResult.error?.phase, 'queue')
      assert.equal(afterDrain.activeSlots, 0); assert.equal(afterDrain.releases, 1); assert.equal(afterDrain.peerStarts, 1)
      assert.equal(outcome.result.rejected, true); assert.equal(outcome.result.error, item.reason)
      assert.equal(item.reads(), 0); assert.equal(lateReads, 0)
    } finally {
      request.resolve(stage === 'headers' ? response : '<html><body>Controlled aborted response</body></html>')
      await Promise.allSettled(tasks); await flush()
    }
  })
}

for (const kind of ['Error', 'null', 'zero', 'false', 'empty', 'opaque']) test(`actual runner cooperative/${kind}: exact caller reason bypasses opaque fatal scanning`, async t => {
  const caller = new AbortController(), started = deferred(), item = input(kind)
  let active = 0, released = 0
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => new Promise((resolve, reject) => {
    started.resolve(); signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  const registered = makeSource(), scraper = { ...registered, run: options => registered.run({ ...options, requestTimeoutMs: 1000,
    requestScheduler: { acquire: async () => { active++; return () => { active--; released++ } }, recordRateLimit() {} } }) }
  const operation = observed(runScraperWithTimeout(scraper, 1000, { signal: caller.signal, nativeDetailRecovery: false, abortGraceMs: 30, admissionTimeoutMs: 1000 }))
  await started.promise; caller.abort(item.reason)
  const outcome = await within(operation, 150)
  await operation; await flush()
  report({ stage: 'cooperative', kind, settledWithin150ms: outcome.settled, exactReason: outcome.result?.error === item.reason, reasonGetterReads: item.reads(), activeSlots: active, releases: released })
  assert.equal(outcome.settled, true); assert.equal(outcome.result.rejected, true); assert.equal(outcome.result.error, item.reason)
  assert.equal(item.reads(), 0); assert.equal(active, 0); assert.equal(released, 1)
})

test('actual runner post-acquire abort does not invoke fetch', async t => {
  const caller = new AbortController(), reason = Object.freeze(new Error('abort at acquired request slot'))
  let fetches = 0, releases = 0
  t.mock.method(globalThis, 'fetch', async () => { fetches++; return { status: 200, ok: true, headers: { get: () => 'text/html' }, url: 'https://www.cognex.com/en/company/careers', text: async () => '<html></html>' } })
  const registered = makeSource(), scraper = { ...registered, run: options => registered.run({ ...options,
    requestScheduler: { acquire: async () => { caller.abort(reason); return () => { releases++ } }, recordRateLimit() {} } }) }
  const outcome = await observed(runScraperWithTimeout(scraper, 1000, { signal: caller.signal, nativeDetailRecovery: false, abortGraceMs: 10, admissionTimeoutMs: 1000 }))
  await flush()
  report({ stage: 'post-acquire', exactReason: outcome.error === reason, fetches, releases })
  assert.equal(outcome.error, reason); assert.equal(fetches, 0); assert.equal(releases, 1)
})

test('actual runner distinct genuine fatal cleanup retains precedence over caller cancellation', async () => {
  const caller = new AbortController(), reason = input('opaque'), started = deferred()
  const fatal = Object.assign(new Error('controlled genuine fatal cleanup'), { abortPipeline: true })
  const registered = makeSource(), scraper = { ...registered, run: ({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(fatal), { once: true }); started.resolve()
  }) }
  const operation = observed(runScraperWithTimeout(scraper, 1000, { signal: caller.signal, nativeDetailRecovery: false, abortGraceMs: 30, admissionTimeoutMs: 1000 }))
  await started.promise; caller.abort(reason.reason)
  const outcome = await operation
  report({ stage: 'distinct-fatal-cleanup', exactFatal: outcome.error === fatal, reasonGetterReads: reason.reads() })
  assert.equal(outcome.error, fatal); assert.equal(reason.reads(), 0)
})

test('actual runner pre-abort Error,null,zero,opaque starts no source or fetch', async t => {
  let fetches = 0
  t.mock.method(globalThis, 'fetch', async () => { fetches++; throw Error('must not run') })
  for (const kind of ['Error', 'null', 'zero', 'false', 'empty', 'opaque']) {
    const caller = new AbortController(), item = input(kind); caller.abort(item.reason)
    const outcome = await observed(runScraperWithTimeout(makeSource(), 1000, { signal: caller.signal, nativeDetailRecovery: false, abortGraceMs: 10, admissionTimeoutMs: 1000 }))
    assert.equal(outcome.rejected, true); assert.equal(outcome.error, item.reason); assert.equal(item.reads(), 0)
  }
  assert.equal(fetches, 0)
})

// These controls catch reason replacement, a null timeout sentinel collision,
// and releasing scheduler/admission before late-response disposal really settles.
const { fetchWorkdayJobsApiPage, WorkdayRequestTimeoutError } = await import('../myworkday/engine.js')

for (const kind of ['Error', 'null', 'zero', 'false', 'empty', 'opaque']) {
  test(`actual source lifecycle/${kind}: parent cancellation is not a timeout result or inspected fatal reason`, async () => {
    const caller = new AbortController(), item = input(kind), started = deferred()
    const operation = observed(withSourceLifecycleTimeout({ name: 'controlled-lifecycle' }, ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        if (kind === 'opaque') reject(signal.reason)
        else resolve({ success: false, failureKind: 'controlled-cleanup-result' })
      }, { once: true })
      started.resolve()
    }), 1000, { signal: caller.signal, abortGraceMs: 30 }))
    await started.promise; caller.abort(item.reason)
    const outcome = await operation
    assert.equal(outcome.rejected, true); assert.equal(outcome.error, item.reason); assert.equal(item.reads(), 0)
  })
}

for (const scope of ['source-pass', 'source-lifecycle']) {
  test(`actual ${scope}: nonfatal cleanup cause equal to opaque caller is never inspected`, async () => {
    const caller = new AbortController(), item = input('opaque'), started = deferred()
    const run = ({ signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('ordinary cleanup wrapper', { cause: signal.reason })), { once: true })
      started.resolve()
    })
    const pending = scope === 'source-pass'
      ? runScraperWithTimeout({ ...makeSource(), run }, 1000, { signal: caller.signal, nativeDetailRecovery: false, abortGraceMs: 30, admissionTimeoutMs: 1000 })
      : withSourceLifecycleTimeout({ name: 'controlled-lifecycle-cause' }, run, 1000, { signal: caller.signal, abortGraceMs: 30 })
    const operation = observed(pending)
    await started.promise; caller.abort(item.reason)
    const outcome = await operation
    assert.equal(outcome.rejected, true); assert.equal(outcome.error, item.reason); assert.equal(item.reads(), 0)
  })
}

for (const disposal of ['fulfilled', 'rejected']) {
  test(`actual runner late response/${disposal}: disposal settlement owns the request slot and admission`, async t => {
    const caller = new AbortController(), item = input('opaque'), fetchGate = deferred(), started = deferred(), cancelStarted = deferred(), cancelGate = deferred()
    cancelGate.promise.catch(() => {}) // Baseline may never request disposal; still drain/observe this owned gate.
    let active = 0, releases = 0, peerStarts = 0, cancels = 0, reads = 0, nativeSettled = false, fetches = 0
    const response = {
      get status() { reads++; return 200 }, get ok() { reads++; return true }, get url() { reads++; return 'https://www.cognex.com/en/company/careers' },
      headers: { get() { reads++; return 'text/html' } }, text: async () => { reads++; return '<html>controlled aborted response</html>' },
      body: { cancel() { cancels++; cancelStarted.resolve(); return cancelGate.promise } },
    }
    t.mock.method(globalThis, 'fetch', async () => { fetches++; started.resolve(); return fetchGate.promise })
    const registered = makeSource()
    const scraper = { ...registered, run: options => {
      const pending = registered.run({ ...options, requestTimeoutMs: 1000, requestScheduler: {
        acquire: async () => { active++; return () => { active--; releases++ } }, recordRateLimit() {},
      } })
      pending.then(() => { nativeSettled = true }, () => { nativeSettled = true })
      return pending
    } }
    const first = observed(runScraperWithTimeout(scraper, 1000, { signal: caller.signal, nativeDetailRecovery: false, abortGraceMs: 10, admissionTimeoutMs: 1000 }))
    const tasks = [first]
    try {
      await started.promise
      const peer = observed(runScraperWithTimeout({ ...registered, run: async () => { peerStarts++; return [] } }, 1000,
        { nativeDetailRecovery: false, admissionTimeoutMs: 1000 }))
      tasks.push(peer)
      caller.abort(item.reason)
      const publicOutcome = await within(first, 150)
      assert.equal(publicOutcome.settled, true); assert.equal(publicOutcome.result.error, item.reason)
      fetchGate.resolve(response)
      const cancellation = await within(cancelStarted.promise, 40)
      const held = { active, releases, peerStarts, nativeSettled }
      if (disposal === 'rejected') cancelGate.reject(Object.freeze(new Error('controlled disposal rejection')))
      else cancelGate.resolve()
      await Promise.all(tasks); await flush()
      assert.equal(cancellation.settled, true)
      assert.deepEqual(held, { active: 1, releases: 0, peerStarts: 0, nativeSettled: false })
      assert.equal(active, 0); assert.equal(releases, 1); assert.equal(peerStarts, 1); assert.equal(nativeSettled, true)
      assert.equal(fetches, 1); assert.equal(cancels, 1); assert.equal(reads, 0); assert.equal(item.reads(), 0)
    } finally {
      fetchGate.resolve(response); cancelGate.resolve()
      await Promise.allSettled(tasks); await flush()
    }
  })
}

const page = options => fetchWorkdayJobsApiPage({
  jobsApiUrl: 'https://checkpoint.wd988.myworkdayjobs.com/wday/cxs/checkpoint/External/jobs',
  appliedFacets: {}, offset: 0, retryBaseDelayMs: 0,
  circuitBreaker: { assertRequestAllowed() {}, recordSuccess() {}, recordFailure() {} },
  ...options,
})

for (const stage of ['headers', 'body']) {
  test(`actual Workday local timeout/${stage}: direct engine waits for owned IO then rejects its original deadline`, async t => {
    const started = deferred(), bodyStarted = deferred(), gate = deferred(), timedOut = deferred()
    let fetches = 0, releases = 0, active = 0, settled = false, requestSignal, afterAbortReads = 0, cancels = 0
    const response = {
      get status() { if (requestSignal.aborted) afterAbortReads++; return 200 },
      get ok() { if (requestSignal.aborted) afterAbortReads++; return true },
      headers: { get() { if (requestSignal.aborted) afterAbortReads++; return 'application/json' } },
      body: { cancel: async () => { cancels++ } },
      json: async () => { if (requestSignal.aborted) afterAbortReads++; bodyStarted.resolve(); return stage === 'body' ? gate.promise : { total: 0, jobPostings: [] } },
    }
    t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
      fetches++; requestSignal = signal
      signal.addEventListener('abort', () => timedOut.resolve(signal.reason), { once: true })
      started.resolve()
      return stage === 'headers' ? gate.promise : response
    })
    const pending = observed(page({ requestTimeoutMs: 10, requestScheduler: {
      acquire: async () => { active++; return () => { active--; releases++ } }, recordRateLimit() {},
    } }))
    pending.then(() => { settled = true })
    try {
      await started.promise
      if (stage === 'body') await bodyStarted.promise
      const originalDeadline = await timedOut.promise
      await flush()
      assert.equal(settled, false); assert.equal(active, 1); assert.equal(releases, 0)
      gate.resolve(stage === 'headers' ? response : { total: 0, jobPostings: [] })
      const outcome = await pending
      assert.equal(outcome.rejected, true); assert.equal(outcome.error, originalDeadline)
      assert.ok(outcome.error instanceof WorkdayRequestTimeoutError)
      assert.equal(outcome.error.abortRetries, true); assert.equal(outcome.error.failureKind, 'network_or_timeout')
      assert.equal(outcome.error.requestTimeoutMs, 10)
      assert.equal(fetches, 1); assert.equal(active, 0); assert.equal(releases, 1); assert.equal(cancels, 1); assert.equal(afterAbortReads, 0)
    } finally {
      gate.resolve(stage === 'headers' ? response : { total: 0, jobPostings: [] })
      await pending
    }
  })
}

test('actual Workday ordinary success and noncaller failure retain payload, error identity and release semantics', async t => {
  let fetches = 0, releases = 0, cancels = 0
  const payload = { total: 0, jobPostings: [] }
  const ordinary = Object.freeze(new Error('controlled nonretryable ordinary failure'))
  t.mock.method(globalThis, 'fetch', async () => {
    fetches++
    if (fetches === 2) throw ordinary
    return { status: 200, ok: true, headers: { get: () => 'application/json' }, json: async () => payload, body: { cancel: async () => { cancels++ } } }
  })
  const options = { requestTimeoutMs: 1000, requestScheduler: { acquire: async () => () => { releases++ }, recordRateLimit() {} } }
  assert.deepEqual(await page(options), payload)
  const failure = await observed(page(options))
  assert.equal(failure.rejected, true); assert.equal(failure.error, ordinary)
  assert.equal(fetches, 2); assert.equal(releases, 2); assert.equal(cancels, 0)
})
