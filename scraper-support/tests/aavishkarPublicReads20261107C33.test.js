import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {setTimeout as schedule, clearTimeout as unschedule} from 'node:timers'
import test from 'node:test'
import * as aavishkar from '../../scraper/aavishkar/script.js'
import {getScraperCatalog, createCatalogScraper} from '../providers/index.js'
import {readInventoryEvidence, isVerifiedEmptyEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const HOME = 'https://aavishkaargroup.com/', CONTACT = 'https://aavishkaargroup.com/contact-us/'
const folder = new URL('./fixtures/aavishkarPublicReads20261107C33/', import.meta.url)
const manifests = {c32: JSON.parse(fs.readFileSync(new URL('manifest.json', folder)))}
const body = (version, index = 0) => gunzipSync(fs.readFileSync(new URL(manifests[version].records[index].bodyFile, folder)))
const original = (version, index = 0) => {
  const receipt = manifests[version].records[index]
  return {url: receipt.finalUrl, requestedUrl: receipt.requestedUrl, status: receipt.status,
    headers: structuredClone(receipt.headers), html: body(version, index).toString('utf8'),
    bodyBase64: body(version, index).toString('base64'), sourceRequestedAt: receipt.sourceRequestedAt,
    sourceCompletedAt: receipt.sourceCompletedAt, sourceHttpDate: receipt.sourceHttpDate,
    originalReceipt: structuredClone(receipt), provenance: {transport: manifests[version].transport,
      bodyFile: receipt.bodyFile, corporateJavaScriptExecuted: false, subresourcesRequested: false}}}
const now = () => '2026-11-07T01:00:00.000Z'
const home = content => '<html><head><title>Aavishkaar Group: One of the largest Impact Platforms across the Global South</title></head><body>' + content + '</body></html>'
// Every altered document/transport below is a synthetic boundary control; none
// is offered as an original response or evidence of a vacancy/company zero.
const changed = (content, url = HOME) => ({url, requestedUrl: url, status: 200,
  headers: {'content-type': 'text/html; charset=utf-8'}, bodyBase64: Buffer.from(content).toString('base64'),
  sourceRequestedAt: '2026-11-07T00:00:00.000Z', sourceCompletedAt: '2026-11-07T00:00:00.001Z', syntheticBoundaryEntity: true})
const never = () => new Promise(() => {})
const replay = (mutate = page => page, version = 'c32') => {
  const requests = [], audits = []
  return {requests, audits, options: {now, fetchPage: async (url, init) => {
    requests.push({url, ...init})
    if (url === HOME) return mutate(original(version), url)
    if (url === CONTACT) return mutate(original('c32', 1), url)
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

test('genuine two-response C32 replay stops at literal corporate contact and returns unknown inventory', async () => {
  const r = replay()
  const jobs = await aavishkar.run(r.options)
  const audit = gap(jobs)
  assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
  assert.ok(r.requests.every(row => row.method === 'GET' && row.redirect === 'manual' && row.credentials === 'omit'))
  assert.deepEqual(audit.observations, [])
  assert.equal(audit.responses.length, 2)
  assert.equal(audit.responses[0].sha256, '942255fbc8efe61fb6629e9b941b7eadc9abef549979c882cc30f102195db7f5')
  assert.equal(audit.responses[1].sha256, '14d2f1dbce26af4bb723dc6cd6ce0a15dbadcdd4ae546c4f19023c28f450caac')
  for (const [index, receipt] of manifests.c32.records.entries()) {
    assert.equal(audit.responses[index].bytes, receipt.bytes)
    assert.equal(audit.responses[index].bodyBase64, body('c32', index).toString('base64'))
    assert.deepEqual(audit.responses[index].headers, receipt.headers)
    assert.equal(audit.responses[index].sourceRequestedAt, receipt.sourceRequestedAt)
    assert.equal(audit.responses[index].sourceCompletedAt, receipt.sourceCompletedAt)
    assert.deepEqual(audit.rawPages[index].originalReceipt, receipt)
  }
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-07T00:11:17.661Z')
  assert.equal(audit.responses[1].sourceCompletedAt, '2026-11-07T00:11:38.145Z')
  assert.equal(r.audits.length, 1)
})

test('actual default catalog retains complete originals without requiring an audit callback', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'aavishkar')
  assert.ok(provider)
  const r = replay(page => page, 'c32')
  delete r.options.onAudit
  const jobs = await createCatalogScraper(provider).run(r.options)
  const audit = gap(jobs)
  assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
  assert.equal(audit.responses[0].sha256, '942255fbc8efe61fb6629e9b941b7eadc9abef549979c882cc30f102195db7f5')
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-07T00:11:17.661Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-07T00:11:28.052Z')
  assert.equal(audit.responses[0].bodyBase64, body('c32').toString('base64'))
  assert.deepEqual(audit.rawPages[0].originalReceipt, manifests.c32.records[0])
  assert.deepEqual(readSourceObservationEvidence(jobs, 'aavishkar'), {source: 'aavishkar', recordKind: 'hiring-signals',
    observedRecordCount: 0, observedVacancyCount: 0, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null})
})

test('fixture copies retain the two independent original entities and the unfetched robots refusal', () => {
  assert.equal(body('c32').length, 72947)
  assert.equal(body('c32', 1).length, 53775)
  assert.equal(createHash('sha256').update(body('c32')).digest('hex'), '942255fbc8efe61fb6629e9b941b7eadc9abef549979c882cc30f102195db7f5')
  assert.equal(createHash('sha256').update(body('c32', 1)).digest('hex'), '14d2f1dbce26af4bb723dc6cd6ce0a15dbadcdd4ae546c4f19023c28f450caac')
  assert.deepEqual(manifests.c32.policyBlocks.map(row => row.url), ['https://aavishkaargroup.com/robots.txt'])
  assert.equal(manifests.c32.records.length, 2)
})

test('decoded-only compatibility remains explicitly unqualified and does not invent clocks or bytes', async () => {
  const r = replay(page => ({status: page.status, url: page.url, html: page.html}))
  const audit = gap(await aavishkar.run(r.options))
  assert.equal(readInventoryEvidence(await aavishkar.run({now, fetchText: async () => home('<p>Corporate context.</p>')})).firstParty, false)
  assert.ok(audit.responses.every(row => row.transportQualified === false && row.bodyBase64 === null && row.sourceRequestedAt === null && row.sourceCompletedAt === null))
})

for (const [label, content, contactRead] of [
  ['no literal contact', '<p>Corporate services.</p>', false],
  ['template contact', '<template><a href="/contact-us/">Contact</a></template>', false],
  ['raw contact', '<textarea><a href="/contact-us/">Contact</a></textarea>', false],
  ['foreign contact', '<svg><a href="/contact-us/">Contact</a></svg>', false],
  ['object fallback contact', '<object data="/asset"><a href="/contact-us/">Contact</a></object>', false],
  ['foreign base', '<base href="https://example.invalid/"><a href="/contact-us/">Contact</a>', false],
  ['first base authority', '<base href="https://example.invalid/"><base href="https://aavishkaargroup.com/"><a href="/contact-us/">Contact</a>', false],
  ['hidden literal contact', '<div hidden><a href="/contact-us/">Contact</a></div>', true],
  ['HTML integration contact', '<svg><foreignObject><a href="/contact-us/">Contact</a></foreignObject></svg>', true],
  ['template base ignored', '<template><base href="https://example.invalid/"></template><a href="/contact-us/">Contact</a>', true],
]) test('only active same-authority literal contact is read: ' + label, async () => {
  const r = replay((page, url) => url === HOME ? changed(home(content)) : page)
  gap(await aavishkar.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), contactRead ? [HOME, CONTACT] : [HOME])
})

test('hidden hiring navigation, frames, executable scripts and JSON-LD survive as unresolved leads', async () => {
  const content = home('<div hidden inert aria-hidden="true" style="display:none"><a href="/careers">Careers</a>' +
    '<iframe src="https://jobs.example.invalid/aavishkar"></iframe><script src="/careers.js"></script>' +
    '<script type="application/ld+json">{"@type":"JobPosting","title":"Synthetic"}</script></div>')
  const r = replay(() => changed(content))
  const audit = gap(await aavishkar.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
  assert.deepEqual(audit.observations.map(row => row.kind).sort(), ['declared-frame', 'declared-link', 'declared-script', 'jobposting-marker'])
  assert.ok(audit.observations.every(row => row.enumerated === false && row.vacancyCount === null))
  assert.equal(readSourceObservationEvidence(await aavishkar.run({now, fetchPage: async () => changed(content)}), 'aavishkar').observedRecordCount, 4)
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
  const audit = gap(await aavishkar.run({now, fetchPage: async () => changed(home(content))}))
  assert.deepEqual(audit.observations.map(row => row.kind), kinds)
  if (label === 'base changes diagnostic URL') assert.equal(audit.observations[0].url, 'https://external.invalid/base/jobs.js')
})

test('both acquisition clock conventions survive without replay clocks replacing originals', async () => {
  const r = replay(page => {
    page.requestedAt = page.sourceRequestedAt; page.completedAt = page.sourceCompletedAt
    delete page.sourceRequestedAt; delete page.sourceCompletedAt
    return page
  })
  const audit = gap(await aavishkar.run(r.options))
  assert.equal(audit.responses[0].requestedAt, '2026-11-07T00:11:17.661Z')
  assert.equal(audit.responses[0].completedAt, '2026-11-07T00:11:28.052Z')
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-07T00:11:17.661Z')
  assert.equal(audit.responses[0].sourceCompletedAt, '2026-11-07T00:11:28.052Z')
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
  await assert.rejects(aavishkar.run(r.options), /clock|contradict|provenance/i)
  assert.equal(r.audits[0].lifecycleCleanupAllowed, false)
})

test('missing acquisition clocks stay missing rather than borrowing the replay time', async () => {
  const r = replay(page => {delete page.originalReceipt; delete page.sourceRequestedAt; delete page.sourceCompletedAt; return page})
  const audit = gap(await aavishkar.run(r.options))
  assert.ok(audit.responses.every(row => row.sourceRequestedAt === null && row.sourceCompletedAt === null))
})

for (const reason of [false, 0, null, 'opaque cancellation', Object.freeze(Error('Frozen cancellation'))]) {
  test('caller cancellation preserves exact opaque reason ' + String(reason), async () => {
    const controller = new AbortController()
    await rejection(aavishkar.run({now, signal: controller.signal, fetchPage: () => {controller.abort(reason); return never()}}), value => assert.equal(value, reason))
  })
}

test('frozen/falsy read failure survives an audit rejection with no error setter writes', async () => {
  for (const reason of [false, 0, null, Object.freeze(Error('Frozen read failure'))]) {
    await rejection(aavishkar.run({now, fetchPage: () => {throw reason}, onAudit: () => {throw Error('Sink rejection')}}), value => assert.equal(value, reason))
  }
  let writes = 0
  const reason = Error('Read failure with accessor')
  for (const key of ['sourceAudit', 'nativeEvidence', 'inventoryEvidence', 'lifecycleCleanupAllowed']) Object.defineProperty(reason, key, {set() {writes++}})
  await rejection(aavishkar.run({now, fetchPage: () => {throw reason}, onAudit: () => {throw Error('Sink rejection')}}), value => assert.equal(value, reason))
  assert.equal(writes, 0)
})

for (const [kind, options] of [
  ['request', {fetchPage: never, requestTimeoutMs: 15}],
  ['entity', {fetchImpl: async () => native(syntheticReader(never)), entityTimeoutMs: 15}],
  ['source', {fetchPage: never, requestTimeoutMs: 200, sourceTimeoutMs: 15}],
  ['onAudit', {fetchPage: async () => changed(home('<p>Company</p>')), onAudit: never, callbackTimeoutMs: 15}],
]) test('ignored abort signals remain bounded by ' + kind + ' deadline', async () => {
  await rejection(aavishkar.run({now, ...options}), error => {
    assert.equal(error?.failureKind, 'network_or_timeout')
    assert.match(error.message, new RegExp(kind + '.*deadline', 'i'))
  })
})

test('elapsed synchronous request work cannot evade deadline timers', async () => {
  let ticks = 0
  await rejection(aavishkar.run({now, requestTimeoutMs: 10, monotonicNow: () => ticks,
    fetchPage: () => {ticks = 100; return changed(home('<p>Company</p>'))}}), error => assert.match(error.message, /deadline/i))
})

test('synchronous source setup and callback overruns remain inside the source allowance', async () => {
  let first = true
  const slowClock = () => {if (first) {first = false; const end = performance.now() + 25; while (performance.now() < end) {}} return now()}
  await rejection(aavishkar.run({now: slowClock, sourceTimeoutMs: 10, fetchPage: async () => changed(home('<p>Company</p>'))}), error => assert.match(error.message, /source.*deadline/i))
  let ticks = 0
  await rejection(aavishkar.run({now, monotonicNow: () => ticks, callbackTimeoutMs: 10,
    fetchPage: async () => changed(home('<p>Company</p>')), onRecords: () => {ticks = 20}}), error => assert.match(error.message, /onRecords.*deadline/i))
})

test('denial headers and identity also survive returned original envelopes without body reads', async () => {
  const r = replay(page => ({...page, status: 429, headers: {...page.headers, 'retry-after': '120'}}))
  await assert.rejects(aavishkar.run(r.options), error => error.failureKind === 'blocked_or_access_denied')
  assert.equal(r.audits[0].responses[0].status, 429)
  assert.equal(r.audits[0].responses[0].headers['retry-after'], '120')
  assert.equal(r.audits[0].responses[0].bodyComplete, false)
})

test('a late response is cancelled after its request deadline without an extra read', async () => {
  let resolve, cancels = 0
  const response = new Promise(done => {resolve = done})
  await rejection(aavishkar.run({now, requestTimeoutMs: 10, fetchImpl: () => response}), error => assert.match(error.message, /request.*deadline/i))
  resolve({body: {cancel() {cancels++; return never()}}})
  await new Promise(done => schedule(done, 5))
  assert.equal(cancels, 1)
})

test('an opaque read-error object with rejecting diagnostic traps retains its identity', async () => {
  const reason = new Proxy({}, {getOwnPropertyDescriptor() {throw Error('Diagnostic trap')}, isExtensible() {throw Error('Diagnostic trap')}})
  await rejection(aavishkar.run({now, fetchPage: () => {throw reason}, onAudit: () => {throw Error('Sink rejection')}}), error => assert.equal(error, reason))
})

test('invalid controls are rejected before a single public read', async () => {
  for (const options of [{maxRequests: 0}, {maxResponseBytes: -1}, {maxSourceBytes: NaN}, {maxTotalBytes: Infinity},
    {requestTimeoutMs: 0}, {entityTimeoutMs: -1}, {sourceTimeoutMs: 0}, {callbackTimeoutMs: 0}, {maxPages: 0}, {onAudit: true}]) {
    let reads = 0
    await assert.rejects(aavishkar.run({now, ...options, fetchPage: () => {reads++; throw Error('Unexpected IO')}}), /invalid/i)
    assert.equal(reads, 0)
  }
})

test('request and aggregate byte budgets stop before prohibited reads', async () => {
  const r = replay()
  await assert.rejects(aavishkar.run({...r.options, maxRequests: 1}), /request|page.*limit/i)
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
  const small = replay()
  await assert.rejects(aavishkar.run({...small.options, maxResponseBytes: 8}), /byte.*budget|byte.*limit/i)
  const aggregate = replay()
  await assert.rejects(aavishkar.run({...aggregate.options, maxSourceBytes: 80000}), /byte.*budget|byte.*limit/i)
})

test('native denial retains status and headers before body read and holds the host without waiting for cancellation', async () => {
  const heldHosts = new Set(), audits = []
  let reads = 0, cancels = 0, requests = 0
  const options = {now, heldHosts, onAudit: audit => audits.push(audit), fetchImpl: async () => {
    requests++
    return {status: 403, url: HOME, headers: new Headers({'content-type': 'text/html', 'retry-after': '180', 'x-denial': 'synthetic'}),
      body: {getReader() {reads++; return syntheticReader()}, cancel() {cancels++; return never()}}}
  }}
  await rejection(aavishkar.run(options), error => assert.equal(error.failureKind, 'blocked_or_access_denied'))
  assert.equal(reads, 0)
  assert.equal(cancels, 1)
  assert.equal(heldHosts.has('aavishkaargroup.com'), true)
  assert.equal(audits[0].responses[0].status, 403)
  assert.equal(audits[0].responses[0].headers['retry-after'], '180')
  assert.equal(audits[0].responses[0].bodyComplete, false)
  await assert.rejects(aavishkar.run(options), /held/i)
  assert.equal(requests, 1)
})

test('native complete body releases reader and original stream errors cancel without changing identity', async () => {
  let sent = false
  const bytes = Buffer.from(home('<p>Company</p>'))
  const reader = syntheticReader(async () => sent ? {done: true} : (sent = true, {done: false, value: bytes}))
  const jobs = await aavishkar.run({now, fetchImpl: async () => native(reader)})
  gap(jobs)
  assert.deepEqual(reader.counts(), {cancelled: 0, released: 1})
  const reason = Object.freeze(Error('Entity read failed'))
  const failing = syntheticReader(() => {throw reason})
  await rejection(aavishkar.run({now, fetchImpl: async () => native(failing), onAudit: () => {throw Error('Sink failed')}}), error => assert.equal(error, reason))
  assert.deepEqual(failing.counts(), {cancelled: 1, released: 1})
})

test('audit consumers cannot mutate retained original bodies, receipts or inventory qualification', async () => {
  const r = replay()
  r.options.onAudit = value => {value.responses[0].bodyBase64 = 'bad'; value.rawPages[0].originalReceipt.status = 500; value.lifecycleCleanupAllowed = true}
  const audit = gap(await aavishkar.run(r.options))
  assert.equal(audit.responses[0].bodyBase64, body('c32').toString('base64'))
  assert.equal(audit.rawPages[0].originalReceipt.status, 200)
})

// C33 HTML MIME reviewer control: XML default namespaces are case-sensitive expanded
// names, so this well-formed foreign vocabulary cannot grant HTML navigation.
for (const transport of ['original bytes', 'decoded compatibility']) test('C33 HTML MIME XHTML cannot authorize a second GET: ' + transport, async () => {
  const xml = '<html xmlns="urn:synthetic-foreign-vocabulary"><head>' +
    '<title>Aavishkaar Group: One of the largest Impact Platforms across the Global South</title>' +
    '</head><body><a href="/contact-us/">Contact</a></body></html>'
  const requests = [], audits = []
  await rejection(aavishkar.run({now, onAudit: audit => audits.push(audit), fetchPage: async url => {
    requests.push(url)
    const content = url === HOME ? xml : '<html><head><title>Contact Us - Aavishkaar Group</title></head></html>'
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

// C33 original-error precedence reviewer controls fail the two distinct diagnostic assignments once,
// then recover. A falsey read reason still represents an actual failed read.
for (const [assignment, failCall] of [['response', 3], ['audit', 4]]) {
  for (const [label, reason] of [['frozen Error', Object.freeze(Error('Original read failed'))], ['falsy zero', 0]]) {
    test('C33 original-error precedence ' + assignment + ' completion clock failure preserves the original ' + label, async () => {
      let clockCalls = 0
      const audits = [], clockError = Object.freeze(Error('Synthetic completion clock error'))
      await rejection(aavishkar.run({now: () => {if (++clockCalls === failCall) throw clockError; return now()},
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

test('C33 original-error precedence both unavailable completion clocks remain null while preserving a frozen read failure', async () => {
  const reason = Object.freeze(Error('Original frozen read failed'))
  let readFailed = false
  const audits = []
  await rejection(aavishkar.run({now: () => {if (readFailed) throw Error('Persistent completion clock failure'); return now()},
    fetchPage: () => {readFailed = true; throw reason}, onAudit: audit => audits.push(audit)}), error => assert.equal(error, reason))
  assert.equal(audits.length, 1)
  assert.equal(audits[0].responses[0].observedCompletedAt, null)
  assert.equal(audits[0].completedAt, null)
  assert.equal(audits[0].issues.filter(issue => issue.kind === 'completion-clock-unavailable').length, 2)
})

for (const [label, declaration] of [
  ['lookalike authority', '<a href="https://aavishkaargroup.com.example.invalid/contact-us/">Contact</a>'],
  ['www authority alias', '<a href="https://www.aavishkaargroup.com/contact-us/">Contact</a>'],
  ['alternate port', '<a href="https://aavishkaargroup.com:444/contact-us/">Contact</a>'],
  ['credentials', '<a href="https://someone@aavishkaargroup.com/contact-us/">Contact</a>'],
  ['HTTP downgrade', '<a href="http://aavishkaargroup.com/contact-us/">Contact</a>'],
  ['unconfigured contact target', '<a href="/contact/">Contact</a>'],
  ['query contact target', '<a href="/contact-us/?route=jobs">Contact</a>'],
  ['fragment contact target', '<a href="/contact-us/#form">Contact</a>'],
  ['inert entity contact', '<textarea>&lt;a href="/contact-us/"&gt;Contact&lt;/a&gt;</textarea>'],
]) test('literal contact does not expand to an unqualified route: ' + label, async () => {
  const r = replay(() => changed(home(declaration)))
  gap(await aavishkar.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
})

test('HTML entity decoding can authorize only the exact active configured contact', async () => {
  const r = replay((page, url) => url === HOME ? changed(home('<a href="https://aavishkaargroup.com/contact&#45;us/">Contact</a>')) : page)
  gap(await aavishkar.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
})

for (const [label, content] of [
  ['other employer', '<html><head><title>Another Corporate Group</title></head><body>Aavishkaar Group</body></html>'],
  ['inert branded title', '<html><template><title>Aavishkaar Group: One of the largest Impact Platforms across the Global South</title></template><body>Corporate context</body></html>'],
  ['foreign branded title', '<html><svg><title>Aavishkaar Group: One of the largest Impact Platforms across the Global South</title></svg><body>Corporate context</body></html>'],
]) test('an unqualified publisher cannot authorize contact: ' + label, async () => {
  const r = replay(() => changed(content))
  await assert.rejects(aavishkar.run(r.options), /publisher identity/i)
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
})

test('contact publisher mismatch remains failed and never implies an empty inventory', async () => {
  const r = replay((page, url) => url === CONTACT ? changed('<html><head><title>Another Contact Page</title></head></html>', CONTACT) : page)
  await assert.rejects(aavishkar.run(r.options), /contact publisher identity/i)
  assert.equal(r.audits.length, 1)
  assert.equal(r.audits[0].outcome, 'failed')
  assert.equal(r.audits[0].inventoryEvidence.reportedTotal, null)
  assert.equal(r.audits[0].lifecycleCleanupAllowed, false)
})

test('group companies, form targets, LinkedIn and undeclared sitemap hints never cause an extra GET', async () => {
  const content = home('<a href="/group-companies/aavishkaar-capital/">Group company</a>' +
    '<a href="https://www.linkedin.com/company/aavishkaar-group/jobs/">Careers</a>' +
    '<form action="/apply"><button>Apply now</button></form><link rel="sitemap" href="/sitemap.xml">')
  const r = replay(() => changed(content))
  const audit = gap(await aavishkar.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
  assert.ok(audit.observations.some(row => row.url === 'https://www.linkedin.com/company/aavishkaar-group/jobs/' && row.followed === false))
  assert.equal(audit.responses.length, 1)
})

test('receipt-only request-name clocks retain both original clock aliases through the default catalog', async () => {
  const r = replay(page => {
    page.originalReceipt.requestedAt = page.originalReceipt.sourceRequestedAt
    page.originalReceipt.completedAt = page.originalReceipt.sourceCompletedAt
    delete page.originalReceipt.sourceRequestedAt; delete page.originalReceipt.sourceCompletedAt
    delete page.sourceRequestedAt; delete page.sourceCompletedAt
    return page
  })
  delete r.options.onAudit
  const jobs = await createCatalogScraper(getScraperCatalog().find(row => row.source === 'aavishkar')).run(r.options)
  const audit = gap(jobs)
  assert.equal(audit.responses[0].requestedAt, '2026-11-07T00:11:17.661Z')
  assert.equal(audit.responses[0].sourceRequestedAt, '2026-11-07T00:11:17.661Z')
  assert.equal(audit.responses[1].completedAt, '2026-11-07T00:11:38.145Z')
  assert.equal(audit.responses[1].sourceCompletedAt, '2026-11-07T00:11:38.145Z')
  assert.equal(audit.rawPages[0].originalReceipt.requestedAt, '2026-11-07T00:11:17.661Z')
})


// C33 review remediation: these new controls exercise only declaration
// qualification. Every altered entity below is synthetic and keeps its exact
// bytes in the audit; no negative case is offered as a public observation.
for (const [label, content, reason] of [
  ['hexadecimal ampersand then decimal reference', '<a href="/contact&#x26;#45;us/">Contact</a>', 'ambiguous-character-reference-spelling'],
  ['encoded ampersand then named reference', '<a href="/contact&#38;ndash;us/">Contact</a>', 'ambiguous-character-reference-spelling'],
  ['partly encoded nested named reference', '<a href="/contact&#38;l&#116;;us/">Contact</a>', 'ambiguous-character-reference-spelling'],
]) test('C33 remediation entity qualification retains unqualified original context: ' + label, async () => {
  const contentHtml = home(content)
  const r = replay((page,url) => url === HOME ? changed(contentHtml) : page)
  const audit = gap(await aavishkar.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [HOME])
  assert.deepEqual(audit.declarations, [])
  assert.deepEqual(audit.observations, [])
  assert.equal(audit.responses[0].bodyBase64, Buffer.from(contentHtml).toString('base64'))
  assert.equal(audit.responses[0].sha256, createHash('sha256').update(contentHtml).digest('hex'))
  assert.deepEqual(audit.declarationQualification.map(row => ({documentUrl:row.documentUrl,qualified:row.qualified,reasons:row.reasons})),
    [{documentUrl:HOME,qualified:false,reasons:[reason]}])
  assert.ok(audit.issues.some(issue => issue.kind === 'unqualified-declaration-context' && issue.reason === reason && issue.contextRetained === true))
})

for (const tag of ['mtext', 'mi', 'mo', 'mn', 'ms', 'annotation-xml']) {
  test('C33 remediation self-closing MathML cannot invent an integration parent: ' + tag, async () => {
    const contentHtml = home('<math><' + tag + (tag === 'annotation-xml' ? ' encoding="text/html"' : '') + '/><a href="/contact-us/">Contact</a></math>')
    const r = replay((page,url) => url === HOME ? changed(contentHtml) : page)
    const audit = gap(await aavishkar.run(r.options))
    assert.deepEqual(r.requests.map(row => row.url), [HOME])
    assert.deepEqual(audit.declarations, [])
    assert.deepEqual(audit.observations, [])
    assert.equal(audit.responses[0].bodyBase64, Buffer.from(contentHtml).toString('base64'))
    assert.equal(audit.rawPages[0].bodyBase64, Buffer.from(contentHtml).toString('base64'))
    assert.equal(audit.declarationQualification[0].qualified, false)
    assert.deepEqual(audit.declarationQualification[0].reasons, ['unsupported-self-closing-MathML-integration-spelling'])
    assert.ok(audit.issues.some(issue => issue.kind === 'unqualified-declaration-context' && issue.contextRetained === true))
  })
}

for (const [label, content] of [
  ['direct numeric reference', '<a href="/contact&#45;us/">Contact</a>'],
  ['ordinary HTML with decimal ampersand in an unrelated query', '<link rel="alternate" href="/?feed=rss&#038;format=xml"><a href="/contact-us/">Contact</a>'],
  ['paired MathML text integration', '<math><mtext><a href="/contact-us/">Contact</a></mtext></math>'],
  ['paired MathML annotation integration', '<math><annotation-xml encoding="text/html"><a href="/contact-us/">Contact</a></annotation-xml></math>'],
  ['self-closing spelling outside MathML', '<mtext/><a href="/contact-us/">Contact</a>'],
]) test('C33 remediation qualified contact positive remains readable: ' + label, async () => {
  const r = replay((page,url) => url === HOME ? changed(home(content)) : page)
  const audit = gap(await aavishkar.run(r.options))
  assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
  assert.equal(audit.declarations.filter(row => row.documentUrl === HOME && row.url === CONTACT && row.followed).length, 1)
  assert.ok(audit.declarationQualification.every(row => row.qualified === true && row.reasons.length === 0))
})

test('C33 remediation genuine original two-document default-catalog replay keeps its complete qualified audit', async () => {
  const r = replay()
  delete r.options.onAudit
  const jobs = await createCatalogScraper(getScraperCatalog().find(row => row.source === 'aavishkar')).run(r.options)
  const audit = gap(jobs)
  assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
  assert.ok(audit.declarationQualification.every(row => row.qualified === true && row.reasons.length === 0))
  assert.equal(audit.declarationQualification.length, 2)
  for (const [index,receipt] of manifests.c32.records.entries()) {
    assert.equal(audit.responses[index].sha256, receipt.sha256)
    assert.equal(audit.responses[index].bytes, receipt.bytes)
    assert.equal(audit.responses[index].bodyBase64, body('c32', index).toString('base64'))
    assert.deepEqual(audit.responses[index].headers, receipt.headers)
    assert.equal(audit.responses[index].sourceRequestedAt, receipt.sourceRequestedAt)
    assert.equal(audit.responses[index].sourceCompletedAt, receipt.sourceCompletedAt)
    assert.deepEqual(audit.rawPages[index].originalReceipt, receipt)
  }
})


for (const quote of ['"', "'"]) {
  test('C33 remediation quoted delimiter does not hide a self-closing MathML integration tag: ' + quote, async () => {
    const contentHtml = home('<math><mtext data-note=' + quote + '>' + quote + '/><a href="/contact-us/">Contact</a></math>')
    const r = replay((page,url) => url === HOME ? changed(contentHtml) : page)
    const audit = gap(await aavishkar.run(r.options))
    assert.deepEqual(r.requests.map(row => row.url), [HOME])
    assert.deepEqual(audit.declarations, [])
    assert.deepEqual(audit.declarationQualification[0].reasons, ['unsupported-self-closing-MathML-integration-spelling'])
    assert.equal(audit.responses[0].bodyBase64, Buffer.from(contentHtml).toString('base64'))
  })
  test('C33 remediation quoted delimiter is data inside a supported paired MathML tag: ' + quote, async () => {
    const contentHtml = home('<math><mtext data-note=' + quote + '/>' + quote + '><a href="/contact-us/">Contact</a></mtext></math>')
    const r = replay((page,url) => url === HOME ? changed(contentHtml) : page)
    const audit = gap(await aavishkar.run(r.options))
    assert.deepEqual(r.requests.map(row => row.url), [HOME, CONTACT])
    assert.ok(audit.declarationQualification.every(row => row.qualified === true))
    assert.equal(audit.declarations.filter(row => row.url === CONTACT && row.followed).length, 1)
  })
}
