import assert from 'node:assert/strict'
import {getEventListeners} from 'node:events'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

// Authored error/caller/clock diagnostics only. These controls contain no native
// response bodies, vacancy facts or live acquisition. The phase runner denies
// IO and substitutes only uncalled persistence module boundaries.
process.argv.push('--dry-run', '--parallel')
process.env.SCRAPER_CONCURRENCY = '1'
for (const key of ['SCRAPER_RAW_CAPTURE_DIRECTORY', 'PIPELINE_SUMMARY_FILE', 'SCRAPER_CHECKPOINT_FILE']) delete process.env[key]
const runner = await import('../scraper-support/runner.js')
for (const key of ['SCRAPER_RAW_CAPTURE_DIRECTORY', 'PIPELINE_SUMMARY_FILE', 'SCRAPER_CHECKPOINT_FILE']) delete process.env[key]
const {classifyScraperError} = await import('../scraper-support/utils/failureClassification.js')
const {withRetry} = await import('../scraper-support/utils/retry.js')
const {recoverSoftFailedRecruitment} = await import('../scraper-support/utils/softFailureRecruitmentRecovery.js')
const {recoverEmptyOnlyRecruitment} = await import('../scraper-support/utils/emptyOnlyRecruitmentRecovery.js')
const {readInventoryEvidence} = await import('../scraper-support/utils/inventoryEvidence.js')
const hard = {softFailure: false, upstreamOutage: false, failureKind: 'hard_failure'}
const reflect = async operation => {
  try { return {ok: true, value: await operation()} }
  catch (reason) { return {ok: false, reason} }
}
const exact = (result, reason) => {
  assert.equal(result.ok, false, 'caller cancellation must reject')
  assert.ok(Object.is(result.reason, reason), 'the original opaque caller reason must survive')
}
const reasonKinds = [
  ['null', () => null], ['false', () => false], ['zero', () => 0], ['empty', () => ''],
  ['frozen', () => Object.freeze(Object.assign(Error('Authored opaque caller'), {code: 'ECONNRESET'}))],
  ['default', () => AbortSignal.abort().reason],
]
const opaque = [
  ['null', () => null], ['undefined', () => undefined], ['false', () => false], ['zero', () => 0],
  ['empty', () => ''], ['symbol', () => Symbol('authored')], ['bigint', () => 1n],
  ['frozen record', () => Object.freeze({authoredOpaque: true})],
]
const descriptors = value => value !== null && (typeof value === 'object' || typeof value === 'function')
  ? Object.getOwnPropertyDescriptors(value) : null
const turn = () => new Promise(resolve => setImmediate(resolve))
const timers = () => process.getActiveResourcesInfo().filter(value => value === 'Timeout').length
const source = (name, run) => ({name, run, timeoutMs: 0, sourceLifecycleTimeoutMs: 1000, provider: {scraperRetryAttempts: 1}})

for (const [kind, makeValue] of opaque) test(`classifier keeps ${kind} hard without replacing or mutating the input`, () => {
  const value = makeValue(), before = descriptors(value)
  assert.deepEqual(classifyScraperError(value), hard)
  assert.equal(runner.applyRetryPolicyToScraperError(value), value)
  assert.deepEqual(descriptors(value), before)
})

