import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {setTimeout as schedule, clearTimeout as unschedule, setImmediate as immediate} from 'node:timers'
import * as aadyah from '../../scraper/aadyahaerospace/script.js'
import {getScraperCatalog, createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

// These four gzips and the manifest are byte-exact original C31 receipts.
// Every mutation/transport below is a labelled synthetic boundary control.
const folder = new URL('./fixtures/aadyahCurrentHeader20261107C32/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', folder)))
const ENTRY = 'https://www.aadyah.com/careers'
const LAYOUT = 'https://www.aadyah.com/_next/static/chunks/app/layout-fb5c9b2cf9296988.js'
const PAGE = 'https://www.aadyah.com/_next/static/chunks/app/careers/page-138ca50011e9e01d.js'
const HEADER = 'https://staging.supercode.in/aadyah-cms/wp-json/acf/v3/options/header'
const URLS = [ENTRY, LAYOUT, PAGE, HEADER]
const HASHES = ['84b5eed91f3ff00c97b098551dfeb678dbf9555f4e81f574cfc9acf6ea47aca9',
  '9ceae380bc3b31ff63f45a3c655fb338a282e0d9465afadb78f902c1571e7570',
  'ba7678d551f759117da8829e2c3ed0d5b8a3dcf01f548ef3565bcc6055c6efe9',
  '6c86181486fd787c9ee97f649451979710ffac40032993168c0e81706102480c']
const bodies = manifest.records.map(row => gunzipSync(fs.readFileSync(new URL(row.bodyFile, folder))))
const text = bodies.map(bytes => bytes.toString('utf8'))
const now = () => '2026-11-07T03:00:00.000Z'
const never = () => new Promise(() => {})
const tick = () => new Promise(resolve => immediate(resolve))
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done}); return {promise, resolve}}
const original = index => {const row = manifest.records[index]; return {url: row.finalUrl, requestedUrl: row.requestedUrl,
  status: row.status, headers: structuredClone(row.headers), html: text[index], bodyBase64: bodies[index].toString('base64'),
  sourceRequestedAt: row.sourceRequestedAt, sourceCompletedAt: row.sourceCompletedAt, sourceHttpDate: row.sourceHttpDate,
  originalReceipt: structuredClone(row), provenance: {transport: manifest.transport, bodyFile: row.bodyFile,
    corporateJavaScriptExecuted: false, subresourcesRequested: false}}}
const changed = (index, body) => ({url: URLS[index], status: 200, headers: structuredClone(manifest.records[index].headers),
  bodyBase64: Buffer.from(body).toString('base64'), syntheticBoundaryEntity: true,
  sourceRequestedAt: '2026-11-07T02:00:00.000Z', sourceCompletedAt: '2026-11-07T02:00:00.001Z'})
const replay = (mutate = value => value) => {
  const requests = [], audits = []
  const fetchPage = async (url, init) => {
    requests.push({url, ...init})
    const index = URLS.indexOf(url)
    assert.notEqual(index, -1, 'Local capture policy refused undeclared Aadyah endpoint: ' + url)
    return mutate(original(index), index, requests.length)
  }
  return {requests, audits, options: {now, fetchPage, fetchText: fetchPage, onAudit: audit => audits.push(audit)}}
}
const guard = async pending => {
  let timer
  try {return await Promise.race([pending, new Promise((_, reject) => {timer = schedule(() => reject(Error('Test watchdog: source did not settle')), 1000)})])}
  finally {unschedule(timer)}
}
const rejects = async (pending, inspect) => {
  let failed = false, reason
  try {await guard(pending)} catch (error) {failed = true; reason = error}
  assert.equal(failed, true, 'source must reject')
  inspect(reason)
}
const gap = jobs => {
  assert.equal(jobs.length, 0)
  const inventory = readInventoryEvidence(jobs)
  assert.equal(inventory.status, 'coverage-gap')
  assert.equal(inventory.listingComplete, false)
  assert.equal(inventory.reportedTotal, null)
  assert.equal(inventory.indiaFacetCount, null)
  assert.equal(inventory.verifiedAt, null)
  const observation = readSourceObservationEvidence(jobs, 'aadyahaerospace')
  assert.equal(observation.sourceScopeComplete, false)
  assert.equal(observation.companyGlobalTotal, null)
  assert.equal(observation.companyIndiaTotal, null)
  const audit = jobs.nativeCollectionEvidence
  for (const key of ['nativeReportedTotal', 'nativeIndiaTotal', 'companyGlobalTotal', 'companyIndiaTotal']) assert.equal(audit[key], null)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.listingComplete, false)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  return audit
}
const deadline = kind => error => {assert.equal(error.failureKind, 'network_or_timeout'); assert.match(error.message, new RegExp(kind + '.*deadline', 'i'))}
const native = (index, reader, extraHeaders = {}) => ({status: 200, url: URLS[index],
  headers: new Headers({...manifest.records[index].headers, ...extraHeaders}), body: {getReader: () => reader}})
