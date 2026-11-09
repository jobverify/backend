import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {setTimeout as schedule, clearTimeout as unschedule} from 'node:timers'
import test from 'node:test'
import * as aalekh from '../../scraper/aalekh/script.js'
import {getScraperCatalog, createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence, isVerifiedEmptyEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const HOME = 'https://aalekh.co/', CONTACT = 'https://aalekh.co/contactUs'
const folder = new URL('./fixtures/aalekhPublicReads20261107C32/', import.meta.url)
const manifests = Object.fromEntries(['c31', 'c32'].map(version => [version,
  JSON.parse(fs.readFileSync(new URL(version + '/manifest.json', folder)))]))
const body = (version, index = 0) => gunzipSync(fs.readFileSync(new URL(version + '/' + manifests[version].records[index].bodyFile, folder)))
const original = (version, index = 0) => {
  const receipt = manifests[version].records[index]
  return {url: receipt.finalUrl, requestedUrl: receipt.requestedUrl, status: receipt.status,
    headers: structuredClone(receipt.headers), html: body(version, index).toString('utf8'),
    bodyBase64: body(version, index).toString('base64'), sourceRequestedAt: receipt.sourceRequestedAt,
    sourceCompletedAt: receipt.sourceCompletedAt, sourceHttpDate: receipt.sourceHttpDate,
    originalReceipt: structuredClone(receipt), provenance: {transport: manifests[version].transport,
      bodyFile: receipt.bodyFile, corporateJavaScriptExecuted: false, subresourcesRequested: false}}}
const now = () => '2026-11-07T01:00:00.000Z'
const home = content => '<html><head><title>Aalekh Designs, Rajkot | Packaging Designer in Rajkot</title></head><body>' + content + '</body></html>'
// Every altered document/transport below is a synthetic boundary control; none
// is offered as an original response or evidence of a vacancy/company zero.
const changed = (content, url = HOME) => ({url, requestedUrl: url, status: 200,
  headers: {'content-type': 'text/html; charset=utf-8'}, bodyBase64: Buffer.from(content).toString('base64'),
  sourceRequestedAt: '2026-11-07T00:00:00.000Z', sourceCompletedAt: '2026-11-07T00:00:00.001Z', syntheticBoundaryEntity: true})
const never = () => new Promise(() => {})
const replay = (mutate = page => page, version = 'c31') => {
  const requests = [], audits = []
  return {requests, audits, options: {now, fetchPage: async (url, init) => {
    requests.push({url, ...init})
    if (url === HOME) return mutate(original(version), url)
    if (url === CONTACT) return mutate(original('c31', 1), url)
    throw Error('Local capture-policy refusal for undeclared URL: ' + url)
  }, onAudit: audit => audits.push(audit)}}
}
const gap = jobs => {
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, null)
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  const audit = jobs.nativeCollectionEvidence
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.companyGlobalTotal, null)
  assert.equal(audit.companyIndiaTotal, null)
  assert.equal(audit.nativeReportedTotal, null)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  return audit
}
const guarded = async pending => {
  let timer
  try {return await Promise.race([pending, new Promise((_, reject) => {timer = schedule(() => reject(Error('Test watchdog exceeded')), 700)})])}
  finally {unschedule(timer)}
}
const rejection = async (pending, inspect) => {
  let rejected = false, reason
  try {await guarded(pending)} catch (error) {rejected = true; reason = error}
  assert.equal(rejected, true)
  inspect(reason)
}
const syntheticReader = (read = async () => ({done: true})) => {
  let cancelled = 0, released = 0
  return {read, cancel() {cancelled++; return never()}, releaseLock() {released++},
    counts: () => ({cancelled, released})}
}
const native = reader => ({url: HOME, status: 200, headers: new Headers({'content-type': 'text/html'}), body: {getReader: () => reader}})

