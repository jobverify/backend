import assert from 'node:assert/strict'
import test from 'node:test'
import { extractionFailureDetails } from '../scripts/catalogExtractionFailureEvidence.js'
import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'

const wrapped = nativeEvidence => Object.assign(new Error('Arrow native collection incomplete; cleanup forbidden'), { nativeEvidence })

test('native packet nested cause survives the misleading cleanup wrapper', () => {
  const failure = { name: 'TypeError', message: 'fetch failed', cause: { name: 'ConnectTimeoutError', message: 'Connect Timeout Error', code: 'UND_ERR_CONNECT_TIMEOUT' } }
  const result = extractionFailureDetails(wrapped({ failures: [{ stage: 'listing', message: 'Arrow native transport: fetch failed' }], transportPackets: [{ status: null, failure }] }))
  assert.equal(result.failureKind, 'network_or_timeout')
  assert.deepEqual(result.failureEvidence.reasons[0].cause, { name: 'ConnectTimeoutError', message: 'Connect Timeout Error', code: 'UND_ERR_CONNECT_TIMEOUT', cause: null })
  assert.equal(result.failureEvidence.stage, 'listing')
})

test('direct collection nested cause and transport string causes classify network failures', () => {
  for (const native of [
    { failures: [{ message: 'Collection incomplete', cause: { cause: { code: 'ECONNREFUSED' } } }] },
    { transportPackets: [{ failure: { name: 'TypeError', cause: 'UND_ERR_CONNECT_TIMEOUT' } }] },
    { failures: [{ message: 'socket disconnected' }] },
  ]) assert.equal(extractionFailureDetails(wrapped(native)).failureKind, 'network_or_timeout')
  const error = wrapped({ failures: [] })
  error.cause = { name: 'TypeError', message: 'fetch failed', cause: { code: 'ECONNREFUSED' } }
  assert.equal(extractionFailureDetails(error).failureKind, 'network_or_timeout')
})

test('actual native HTTP denial, captcha and access failures remain blocked', () => {
  for (const native of [
    { transportPackets: [{ status: 403, failure: null }] },
    { failures: [{ stage: 'detail', message: 'HTTP 403' }] },
    { failures: [{ message: 'captcha response' }] },
    { failures: [{ message: 'blocked HTML' }] },
  ]) assert.equal(extractionFailureDetails(wrapped(native)).failureKind, 'blocked_or_access_denied')
})

test('partial collection preserves multiple failure reasons without qualifying job counts', () => {
  const result = extractionFailureDetails(wrapped({ observedListingCount: 57, jobs: [{ secret: 'PRIVATE_JOB' }, {}], complete: true,
    nativeInventoryComplete: true, firstParty: true, cleanupAllowed: true,
    failures: [{ stage: 'detail', message: 'expected JSON' }, { stage: 'closure', message: 'HTTP 503' }] }))
  assert.equal(result.failureKind, 'network_or_timeout')
  assert.equal(result.failureEvidence.observedListingCount, 57)
  assert.equal(result.failureEvidence.partialJobsLength, 2)
  assert.equal(result.failureEvidence.reasons.length, 2)
  assert.equal(result.failureEvidence.inventoryComplete, false)
  assert.equal(result.failureEvidence.cleanupAllowed, false)
  assert.equal(result.failureEvidence.firstParty, null)
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_JOB|nativeInventoryComplete|rawJobs|eligibleJobs/)
})

test('parser failures remain parser failures; unknown native incompleteness fails closed', () => {
  assert.equal(extractionFailureDetails(wrapped({ failures: [{ message: 'expected JSON; cannot read jobs' }] })).failureKind, 'parser_or_contract_error')
  for (const native of [{}, { failures: [] }, { failures: [{ message: 'cleanup forbidden' }] }]) {
    const result = extractionFailureDetails(wrapped(native))
    assert.equal(result.failureKind, 'surface_drift_or_fail_closed')
    assert.equal(result.failureEvidence.observedListingCount, null)
    assert.equal(result.failureEvidence.partialJobsLength, null)
  }
})