const finiteReader = (index, beforeRead = () => {}) => {
  let done = false
  return {read() {beforeRead(); if (done) return Promise.resolve({done: true}); done = true; return Promise.resolve({done: false, value: new Uint8Array(bodies[index])})},
    cancel() {return Promise.resolve()}, releaseLock() {}}
}

test('genuine four-response fixture preserves original byte hashes, receipt clocks and local refusal provenance', () => {
  assert.deepEqual(bodies.map(body => body.length), [46430, 21112, 9825, 10223])
  assert.deepEqual(bodies.map(body => createHash('sha256').update(body).digest('hex')), HASHES)
  assert.deepEqual(manifest.records.map(row => row.requestedUrl), URLS)
  assert.equal(manifest.records[0].sourceRequestedAt, '2026-11-06T22:30:42.269Z')
  assert.equal(manifest.records[3].sourceCompletedAt, '2026-11-06T22:31:21.839Z')
  assert.equal(manifest.policyBlocks[0].url, 'https://staging.supercode.in/aadyah-cms/wp-json/acf/v3/options/footer')
})

test('current reader reads only the four genuine declared entities per snapshot and retains header hiring context', async () => {
  const r = replay()
  const audit = gap(await aadyah.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [...URLS, ...URLS])
  assert.equal(audit.closingMatches, true)
  assert.equal(audit.observations.length, 1)
  assert.equal(audit.observations[0].vacancy, false)
  assert.equal(audit.observations[0].applicationUrl, 'https://www.aadyah.com/careers#jobs')
  assert.equal(audit.observations[0].title, 'View opening')
  assert.deepEqual(audit.initial.nativeHeader, JSON.parse(text[3]))
  assert.deepEqual(audit.closing.nativeHeader, JSON.parse(text[3]))
  assert.deepEqual(audit.initial.clientHashes, HASHES.slice(1, 3))
  assert.deepEqual(audit.declaredPublicGETs, [HEADER])
  assert.equal(audit.remoteProgramsExecuted, false)
  assert.equal(audit.responses.length, 8)
  assert.equal(r.audits.length, 1)
  for (const [index, row] of audit.responses.entries()) {
    const source = manifest.records[index % 4]
    assert.equal(row.sha256, HASHES[index % 4])
    assert.equal(row.bodyBase64, bodies[index % 4].toString('base64'))
    assert.equal(row.sourceRequestedAt, source.sourceRequestedAt)
    assert.equal(row.sourceCompletedAt, source.sourceCompletedAt)
    assert.deepEqual(row.headers, source.headers)
    assert.deepEqual(row.originalReceipt, source)
    assert.equal(row.transportQualified, true)
    assert.equal(r.requests[index].method, 'GET')
    assert.equal(r.requests[index].redirect, 'manual')
    assert.equal(r.requests[index].credentials, 'omit')
  }
})

test('actual default catalog retains the full source audit without requiring an audit callback', async () => {
  const r = replay()
  delete r.options.onAudit
  const provider = getScraperCatalog().find(row => row.source === 'aadyahaerospace')
  const audit = gap(await createCatalogScraper(provider).run(r.options))
  assert.equal(audit.responses.length, 8)
  assert.equal(audit.responses[3].sha256, HASHES[3])
  assert.deepEqual(audit.initial.nativeHeader, JSON.parse(text[3]))
  assert.deepEqual(r.requests.map(row => row.url), [...URLS, ...URLS])
})