test('genuine two-response C31 replay stops at literal corporate contact and returns unknown inventory', async () => {
  const r = replay()
  const jobs = await aalekh.run(r.options)
  const audit = gap(jobs)
  assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
  assert.ok(r.requests.every(row => row.method === 'GET' && row.redirect === 'manual' && row.credentials === 'omit'))
  assert.deepEqual(audit.observations, [])
  assert.equal(audit.responses.length, 2)
  assert.equal(audit.responses[0].sha256, '28adf5bc5ecba28c60cd2cd0a0f89a7b509da260fefb0e16279594de0ac6dd3d')
  assert.equal(audit.responses[1].sha256, 'f65246f4230a430202078a9a95d563a1b091b08ae6c3c0116a931c12d21dcf22')
  for (const [index, receipt] of manifests.c31.records.entries()) {
    assert.equal(audit.responses[index].bytes, receipt.bytes)
    assert.equal(audit.responses[index].bodyBase64, body('c31', index).toString('base64'))
    assert.deepEqual(audit.responses[index].headers, receipt.headers)
    assert.equal(audit.responses[index].sourceRequestedAt, receipt.sourceRequestedAt)
    assert.equal(audit.responses[index].sourceCompletedAt, receipt.sourceCompletedAt)
    assert.deepEqual(audit.rawPages[index].originalReceipt, receipt)
  }
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-06T22:31:23.537Z')
  assert.equal(audit.responses[1].sourceCompletedAt, '2026-11-06T22:31:47.748Z')
  assert.equal(r.audits.length, 1)
})

test('actual default catalog retains complete originals without requiring an audit callback', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'aalekh')
  assert.ok(provider)
  const r = replay(page => page, 'c32')
  delete r.options.onAudit
  const jobs = await createCatalogScraper(provider).run(r.options)
  const audit = gap(jobs)
  assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
  assert.equal(audit.responses[0].sha256, '099d3d54305265ef62b4211c82c5843a2d3d02e6a05e8600e115ee88090beaa6')
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-06T23:12:46.826Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-06T23:12:58.993Z')
  assert.equal(audit.responses[0].bodyBase64, body('c32').toString('base64'))
  assert.deepEqual(audit.rawPages[0].originalReceipt, manifests.c32.records[0])
  assert.deepEqual(readSourceObservationEvidence(jobs, 'aalekh'), {source: 'aalekh', recordKind: 'hiring-signals',
    observedRecordCount: 0, observedVacancyCount: 0, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null})
})

test('fixture copies retain exact entity sizes and independent original hashes', () => {
  assert.equal(body('c31').length, 457730)
  assert.equal(body('c31', 1).length, 27891)
  assert.equal(body('c32').length, 457730)
  assert.equal(createHash('sha256').update(body('c32')).digest('hex'), '099d3d54305265ef62b4211c82c5843a2d3d02e6a05e8600e115ee88090beaa6')
  assert.notDeepEqual(body('c31'), body('c32'))
})

test('decoded-only compatibility remains explicitly unqualified and does not invent clocks or bytes', async () => {
  const r = replay(page => ({status: page.status, url: page.url, html: page.html}))
  const audit = gap(await aalekh.run(r.options))
  assert.equal(readInventoryEvidence(await aalekh.run({now, fetchText: async () => home('<p>Corporate context.</p>')})).firstParty, false)
  assert.ok(audit.responses.every(row => row.transportQualified === false && row.bodyBase64 === null && row.sourceRequestedAt === null && row.sourceCompletedAt === null))
})

for (const [label, content, contactRead] of [
  ['no literal contact', '<p>Corporate services.</p>', false],
  ['template contact', '<template><a href="/contactUs">Contact</a></template>', false],
  ['raw contact', '<textarea><a href="/contactUs">Contact</a></textarea>', false],
  ['foreign contact', '<svg><a href="/contactUs">Contact</a></svg>', false],
  ['object fallback contact', '<object data="/asset"><a href="/contactUs">Contact</a></object>', false],
  ['foreign base', '<base href="https://example.invalid/"><a href="/contactUs">Contact</a>', false],
  ['first base authority', '<base href="https://example.invalid/"><base href="https://aalekh.co/"><a href="/contactUs">Contact</a>', false],
  ['hidden literal contact', '<div hidden><a href="/contactUs">Contact</a></div>', true],
  ['HTML integration contact', '<svg><foreignObject><a href="/contactUs">Contact</a></foreignObject></svg>', true],
  ['template base ignored', '<template><base href="https://example.invalid/"></template><a href="/contactUs">Contact</a>', true],
]) test('only active same-authority literal contact is read: ' + label, async () => {
  const r = replay((page, url) => url === HOME ? changed(home(content)) : page)
  gap(await aalekh.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), contactRead ? [HOME, CONTACT] : [HOME])
})