const structured = [
  ['Mongo operational precedence', () => Object.assign(Error('Authored database error'), {code: 251, localTimeout: true, failureKind: 'parser_or_contract_error'}), {softFailure: true, upstreamOutage: false, failureKind: 'database_unavailable'}],
  ['local timeout precedence', () => Object.assign(Error('Authored HTTP 403'), {localTimeout: true, code: 'ENOENT', softFailure: true}), {softFailure: false, upstreamOutage: false, failureKind: 'runner_timeout'}],
  ['configuration precedence', () => Object.assign(Error('Authored HTTP 403 surface changed'), {code: 'ENOENT', softFailure: true}), {softFailure: false, upstreamOutage: false, failureKind: 'configuration_error'}],
  ['validated parser precedence', () => Object.assign(Error('Authored HTTP 403'), {failureKind: 'parser_or_contract_error'}), {softFailure: false, upstreamOutage: false, failureKind: 'parser_or_contract_error'}],
  ['access denial', () => Error('Authored HTTP 403'), {softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied'}],
  ['explicit coverage hold', () => Object.assign(Error('Authored closed inventory'), {softFailure: true, failureKind: 'coverage_gap'}), {softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap'}],
  ['ordinary parser text', () => TypeError('Authored parser is not a function'), {softFailure: false, upstreamOutage: false, failureKind: 'parser_or_contract_error'}],
]
for (const [kind, makeError, want] of structured) test(`classifier preserves ${kind}`, () => {
  const error = makeError(), before = descriptors(error)
  assert.deepEqual(classifyScraperError(error), want)
  assert.deepEqual(descriptors(error), before)
})

for (const [kind, makeValue] of opaque) test(`installed runner rejection handler retains exact hard ${kind}`, async () => {
  const value = makeValue(), before = descriptors(value)
  assert.equal(runner.shouldIgnoreUnhandledRejection(value), false)
  const handler = process[Symbol.for('jobverify.runner.unhandledRejectionHandler')]
  exact(await reflect(() => handler(value)), value)
  assert.deepEqual(descriptors(value), before)
})

test('ordinary retry null remains an Error with the exact null cause and hard classification', async () => {
  let calls = 0
  const result = await reflect(() => withRetry(async () => {calls++; throw null}, {attempts: 1, baseDelayMs: 0, label: 'authored-null'}))
  assert.equal(result.ok, false)
  assert.ok(result.reason instanceof Error)
  assert.equal(result.reason.cause, null)
  assert.deepEqual(classifyScraperError(result.reason), hard)
  assert.equal(calls, 1)
})

test('actual runScraper still reports an ordinary null source throw as a hard source failure', async () => {
  let calls = 0
  const result = await runner.runScraper(source('authored-ordinary-null', async () => {calls++; throw null}))
  assert.equal(result.success, false)
  assert.equal(result.failureKind, 'hard_failure')
  assert.equal(result.softFailure, false)
  assert.equal(result.retry.attemptsUsed, 1)
  assert.equal(calls, 1)
})

for (const [kind, makeReason] of reasonKinds) for (const stage of ['preabort', 'active']) {
  test(`actual runScraper ${stage} preserves exact caller ${kind} before diagnostics`, async () => {
    const caller = new AbortController(), reason = makeReason(), before = descriptors(reason), timerCount = timers()
    let calls = 0
    if (stage === 'preabort') caller.abort(reason)
    const result = await reflect(() => runner.runScraper(source('authored-caller-' + kind, async ({signal}) => {
      calls++
      caller.abort(reason)
      signal.throwIfAborted()
      throw Error('Caller abort must win')
    }), '', {signal: caller.signal}))
    exact(result, reason)
    assert.equal(calls, stage === 'preabort' ? 0 : 1)
    assert.deepEqual(descriptors(reason), before)
    assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
    await turn()
    assert.equal(timers(), timerCount)
  })
}

const checkpoint = () => {
  const state = {started: [], completed: [], finished: []}
  return {state, snapshot: () => ({createdAt: '2026-11-11T00:00:00.000Z'}), heartbeat() {},
    markSourceStarted(name) {state.started.push(name)}, markSourceCompleted(name) {state.completed.push(name)},
    finish(value) {state.finished.push(value)}}
}
for (const [kind, makeReason] of reasonKinds) test(`actual parallel runAll caller ${kind} keeps active and queued work pending`, async () => {
  const caller = new AbortController(), reason = makeReason(), before = descriptors(reason), cp = checkpoint(), started = [], timerCount = timers()
  const scrapers = [source('authored-active', async ({signal}) => {
    started.push('active'); caller.abort(reason); signal.throwIfAborted()
  }), source('authored-queued', async () => {started.push('queued'); throw Error('Queued source must not start')})]
  const summary = await runner.runAll({stopSignal: caller.signal, preparedRun: {scrapers, checkpoint: cp, summary: {}, resumeMessage: null}})
  assert.deepEqual(Object.keys(summary), [])
  assert.deepEqual(started, ['active'])
  assert.deepEqual(cp.state.started, ['authored-active'])
  assert.deepEqual(cp.state.completed, [])
  assert.equal(cp.state.finished.length, 1)
  assert.equal(cp.state.finished[0].interruptedBy, 'signal')
  assert.ok(Object.is(caller.signal.reason, reason))
  assert.deepEqual(descriptors(reason), before)
  assert.equal(getEventListeners(caller.signal, 'abort').length, 0)
  await turn()
  assert.equal(timers(), timerCount)
})

test('actual parallel pool continues after ordinary null and zero source failures', async () => {
  const cp = checkpoint(), started = []
  const scrapers = [source('authored-null', async () => {started.push('null'); throw null}), source('authored-zero', async () => {started.push('zero'); throw 0})]
  const summary = await runner.runAll({preparedRun: {scrapers, checkpoint: cp, summary: {}, resumeMessage: null}})
  assert.deepEqual(started, ['null', 'zero'])
  assert.deepEqual(cp.state.completed, ['authored-null', 'authored-zero'])
  assert.deepEqual(Object.keys(summary), ['authored-null', 'authored-zero'])
  for (const row of Object.values(summary)) {
    assert.equal(row.success, false)
    assert.equal(row.failureKind, 'hard_failure')
    assert.equal(row.softFailure, false)
  }
  assert.equal(cp.state.finished[0].interruptedBy, null)
})

const provider = {source: 'aandbglobal', adapter: 'script', modulePath: fileURLToPath(new URL('../scraper/aandbglobal/script.js', import.meta.url)), companyName: 'Authored diagnostic only', companyCareerPage: 'https://example.invalid/careers'}
test('soft recovery preserves an ordinary clock null as the original hard failure', async () => {
  const input = Object.assign(Error('Authored unknown profile'), {softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap'})
  let reads = 0, clocks = 0
  const result = await reflect(() => recoverSoftFailedRecruitment(input, provider, {softFailureRecovery: {
    now() {clocks++; throw null}, fetchPage: async () => {reads++; throw Error('No request may be admitted')},
  }}))
  exact(result, null)
  assert.equal(reads, 0)
  assert.equal(clocks, 1)
})
test('empty recovery classifies clock null as hard unavailable without creating an inventory', async () => {
  const jobs = []; let reads = 0, clocks = 0
  const result = await recoverEmptyOnlyRecruitment(jobs, provider, {emptyOnlyRecovery: {
    now() {clocks++; throw null}, fetchPage: async () => {reads++; throw Error('No request may be admitted')},
  }})
  assert.equal(result, jobs)
  assert.equal(result.length, 0)
  assert.equal(result.emptyOnlyRecruitmentRecovery.failureKind, 'hard_failure')
  assert.equal(result.emptyOnlyRecruitmentRecovery.softFailure, false)
  assert.equal(result.emptyOnlyRecruitmentRecovery.sourceScopeComplete, false)
  assert.equal(result.emptyOnlyRecruitmentRecovery.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(result).listingComplete, false)
  assert.equal(readInventoryEvidence(result).lifecycleCleanupAllowed, false)
  assert.equal(reads, 0)
  assert.equal(clocks, 1)
})