test('decoded-only legacy transport remains explicitly unqualified and cannot certify original bytes or clocks', async () => {
  const requests = []
  const jobs = await aadyah.run({now, fetchText: async url => {requests.push(url); return text[URLS.indexOf(url)]}})
  const audit = gap(jobs)
  assert.equal(readInventoryEvidence(jobs).firstParty, false)
  assert.deepEqual(requests, [...URLS, ...URLS])
  assert.ok(audit.responses.every(row => !row.transportQualified && row.bodyBase64 === null && row.sourceRequestedAt === null))
  assert.ok(audit.issues.some(row => row.kind === 'unqualified-decoded-only-transport'))
})

for (const mode of ['request-pair', 'both-pairs', 'missing-pair']) test(mode + ' original clock convention is preserved without manufactured acquisition clocks', async () => {
  const r = replay(page => {
    delete page.originalReceipt
    if (mode !== 'missing-pair') {page.requestedAt = page.sourceRequestedAt; page.completedAt = page.sourceCompletedAt}
    if (mode !== 'both-pairs') {delete page.sourceRequestedAt; delete page.sourceCompletedAt}
    return page
  })
  const audit = gap(await aadyah.run(r.options))
  const row = audit.responses[0]
  assert.equal(row.sourceRequestedAt, mode === 'missing-pair' ? null : '2026-11-06T22:30:42.269Z')
  assert.equal(row.sourceCompletedAt, mode === 'missing-pair' ? null : '2026-11-06T22:30:52.244Z')
  assert.equal(row.acquisitionClocksComplete, mode !== 'missing-pair')
  if (mode === 'missing-pair') assert.equal(row.transportQualified, false)
})

for (const [name, mutate] of [
  ['contradictory clock aliases', page => ({...page, requestedAt: '2026-11-06T22:30:42.270Z'})],
  ['receipt clock disagreement', page => ({...page, sourceCompletedAt: '2026-11-06T22:30:52.245Z'})],
  ['backward acquisition clock', page => {delete page.originalReceipt; return {...page, sourceCompletedAt: '2026-11-05T00:00:00.000Z'}}],
  ['invalid acquisition clock', page => ({...page, requestedAt: 'not-a-clock'})],
  ['wrong response URL', page => ({...page, url: 'https://other.invalid/careers'})],
  ['wrong final URL', page => ({...page, finalUrl: 'https://www.aadyah.com/'})],
  ['wrong requested URL', page => ({...page, requestedUrl: 'https://www.aadyah.com/jobs'})],
  ['wrong receipt hash', page => ({...page, originalReceipt: {...page.originalReceipt, sha256: '0'.repeat(64)}})],
  ['wrong MIME', page => ({...page, headers: {'content-type': 'application/json'}})],
  ['missing original bytes', page => {delete page.bodyBase64; return page}],
  ['malformed original bytes', page => ({...page, bodyBase64: 'invalid!!'})],
  ['contradictory decoded body', page => ({...page, html: '<p>different entity</p>'})],
]) test(name + ' fails closed with retained incomplete evidence', async () => {
  const r = replay(mutate)
  await rejects(aadyah.run(r.options), error => {assert.equal(error.lifecycleCleanupAllowed, false); assert.equal(error.inventoryEvidence.status, 'coverage-gap')})
  assert.equal(r.requests.length, 1)
  assert.equal(r.audits[0].outcome, 'failed')
})

const layoutTag = '<script src="/_next/static/chunks/app/layout-fb5c9b2cf9296988.js" async=""></script>'
for (const [name, markup] of [
  ['template-only declaration', '<template>' + layoutTag + '</template>'],
  ['comment-only declaration', '<!--' + layoutTag + '-->'],
  ['JSON MIME declaration', layoutTag.replace('<script ', '<script type="application/json" ')],
  ['nomodule-only declaration', layoutTag.replace('<script ', '<script nomodule ')],
  ['foreign SVG declaration', '<svg>' + layoutTag + '</svg>'],
  ['foreign MathML declaration', '<math>' + layoutTag + '</math>'],
  ['foreign prefix declaration', layoutTag.replaceAll('script', 'svg:script')],
  ['undeclared deployment URL', layoutTag.replace('layout-fb5c9b2cf9296988.js', 'layout-newdeployment.js')],
  ['duplicate matching declarations', layoutTag + layoutTag],
  ['unreviewed integrity declaration', layoutTag.replace('<script ', '<script integrity="sha256-invalid" ')],
]) test(name + ' cannot authorize a client or CMS read', async () => {
  const r = replay((page, index) => index === 0 ? changed(index, text[0].replace(layoutTag, markup)) : page)
  await rejects(aadyah.run(r.options), error => assert.match(error.message, /declar|client|binding|identity/i))
  assert.equal(r.requests.length, 1)
})