test('malformed native evidence, nested values and accessor properties are safely ignored', () => {
  for (const native of [undefined, null, false, 1, 'native', []]) {
    assert.deepEqual(extractionFailureDetails(wrapped(native)), { failureKind: 'surface_drift_or_fail_closed' })
  }
  const native = { observedListingCount: -2, jobs: 'not-jobs', failures: [null, 1, 'HTTP 403', [], { message: {}, cause: false }],
    transportPackets: [null, 3, 'fetch failed', { status: '403', failure: 'timeout' }] }
  Object.defineProperty(native, 'cleanupAllowed', { get() { throw Error('must not execute getters') } })
  const result = extractionFailureDetails(wrapped(native))
  assert.equal(result.failureKind, 'surface_drift_or_fail_closed')
  assert.equal(result.failureEvidence.partialJobsLength, null)
  assert.deepEqual(result.failureEvidence.reasons, [])
  assert.equal(result.failureEvidence.observedListingCount, null)
})

test('evidence bounds lists, counts, strings, cause depth and excludes transport payloads', () => {
  const failure = { name: 'TypeError', message: 'fetch failed https://user:password@example.test/?token=PRIVATE_URL Authorization=PRIVATE_AUTH Cookie=PRIVATE_COOKIE Bearer PRIVATE_BEARER <html>PRIVATE_HTML</html> ' + 'x'.repeat(1000), code: 'ECONNREFUSED', cause: { cause: { cause: { message: 'PRIVATE_DEPTH' } } } }
  const cyclic = { message: 'fetch failed' }; cyclic.cause = cyclic
  const result = extractionFailureDetails(wrapped({ observedListingCount: 1e20, jobs: null,
    failures: [cyclic, ...Array.from({ length: 40 }, () => failure)],
    transportPackets: [{ failure, headers: { authorization: 'PRIVATE_HEADER' }, bodyBase64: 'PRIVATE_BODY', rawHTML: 'PRIVATE_RAW' }] }))
  const summary = result.failureEvidence
  assert.equal(summary.reasons.length, 8)
  assert.equal(summary.reasonsTruncated, true)
  assert.equal(summary.failureCount, 41)
  assert.equal(summary.observedListingCount, null)
  assert.ok(summary.reasons[0].message.length <= 320)
  assert.equal(summary.reasons[0].cause, null)
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_(?:URL|AUTH|COOKIE|BEARER|HTML|HEADER|BODY|RAW|DEPTH)|bodyBase64|rawHTML|headers/)
})

test('database and permission priority and nonnative soft failure contracts are unchanged', () => {
  for (const code of ['AUDIT_DATABASE_BLOCKED', 'ERR_ACCESS_DENIED', 'ERR_DLOPEN_DISABLED']) {
    const error = Object.assign(wrapped({ failures: [{ message: 'fetch failed' }] }), { code })
    assert.equal(extractionFailureDetails(error).failureKind, code === 'AUDIT_DATABASE_BLOCKED' ? 'audit_database_blocked' : classifyScraperError(error).failureKind)
  }
  for (const error of [new Error('HTTP 403'), new Error('fetch failed'), { softFailure: true, failureKind: 'custom-soft', upstreamOutage: true }, { failureType: 'upstream_unavailable' }, { localTimeout: true }, null, 'invalid']) {
    assert.deepEqual(extractionFailureDetails(error), { failureKind: classifyScraperError(error ?? {}).failureKind })
  }
})

test('classification includes scanned reasons beyond the eight serialized entries', () => {
  for (const [earlier, last, expected] of [
    ['fetch failed', 'HTTP 403', 'blocked_or_access_denied'],
    ['expected JSON', 'fetch failed', 'network_or_timeout'],
  ]) {
    for (const length of [9, 32]) {
      const failures = [...Array.from({ length: length - 1 }, () => ({ message: earlier })), { message: last }]
      for (const native of [{ failures }, { transportPackets: failures.map(failure => ({ failure })) }]) {
        const result = extractionFailureDetails(wrapped(native))
        assert.equal(result.failureKind, expected)
        assert.equal(result.failureEvidence.reasons.length, 8)
        assert.equal(result.failureEvidence.reasonsTruncated, true)
      }
    }
  }
})