test('hidden hiring navigation, frames, executable scripts and JSON-LD survive as unresolved leads', async () => {
  const content = home('<div hidden inert aria-hidden="true" style="display:none"><a href="/careers">Careers</a>' +
    '<iframe src="https://jobs.example.invalid/aalekh"></iframe><script src="/careers.js"></script>' +
    '<script type="application/ld+json">{"@type":"JobPosting","title":"Synthetic"}</script></div>')
  const r = replay(() => changed(content))
  const audit = gap(await aalekh.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
  assert.deepEqual(audit.observations.map(row => row.kind).sort(), ['declared-frame', 'declared-link', 'declared-script', 'jobposting-marker'])
  assert.ok(audit.observations.every(row => row.enumerated === false && row.vacancyCount === null))
  assert.equal(readSourceObservationEvidence(await aalekh.run({now, fetchPage: async () => changed(content)}), 'aalekh').observedRecordCount, 4)
})

for (const [label, content, kinds] of [
  ['inert templates', '<template><script src="/careers.js"></script><iframe src="/jobs"></iframe></template>', []],
  ['non-executable script MIME', '<script type="text/plain" src="/careers.js"></script>', []],
  ['legacy script MIME', '<script language="javascript" src="/jobs.js"></script>', ['declared-script']],
  ['nomodule script', '<script nomodule src="/jobs.js"></script>', []],
  ['srcdoc supersedes src', '<iframe src="/jobs" srcdoc="&lt;p&gt;Local frame&lt;/p&gt;"></iframe>', []],
  ['foreign vocabulary', '<svg><script src="/careers.js"></script></svg><math><iframe src="/jobs"></iframe></math>', []],
  ['SVG integration point', '<svg><foreignObject><iframe src="/jobs"></iframe></foreignObject></svg>', ['declared-frame']],
  ['MathML integration point', '<math><annotation-xml encoding="text/html"><iframe src="/jobs"></iframe></annotation-xml></math>', ['declared-frame']],
  ['raw fallback', '<iframe><script src="/jobs.js"></script></iframe><noscript><iframe src="/jobs"></iframe></noscript>', []],
  ['base changes diagnostic URL', '<base href="https://external.invalid/base/"><script src="jobs.js"></script>', ['declared-script']],
  ['hidden navigation label', '<div hidden><a href="/opportunities">Careers</a></div>', ['declared-link']],
  ['hidden navigation accessible label', '<a hidden href="/opportunities" aria-label="Careers"></a>', ['declared-link']],
]) test('declaration structural boundary: ' + label, async () => {
  const audit = gap(await aalekh.run({now, fetchPage: async () => changed(home(content))}))
  assert.deepEqual(audit.observations.map(row => row.kind), kinds)
  if (label === 'base changes diagnostic URL') assert.equal(audit.observations[0].url, 'https://external.invalid/base/jobs.js')
})

test('both acquisition clock conventions survive without replay clocks replacing originals', async () => {
  const r = replay(page => {
    page.requestedAt = page.sourceRequestedAt; page.completedAt = page.sourceCompletedAt
    delete page.sourceRequestedAt; delete page.sourceCompletedAt
    return page
  })
  const audit = gap(await aalekh.run(r.options))
  assert.equal(audit.responses[0].requestedAt, '2026-11-06T22:31:23.537Z')
  assert.equal(audit.responses[0].completedAt, '2026-11-06T22:31:36.586Z')
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-06T22:31:23.537Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-06T22:31:36.586Z')
})

for (const [label, mutate] of [
  ['clock disagreement', page => {page.requestedAt = '2026-11-07T00:00:00.000Z'}],
  ['reversed clocks', page => {delete page.originalReceipt; page.sourceCompletedAt = '2026-11-01T00:00:00.000Z'}],
  ['receipt clock disagreement', page => {page.originalReceipt.sourceRequestedAt = '2026-11-07T00:00:00.000Z'}],
  ['decoded entity disagreement', page => {page.html += '<p>Changed</p>'}],
  ['receipt hash disagreement', page => {page.originalReceipt.sha256 = 'a'.repeat(64)}],
  ['receipt headers disagreement', page => {page.originalReceipt.headers.date = 'Sat, 07 Nov 2026 01:00:00 GMT'}],
  ['supplied entity hash disagreement', page => {page.sha256 = 'a'.repeat(64)}],
  ['supplied entity length disagreement', page => {page.bytes = 1}],
  ['receipt HTTP date disagreement', page => {page.originalReceipt.sourceHttpDate = 'Sat, 07 Nov 2026 01:00:00 GMT'}],
]) test('contradictory original provenance is rejected: ' + label, async () => {
  const r = replay(page => {mutate(page); return page})
  await assert.rejects(aalekh.run(r.options), /clock|contradict|provenance/i)
  assert.equal(r.audits[0].lifecycleCleanupAllowed, false)
})

test('missing acquisition clocks stay missing rather than borrowing the replay time', async () => {
  const r = replay(page => {delete page.originalReceipt; delete page.sourceRequestedAt; delete page.sourceCompletedAt; return page})
  const audit = gap(await aalekh.run(r.options))
  assert.ok(audit.responses.every(row => row.sourceRequestedAt === null && row.sourceCompletedAt === null))
})

for (const reason of [false, 0, null, 'opaque cancellation', Object.freeze(Error('Frozen cancellation'))]) {
  test('caller cancellation preserves exact opaque reason ' + String(reason), async () => {
    const controller = new AbortController()
    await rejection(aalekh.run({now, signal: controller.signal, fetchPage: () => {controller.abort(reason); return never()}}), value => assert.equal(value, reason))
  })
}

test('frozen/falsy read failure survives an audit rejection with no error setter writes', async () => {
  for (const reason of [false, 0, null, Object.freeze(Error('Frozen read failure'))]) {
    await rejection(aalekh.run({now, fetchPage: () => {throw reason}, onAudit: () => {throw Error('Sink rejection')}}), value => assert.equal(value, reason))
  }
  let writes = 0
  const reason = Error('Read failure with accessor')
  for (const key of ['sourceAudit', 'nativeEvidence', 'inventoryEvidence', 'lifecycleCleanupAllowed']) Object.defineProperty(reason, key, {set() {writes++}})
  await rejection(aalekh.run({now, fetchPage: () => {throw reason}, onAudit: () => {throw Error('Sink rejection')}}), value => assert.equal(value, reason))
  assert.equal(writes, 0)
})

for (const [kind, options] of [
  ['request', {fetchPage: never, requestTimeoutMs: 15}],
  ['entity', {fetchImpl: async () => native(syntheticReader(never)), entityTimeoutMs: 15}],
  ['source', {fetchPage: never, requestTimeoutMs: 200, sourceTimeoutMs: 15}],
  ['onAudit', {fetchPage: async () => changed(home('<p>Company</p>')), onAudit: never, callbackTimeoutMs: 15}],
]) test('ignored abort signals remain bounded by ' + kind + ' deadline', async () => {
  await rejection(aalekh.run({now, ...options}), error => {
    assert.equal(error?.failureKind, 'network_or_timeout')
    assert.match(error.message, new RegExp(kind + '.*deadline', 'i'))
  })
})

test('elapsed synchronous request work cannot evade deadline timers', async () => {
  let ticks = 0
  await rejection(aalekh.run({now, requestTimeoutMs: 10, monotonicNow: () => ticks,
    fetchPage: () => {ticks = 100; return changed(home('<p>Company</p>'))}}), error => assert.match(error.message, /deadline/i))
})

test('synchronous source setup and callback overruns remain inside the source allowance', async () => {
  let first = true
  const slowClock = () => {if (first) {first = false; const end = performance.now() + 25; while (performance.now() < end) {}} return now()}
  await rejection(aalekh.run({now: slowClock, sourceTimeoutMs: 10, fetchPage: async () => changed(home('<p>Company</p>'))}), error => assert.match(error.message, /source.*deadline/i))
  let ticks = 0
  await rejection(aalekh.run({now, monotonicNow: () => ticks, callbackTimeoutMs: 10,
    fetchPage: async () => changed(home('<p>Company</p>')), onRecords: () => {ticks = 20}}), error => assert.match(error.message, /onRecords.*deadline/i))
})

test('denial headers and identity also survive returned original envelopes without body reads', async () => {
  const r = replay(page => ({...page, status: 429, headers: {...page.headers, 'retry-after': '120'}}))
  await assert.rejects(aalekh.run(r.options), error => error.failureKind === 'blocked_or_access_denied')
  assert.equal(r.audits[0].responses[0].status, 429)
  assert.equal(r.audits[0].responses[0].headers['retry-after'], '120')
  assert.equal(r.audits[0].responses[0].bodyComplete, false)
})

test('a late response is cancelled after its request deadline without an extra read', async () => {
  let resolve, cancels = 0
  const response = new Promise(done => {resolve = done})
  await rejection(aalekh.run({now, requestTimeoutMs: 10, fetchImpl: () => response}), error => assert.match(error.message, /request.*deadline/i))
  resolve({body: {cancel() {cancels++; return never()}}})
  await new Promise(done => schedule(done, 5))
  assert.equal(cancels, 1)
})

test('an opaque read-error object with rejecting diagnostic traps retains its identity', async () => {
  const reason = new Proxy({}, {getOwnPropertyDescriptor() {throw Error('Diagnostic trap')}, isExtensible() {throw Error('Diagnostic trap')}})
  await rejection(aalekh.run({now, fetchPage: () => {throw reason}, onAudit: () => {throw Error('Sink rejection')}}), error => assert.equal(error, reason))
})

test('invalid controls are rejected before a single public read', async () => {
  for (const options of [{maxRequests: 0}, {maxResponseBytes: -1}, {maxSourceBytes: NaN}, {maxTotalBytes: Infinity},
    {requestTimeoutMs: 0}, {entityTimeoutMs: -1}, {sourceTimeoutMs: 0}, {callbackTimeoutMs: 0}, {maxPages: 0}, {onAudit: true}]) {
    let reads = 0
    await assert.rejects(aalekh.run({now, ...options, fetchPage: () => {reads++; throw Error('Unexpected IO')}}), /invalid/i)
    assert.equal(reads, 0)
  }
})

test('request and aggregate byte budgets stop before prohibited reads', async () => {
  const r = replay()
  await assert.rejects(aalekh.run({...r.options, maxRequests: 1}), /request|page.*limit/i)
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
  const small = replay()
  await assert.rejects(aalekh.run({...small.options, maxResponseBytes: 8}), /byte.*budget|byte.*limit/i)
  const aggregate = replay()
  await assert.rejects(aalekh.run({...aggregate.options, maxSourceBytes: 460000}), /byte.*budget|byte.*limit/i)
})

test('native denial retains status and headers before body read and holds the host without waiting for cancellation', async () => {
  const heldHosts = new Set(), audits = []
  let reads = 0, cancels = 0, requests = 0
  const options = {now, heldHosts, onAudit: audit => audits.push(audit), fetchImpl: async () => {
    requests++
    return {status: 403, url: HOME, headers: new Headers({'content-type': 'text/html', 'retry-after': '180', 'x-denial': 'synthetic'}),
      body: {getReader() {reads++; return syntheticReader()}, cancel() {cancels++; return never()}}}
  }}
  await rejection(aalekh.run(options), error => assert.equal(error.failureKind, 'blocked_or_access_denied'))
  assert.equal(reads, 0)
  assert.equal(cancels, 1)
  assert.equal(heldHosts.has('aalekh.co'), true)
  assert.equal(audits[0].responses[0].status, 403)
  assert.equal(audits[0].responses[0].headers['retry-after'], '180')
  assert.equal(audits[0].responses[0].bodyComplete, false)
  await assert.rejects(aalekh.run(options), /held/i)
  assert.equal(requests, 1)
})

test('native complete body releases reader and original stream errors cancel without changing identity', async () => {
  let sent = false
  const bytes = Buffer.from(home('<p>Company</p>'))
  const reader = syntheticReader(async () => sent ? {done: true} : (sent = true, {done: false, value: bytes}))
  const jobs = await aalekh.run({now, fetchImpl: async () => native(reader)})
  gap(jobs)
  assert.deepEqual(reader.counts(), {cancelled: 0, released: 1})
  const reason = Object.freeze(Error('Entity read failed'))
  const failing = syntheticReader(() => {throw reason})
  await rejection(aalekh.run({now, fetchImpl: async () => native(failing), onAudit: () => {throw Error('Sink failed')}}), error => assert.equal(error, reason))
  assert.deepEqual(failing.counts(), {cancelled: 1, released: 1})
})

test('audit consumers cannot mutate retained original bodies, receipts or inventory qualification', async () => {
  const r = replay()
  r.options.onAudit = value => {value.responses[0].bodyBase64 = 'bad'; value.rawPages[0].originalReceipt.status = 500; value.lifecycleCleanupAllowed = true}
  const audit = gap(await aalekh.run(r.options))
  assert.equal(audit.responses[0].bodyBase64, body('c31').toString('base64'))
  assert.equal(audit.rawPages[0].originalReceipt.status, 200)
})

// C32-R1 reviewer control: XML default namespaces are case-sensitive expanded
// names, so this well-formed foreign vocabulary cannot grant HTML navigation.
for (const transport of ['original bytes', 'decoded compatibility']) test('C32-R1 XHTML cannot authorize a second GET: ' + transport, async () => {
  const xml = '<html xmlns="urn:synthetic-foreign-vocabulary"><head>' +
    '<title>Aalekh Designs, Rajkot | Packaging Designer in Rajkot</title>' +
    '</head><body><a href="/contactUs">Contact</a></body></html>'
  const requests = [], audits = []
  await rejection(aalekh.run({now, onAudit: audit => audits.push(audit), fetchPage: async url => {
    requests.push(url)
    const content = url === HOME ? xml : '<html><head><title>Aalekh Designs Rajkot</title></head></html>'
    const page = changed(content, url)
    page.headers['content-type'] = 'application/xhtml+xml; charset=utf-8'
    if (transport === 'decoded compatibility') {delete page.bodyBase64; page.html = content}
    return page
  }}), error => assert.match(error.message, /MIME/i))
  assert.deepEqual(requests, [HOME])
  assert.equal(audits.length, 1)
  assert.equal(audits[0].responses[0].headers['content-type'], 'application/xhtml+xml; charset=utf-8')
  assert.deepEqual(audits[0].observations, [])
  assert.equal(audits[0].lifecycleCleanupAllowed, false)
})

// C32-R2 reviewer controls fail the two distinct diagnostic assignments once,
// then recover. A falsey read reason still represents an actual failed read.
for (const [assignment, failCall] of [['response', 3], ['audit', 4]]) {
  for (const [label, reason] of [['frozen Error', Object.freeze(Error('Original read failed'))], ['falsy zero', 0]]) {
    test('C32-R2 ' + assignment + ' completion clock failure preserves the original ' + label, async () => {
      let clockCalls = 0
      const audits = [], clockError = Object.freeze(Error('Synthetic completion clock error'))
      await rejection(aalekh.run({now: () => {if (++clockCalls === failCall) throw clockError; return now()},
        fetchPage: () => {throw reason}, onAudit: audit => audits.push(audit)}), error => assert.equal(error, reason))
      assert.equal(clockCalls, 4, 'Each completion assignment is attempted once, without renewing an unavailable timestamp')
      assert.equal(audits.length, 1)
      assert.equal(audits[0].responses[0].observedCompletedAt, assignment === 'response' ? null : now())
      assert.equal(audits[0].completedAt, assignment === 'audit' ? null : now())
      assert.equal(audits[0].responses[0].sourceCompletedAt, null)
      assert.equal(audits[0].outcome, 'failed')
      assert.equal(audits[0].lifecycleCleanupAllowed, false)
      assert.ok(audits[0].issues.some(issue => issue.kind === 'completion-clock-unavailable' && issue.scope === assignment))
    })
  }
}

test('C32-R2 both unavailable completion clocks remain null while preserving a frozen read failure', async () => {
  const reason = Object.freeze(Error('Original frozen read failed'))
  let readFailed = false
  const audits = []
  await rejection(aalekh.run({now: () => {if (readFailed) throw Error('Persistent completion clock failure'); return now()},
    fetchPage: () => {readFailed = true; throw reason}, onAudit: audit => audits.push(audit)}), error => assert.equal(error, reason))
  assert.equal(audits.length, 1)
  assert.equal(audits[0].responses[0].observedCompletedAt, null)
  assert.equal(audits[0].completedAt, null)
  assert.equal(audits[0].issues.filter(issue => issue.kind === 'completion-clock-unavailable').length, 2)
})