test('foreign base authority is rejected before any declared client read', async () => {
  const r = replay((page, index) => index === 0 ? changed(index, text[0].replace('<head>', '<head><base href="https://other.invalid/">')) : page)
  await rejects(aadyah.run(r.options), error => assert.match(error.message, /base|authority/i))
  assert.equal(r.requests.length, 1)
})

for (const [name, markup] of [
  ['hidden script', layoutTag.replace('<script ', '<script hidden ')],
  ['inert ancestor', '<div inert hidden>' + layoutTag + '</div>'],
  ['HTML SVG integration', '<svg><foreignObject>' + layoutTag + '</foreignObject></svg>'],
  ['HTML MathML integration', '<math><annotation-xml encoding="text/html">' + layoutTag + '</annotation-xml></math>'],
]) test('browser-active declaration under ' + name + ' is qualified without executing it', async () => {
  const r = replay((page, index) => index === 0 ? changed(index, text[0].replace(layoutTag, markup)) : page)
  const audit = gap(await aadyah.run(r.options))
  assert.equal(audit.remoteProgramsExecuted, false)
  assert.deepEqual(r.requests.map(row => row.url), [...URLS, ...URLS])
})

for (const index of [1, 2]) test('changed pinned ' + (index === 1 ? 'layout' : 'page') + ' program fails before CMS access', async () => {
  const r = replay((page, at) => at === index ? changed(at, text[at] + '\n/* synthetic boundary mutation */') : page)
  await rejects(aadyah.run(r.options), error => assert.match(error.message, /client|program|hash|binding/i))
  assert.equal(r.requests.some(row => row.url === HEADER), false)
})

test('changed native employer is rejected without an alternate footer or careers endpoint', async () => {
  const r = replay((page, index) => index === 3 ? changed(index, text[3].replaceAll('AADYAH', 'DifferentEmployer')) : page)
  await rejects(aadyah.run(r.options), error => assert.match(error.message, /employer|identity/i))
  assert.deepEqual(r.requests.map(row => row.url), URLS)
})

test('changed closing native header is retained as an incomplete reconciliation failure', async () => {
  const r = replay((page, index, call) => {
    if (index !== 3 || call <= 4) return page
    const header = JSON.parse(text[3]); header.footer[0].description = 'Synthetic changed context'
    return changed(index, JSON.stringify(header))
  })
  await rejects(aadyah.run(r.options), error => assert.match(error.message, /closing|changed/i))
  const audit = r.audits[0]
  assert.equal(audit.closingMatches, false)
  assert.equal(audit.responses.length, 8)
  assert.equal(audit.initial.nativeHeader.footer[0].description, 'Let’s work together')
  assert.equal(audit.closing.nativeHeader.footer[0].description, 'Synthetic changed context')
})

for (const reason of [0, false, null, undefined, '', Object.freeze(Error('frozen original read failure'))]) test('opaque read failure identity survives failed audit delivery (' + String(reason) + ')', async () => {
  await rejects(aadyah.run({now, fetchPage: () => {throw reason}, onAudit: () => {throw Error('synthetic failed audit sink')}}), error => assert.strictEqual(error, reason))
})

test('best-effort error diagnostics never invoke metadata setters on the original read failure', async () => {
  const reason = Error('original failure with metadata setters'); let setters = 0
  for (const key of ['inventoryEvidence', 'nativeEvidence', 'sourceAudit', 'nativeCollectionEvidence']) Object.defineProperty(reason, key, {set() {setters++; throw Error('metadata setter must not run')}, configurable: true})
  await rejects(aadyah.run({fetchPage: () => {throw reason}, onAudit: never, callbackTimeoutMs: 5}), error => assert.strictEqual(error, reason))
  assert.equal(setters, 0)
})