test('quoted credentials and credential labels never reach serialized evidence', () => {
  const result = extractionFailureDetails(wrapped({ failures: [{
    name: 'Bearer SYNTHETIC_TOKEN', code: 'Cookie: SYNTHETIC_COOKIE', stage: 'Authorization: SYNTHETIC_AUTH',
    message: 'expected JSON: {"password":"SYNTHETIC_PASSWORD with spaces","api_key":"SYNTHETIC_APIKEY","cookie":"SYNTHETIC_COOKIE"} ' +
      "'authorization': 'SYNTHETIC_AUTH with spaces' token=\"SYNTHETIC_TOKEN\" " + 'x'.repeat(1000),
    cause: { name: 'Basic SYNTHETIC_BASIC', code: 'Authorization=SYNTHETIC_CODE', message: '{"refresh_token":"SYNTHETIC_REFRESH"}' },
  }] }))
  assert.equal(result.failureKind, 'parser_or_contract_error')
  const evidence = result.failureEvidence
  assert.equal(evidence.stage, null)
  assert.equal(evidence.reasons[0].name, null)
  assert.equal(evidence.reasons[0].code, null)
  assert.ok(evidence.reasons[0].message.length <= 320)
  assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC_/)
  const diagnostic = extractionFailureDetails(wrapped({ failures: [{ stage: 'binding-pagination-or-closure', name: 'TypeError', code: 'ECONNRESET' }] }))
  assert.equal(diagnostic.failureKind, 'network_or_timeout')
  assert.equal(diagnostic.failureEvidence.stage, 'binding-pagination-or-closure')
})

test('present malformed native evidence fails unknown while absent native and explicit priority stay compatible', () => {
  const absent = new Error('Arrow native collection incomplete; cleanup forbidden')
  assert.deepEqual(extractionFailureDetails(absent), { failureKind: classifyScraperError(absent).failureKind })
  for (const native of [undefined, null, 7, 'native', []]) {
    assert.equal(extractionFailureDetails(wrapped(native)).failureKind, 'surface_drift_or_fail_closed')
    for (const code of ['AUDIT_DATABASE_BLOCKED', 'ERR_ACCESS_DENIED', 'ERR_DLOPEN_DISABLED']) {
      const error = Object.assign(wrapped(native), { code })
      assert.equal(extractionFailureDetails(error).failureKind, code === 'AUDIT_DATABASE_BLOCKED' ? 'audit_database_blocked' : classifyScraperError(error).failureKind)
    }
  }
  Object.defineProperty(absent, 'nativeEvidence', { get() { throw Error('native getter executed') } })
  assert.equal(extractionFailureDetails(absent).failureKind, 'surface_drift_or_fail_closed')
})

test('failure and packet lists read bounded own data elements without getters or array methods', () => {
  for (const key of ['failures', 'transportPackets']) {
    const list = []
    Object.defineProperty(list, 0, { get() { throw Error('array getter executed') } })
    list[1] = key === 'failures' ? { message: 'HTTP 403' } : { status: 403 }
    list.slice = () => { throw Error('slice executed') }
    list[Symbol.iterator] = () => { throw Error('iterator executed') }
    const result = extractionFailureDetails(wrapped({ [key]: list }))
    assert.equal(result.failureKind, 'blocked_or_access_denied')
    assert.doesNotThrow(() => JSON.stringify(result))
    const inherited = new Array(1)
    Object.setPrototypeOf(inherited, { 0: list[1] })
    assert.equal(extractionFailureDetails(wrapped({ [key]: inherited })).failureKind, 'surface_drift_or_fail_closed')
    const malformed = new Proxy([], { getOwnPropertyDescriptor() { throw Error('descriptor denied') } })
    assert.equal(extractionFailureDetails(wrapped({ [key]: malformed })).failureKind, 'surface_drift_or_fail_closed')
  }
})