test('opaque proxy read rejection never invokes diagnostic descriptor traps', async () => {
  let inspected = 0
  const reason = new Proxy({}, {getOwnPropertyDescriptor() {inspected++; throw Error('opaque descriptor trap')}})
  await rejects(aadyah.run({fetchPage: () => {throw reason}, onAudit: () => {throw Error('failed sink')}}), error => assert.strictEqual(error, reason))
  assert.equal(inspected, 0)
})

for (const reason of [0, false, null, '', Object.freeze({cancel: 'opaque'})]) test('pre-aborted caller cancellation is preserved before reads or callbacks (' + String(reason) + ')', async () => {
  const controller = new AbortController(); controller.abort(reason); let calls = 0
  await rejects(aadyah.run({signal: controller.signal, fetchPage: () => {calls++; return original(0)}, onAudit: () => {calls++}}), error => assert.strictEqual(error, reason))
  assert.equal(calls, 0)
})

test('late caller cancellation bounds a signal-ignoring injected read', async () => {
  const controller = new AbortController(), entered = deferred(), reason = Object.freeze({cancel: 'late injected'})
  const pending = aadyah.run({signal: controller.signal, fetchPage: () => {entered.resolve(); return never()}})
  pending.catch(() => {})
  await guard(entered.promise); controller.abort(reason)
  await rejects(pending, error => assert.strictEqual(error, reason))
})

for (const name of ['onAudit', 'onMetadata', 'onRecords']) test(name + ' respects opaque cancellation even when the sink ignores its signal', async () => {
  const r = replay(), controller = new AbortController()
  await rejects(aadyah.run({...r.options, signal: controller.signal, [name]: () => {controller.abort(0); return never()}}), reason => assert.strictEqual(reason, 0))
})

test('independent request timeout bounds an injected read that ignores its signal', async () => {
  await rejects(aadyah.run({fetchPage: never, requestTimeoutMs: 5, sourceTimeoutMs: 500}), deadline('request'))
})
test('source deadline includes signal-ignoring audit work', async () => {
  const r = replay()
  await rejects(aadyah.run({...r.options, onAudit: never, sourceTimeoutMs: 50, requestTimeoutMs: 500, callbackTimeoutMs: 500}), deadline('source'))
})
for (const name of ['onAudit', 'onMetadata', 'onRecords']) test(name + ' has an independent ignored-callback deadline', async () => {
  const r = replay()
  await rejects(aadyah.run({...r.options, [name]: never, callbackTimeoutMs: 5, sourceTimeoutMs: 1000}), deadline(name))
})

test('native streamed original bytes retain the four-entity contract with genuine locally measured transport clocks', async () => {
  const calls = []
  const audit = gap(await aadyah.run({now, fetchImpl: async (url, init) => {calls.push({url, ...init}); const index = URLS.indexOf(url); return native(index, finiteReader(index))}}))
  assert.deepEqual(calls.map(row => row.url), [...URLS, ...URLS])
  assert.deepEqual(audit.responses.map(row => row.sha256), [...HASHES, ...HASHES])
  assert.ok(audit.responses.every(row => row.transportQualified && row.bodyComplete && row.acquisitionClocksComplete))
})

test('ignored native stream read cancels and releases without waiting for its cancel promise', async () => {
  let cancelled = 0, released = 0
  await rejects(aadyah.run({fetchImpl: async () => native(0, {read: never, cancel() {cancelled++; return never()}, releaseLock() {released++}}),
    entityTimeoutMs: 5, requestTimeoutMs: 500, sourceTimeoutMs: 1000}), deadline('entity'))
  assert.equal(cancelled, 1); assert.equal(released, 1)
})

test('frozen original native stream error is preserved while cancelling and releasing', async () => {
  const reason = Object.freeze(Error('frozen original stream failure')); let cancelled = 0, released = 0
  await rejects(aadyah.run({fetchImpl: async () => native(0, {read() {throw reason}, cancel() {cancelled++; return never()}, releaseLock() {released++}})}), error => assert.strictEqual(error, reason))
  assert.equal(cancelled, 1); assert.equal(released, 1)
})

test('late native headers after request expiry cancel the body without acquiring a reader', async () => {
  const late = deferred(); let acquired = 0, cancelled = 0
  const pending = aadyah.run({fetchImpl: () => late.promise, requestTimeoutMs: 5, sourceTimeoutMs: 500})
  await rejects(pending, deadline('request'))
  late.resolve({status: 200, url: ENTRY, headers: new Headers({'content-type': 'text/html'}),
    body: {cancel() {cancelled++; return never()}, getReader() {acquired++; throw Error('late acquisition')}}})
  await tick(); await tick()
  assert.equal(acquired, 0); assert.equal(cancelled, 1)
})

for (const status of [301, 302, 401, 403, 404, 429, 451, 500]) test('native HTTP ' + status + ' keeps original headers and denial policy before body acquisition', async () => {
  let requests = 0, acquired = 0, cancelled = 0
  const audits = [], heldHosts = new Set(), headers = {'content-type': 'text/html', location: 'https://other.invalid/careers', 'retry-after': '120'}
  await rejects(aadyah.run({now, heldHosts, onAudit: audit => audits.push(audit), fetchImpl: async url => {
    requests++; return {status, url, headers: new Headers(headers), body: {getReader() {acquired++; throw Error('rejected body read')}, cancel() {cancelled++; return never()}}}
  }}), error => {assert.equal(error.status, status); assert.equal(error.abortRetries, true); assert.equal(error.lifecycleCleanupAllowed, false)})
  assert.equal(requests, 1); assert.equal(acquired, 0); assert.equal(cancelled, 1)
  assert.equal(audits[0].responses[0].status, status)
  assert.equal(audits[0].responses[0].headers['retry-after'], '120')
  assert.equal(audits[0].responses[0].bodyBase64, null)
  if ([401, 403, 429, 451].includes(status)) assert.equal(heldHosts.has('www.aadyah.com'), true)
})

test('a held native CMS host cannot be retried through a supplied alternate transport', async () => {
  const r = replay(), heldHosts = new Set(['staging.supercode.in'])
  await rejects(aadyah.run({...r.options, heldHosts}), error => assert.match(error.message, /held|denied/i))
  assert.deepEqual(r.requests.map(row => row.url), URLS.slice(0, 3))
})

for (const key of ['maxResponseBytes', 'maxSourceBytes', 'maxTotalBytes']) test(key + ' independently rejects original bytes over budget', async () => {
  const r = replay()
  await rejects(aadyah.run({...r.options, [key]: 46429}), error => assert.match(error.message, /byte|budget|limit/i))
  assert.equal(r.requests.length, 1)
})
test('request-count limit stops before another entity rather than reporting a verified zero', async () => {
  const r = replay()
  await rejects(aadyah.run({...r.options, maxRequests: 3}), error => assert.match(error.message, /request|limit/i))
  assert.equal(r.requests.length, 3)
})
test('native declared byte overflow rejects headers before acquiring its body', async () => {
  let acquired = 0, cancelled = 0
  await rejects(aadyah.run({maxResponseBytes: 100, fetchImpl: async () => ({status: 200, url: ENTRY,
    headers: new Headers({'content-type': 'text/html', 'content-length': '101'}), body: {getReader() {acquired++; throw Error('byte overflow body')}, cancel() {cancelled++; return never()}}})}), error => assert.match(error.message, /byte|budget|limit/i))
  assert.equal(acquired, 0); assert.equal(cancelled, 1)
})

test('already-acquired denial metadata keeps genuine supplied acquisition clocks before rejecting the HTTP status', async () => {
  const r = replay(page => {delete page.originalReceipt; return {...page, status: 403, syntheticBoundaryEntity: true}})
  await rejects(aadyah.run(r.options), error => assert.equal(error.status, 403))
  assert.equal(r.audits[0].responses[0].sourceRequestedAt, '2026-11-06T22:30:42.269Z')
  assert.equal(r.audits[0].responses[0].sourceCompletedAt, '2026-11-06T22:30:52.244Z')
  assert.equal(r.audits[0].responses[0].denied, true)
})

for (const [name, value] of [['requestTimeoutMs', 0], ['entityTimeoutMs', -1], ['sourceTimeoutMs', Infinity],
  ['callbackTimeoutMs', NaN], ['maxResponseBytes', 0], ['maxSourceBytes', 1.5], ['maxTotalBytes', -1],
  ['maxRequests', 0], ['maxPages', 0], ['maxJobs', -1], ['onAudit', 'not-a-function'], ['now', () => 'invalid'], ['monotonicNow', () => NaN]]) test('invalid ' + name + ' is rejected before IO and timer allocation', async () => {
  let calls = 0, timers = 0; const set = globalThis.setTimeout
  globalThis.setTimeout = (...args) => {timers++; return set(...args)}
  try {
    await rejects(aadyah.run({[name]: value, fetchPage: () => {calls++; return original(0)}}), error => assert.match(error.message, /invalid|clock|limit/i))
    assert.equal(calls, 0); assert.equal(timers, 0)
  } finally {globalThis.setTimeout = set}
})

const spin = () => {const start = performance.now(); while (performance.now() - start < 20) {}}
test('synchronous request elapsed overrun fails before accepting returned native headers', async () => {
  await rejects(aadyah.run({requestTimeoutMs: 1, sourceTimeoutMs: 1000, fetchImpl: () => {spin(); return native(0, finiteReader(0))}}), deadline('request'))
})
test('synchronous entity elapsed overrun fails before accepting returned bytes', async () => {
  await rejects(aadyah.run({requestTimeoutMs: 1000, sourceTimeoutMs: 2000, entityTimeoutMs: 1,
    fetchImpl: async () => native(0, finiteReader(0, spin))}), deadline('entity'))
})
test('synchronous audit elapsed overrun is bounded after its callback returns', async () => {
  const r = replay()
  await rejects(aadyah.run({...r.options, onAudit: spin, callbackTimeoutMs: 1, sourceTimeoutMs: 2000}), deadline('onAudit'))
})

test('audit sink mutation cannot change retained native header or original receipts', async () => {
  const r = replay()
  const audit = gap(await aadyah.run({...r.options, onAudit: value => {value.responses[0].sha256 = 'sink mutation'; value.initial.nativeHeader.footer.length = 0; value.companyGlobalTotal = 0}}))
  assert.equal(audit.responses[0].sha256, HASHES[0]); assert.equal(audit.initial.nativeHeader.footer.length, 5)
})

test('success, original failure and caller cancellation clear every allocated deadline timer', async () => {
  const handles = new Set(), set = globalThis.setTimeout, clear = globalThis.clearTimeout
  globalThis.setTimeout = (...args) => {const handle = set(...args); handles.add(handle); return handle}
  globalThis.clearTimeout = handle => {handles.delete(handle); return clear(handle)}
  try {
    const r = replay(); gap(await aadyah.run(r.options)); await tick(); assert.equal(handles.size, 0)
    const reason = Object.freeze(Error('timer cleanup failure'))
    await rejects(aadyah.run({fetchPage: () => {throw reason}}), error => assert.strictEqual(error, reason)); await tick(); assert.equal(handles.size, 0)
    const controller = new AbortController(), entered = deferred()
    const pending = aadyah.run({signal: controller.signal, fetchPage: () => {entered.resolve(); return never()}})
    pending.catch(() => {}); await guard(entered.promise); controller.abort(0)
    await rejects(pending, error => assert.strictEqual(error, 0)); await tick(); assert.equal(handles.size, 0)
  } finally {globalThis.setTimeout = set; globalThis.clearTimeout = clear; for (const handle of handles) clear(handle)}
})

// C32 review remediation: synthetic MIME/setup boundaries around the same
// byte-exact originals. No publisher program or public acquisition executes.
test('C32-R1 XHTML uppercase SCRIPT cannot authorize a subsequent client or CMS GET', async () => {
  const xml = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>AADYAH Aerospace | Careers</title>' +
    '<SCRIPT src="' + LAYOUT + '"></SCRIPT><SCRIPT src="' + PAGE + '"></SCRIPT></head><body></body></html>'
  const r = replay((page, index) => index === 0 ? {...changed(index, xml), headers: {'content-type': 'application/xhtml+xml'}} : page)
  await rejects(aadyah.run(r.options), error => assert.match(error.message, /MIME/i))
  assert.deepEqual(r.requests.map(row => row.url), [ENTRY])
})

test('C32-R1 XHTML native headers reject before acquiring a body reader', async () => {
  let requests = 0, acquired = 0, cancelled = 0
  await rejects(aadyah.run({fetchImpl: async () => {
    requests++
    return {status: 200, url: ENTRY, headers: new Headers({'content-type': 'application/xhtml+xml'}),
      body: {getReader() {acquired++; return finiteReader(0)}, cancel() {cancelled++; return never()}}}
  }}), error => assert.match(error.message, /MIME/i))
  assert.equal(requests, 1); assert.equal(acquired, 0); assert.equal(cancelled, 1)
})

test('C32-R1 a known XHTML MIME cannot use decoded-only compatibility to authorize HTML clients', async () => {
  const requests = []
  await rejects(aadyah.run({fetchText: async url => {
    requests.push(url)
    return {url, status: 200, headers: {'content-type': 'application/xhtml+xml'}, html: text[0]}
  }}), error => assert.match(error.message, /MIME/i))
  assert.deepEqual(requests, [ENTRY])
})

test('C32-R3 default-catalog source expiry exposes the same driver audit after a completed genuine original', async () => {
  let requests = 0, audits = 0
  const provider = getScraperCatalog().find(row => row.source === 'aadyahaerospace')
  await rejects(createCatalogScraper(provider).run({now, sourceTimeoutMs: 200, requestTimeoutMs: 1000,
    onAudit: () => {audits++}, fetchPage: async url => {
      requests++
      assert.equal(url, requests === 1 ? ENTRY : LAYOUT)
      return requests === 1 ? original(0) : never()
    }}), error => {
    assert.match(error.message, /source.*deadline/i)
    assert.strictEqual(error.sourceAudit, error.nativeCollectionEvidence)
    const audit = error.sourceAudit
    assert.equal(audit.outcome, 'failed')
    assert.equal(audit.responses[0].sha256, HASHES[0])
    assert.equal(audit.responses[0].bodyBase64, bodies[0].toString('base64'))
    assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-06T22:30:42.269Z')
    assert.equal(audit.sourceScopeComplete, false)
    assert.equal(audit.lifecycleCleanupAllowed, false)
  })
  assert.equal(requests, 2); assert.equal(audits, 0)
})

for (const setup of ['first wall clock', 'first monotonic clock', 'limit getter']) test('C32-R4 source allowance includes synchronous setup in ' + setup, async () => {
  let first = true, requests = 0, deliveries = 0
  const pause = () => {if (first) {first = false; const end = performance.now() + 100; while (performance.now() < end) {}}}
  const options = {sourceTimeoutMs: 40, now, fetchPage: async () => {requests++; return original(0)},
    onAudit: () => {deliveries++}, onMetadata: () => {deliveries++}, onRecords: () => {deliveries++}}
  if (setup === 'first wall clock') options.now = () => {pause(); return now()}
  if (setup === 'first monotonic clock') options.monotonicNow = () => {pause(); return performance.now()}
  if (setup === 'limit getter') Object.defineProperty(options, 'requestTimeoutMs', {get() {pause(); return 1000}})
  await rejects(aadyah.run(options), error => {assert.match(error.message, /source.*deadline/i); assert.equal(error.nativeCollectionEvidence.responses.length, 0)})
  assert.equal(requests, 0); assert.equal(deliveries, 0)
})

for (const receiptKeys of ['request-only', 'source-only']) test('C32-R5 receipt ' + receiptKeys + ' clocks preserve exact request-key presence', async () => {
  const r = replay(page => {
    if (receiptKeys === 'request-only') {
      page.originalReceipt.requestedAt = page.sourceRequestedAt
      page.originalReceipt.completedAt = page.sourceCompletedAt
      delete page.originalReceipt.sourceRequestedAt; delete page.originalReceipt.sourceCompletedAt
    }
    delete page.sourceRequestedAt; delete page.sourceCompletedAt
    return page
  })
  const audit = gap(await aadyah.run(r.options))
  const row = audit.responses[0]
  assert.equal(row.sourceRequestedAt, '2026-11-06T22:30:42.269Z')
  assert.equal(row.sourceCompletedAt, '2026-11-06T22:30:52.244Z')
  assert.equal(row.requestedAt, receiptKeys === 'request-only' ? '2026-11-06T22:30:42.269Z' : null)
  assert.equal(row.completedAt, receiptKeys === 'request-only' ? '2026-11-06T22:30:52.244Z' : null)
  assert.equal(Object.hasOwn(row.originalReceipt, 'requestedAt'), receiptKeys === 'request-only')
})
