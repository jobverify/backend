import assert from 'node:assert/strict'
import test from 'node:test'
import { getEventListeners } from 'node:events'
import { registerHooks, syncBuiltinESMExports } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'

// Every page/feed/body below is an authored lifecycle protocol, not a native
// capture, vacancy, complete inventory or country-coverage observation.
let networkAttempts = 0, databaseAttempts = 0
const deny = () => { networkAttempts++; throw Error('Suki lifecycle tests forbid actual network') }
globalThis.fetch = deny
for (const module of [http, https]) { module.get = deny; module.request = deny }
http2.connect = deny; net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny
tls.connect = deny; dgram.createSocket = deny
for (const module of [dns, dns.promises]) for (const key of Object.keys(module)) if (/^(?:lookup|resolve)/.test(key) && typeof module[key] === 'function') module[key] = deny
syncBuiltinESMExports()
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'mongoose' || /(?:^|\/)saveToDB\.js$/.test(specifier)) { databaseAttempts++; throw Error('No DB module belongs in Suki lifecycle tests') }
  return nextResolve(specifier, context)
} })
const suki = await import('../scraper/suki/script.js')
const routes = { public: options => suki.run(options), factory: options => suki.createSukiScraper().run(options) }
const kinds = ['null', 'false', 'zero', 'empty', 'frozen', 'default', 'network', 'frozen-network']
const reasonFor = kind => kind === 'null' ? null : kind === 'false' ? false : kind === 'zero' ? 0 : kind === 'empty' ? ''
  : kind === 'default' ? AbortSignal.abort().reason : kind === 'frozen' ? Object.freeze(Error('Authored frozen caller'))
    : kind === 'network' ? Object.assign(Error('Authored caller network reason'), { code: 'ECONNRESET' })
      : Object.freeze(Object.assign(Error('Authored frozen caller network reason'), { code: 'ECONNRESET' }))
const descriptors = value => value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
const reflect = promise => Promise.resolve(promise).then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason, reason), 'The exact opaque failure must survive') }
const turn = () => new Promise(resolve => setImmediate(resolve))
const clean = signal => assert.equal(getEventListeners(signal, 'abort').length, 0)
const stamp = '2026-11-11T00:00:00.000Z'
const careersHtml = '<h1>Help shape the future of healthcare with AI</h1><p>Join the Team</p><p>Level-up your career by applying to opportunities at Suki.</p><p>Suki AI, Inc.</p><a href="https://www.suki.ai/open-positions/">Authored handoff</a>'
const handoffHtml = '<title>Open Positions at Suki | Healthcare AI Jobs</title><h1>Current Openings</h1><p>Company Careers Policies Trust Portal</p><div id="grnhse_app"></div>'
const pageFor = url => ({ status: 200, url, html: url === suki.CAREERS_PAGE_URL ? careersHtml : handoffHtml })
const emptyFeed = () => ({ jobs: [], meta: { total: 0 } })
const jobFeed = () => ({ jobs: [{ id: '123', title: 'Authored lifecycle example', company_name: 'Suki', absolute_url: `${suki.OFFICIAL_CAREERS_HANDOFF_URL}?gh_jid=123`, location: { name: 'Bengaluru, India' }, offices: [{ name: 'Suki India' }], content: '<p>Authored description.</p>', departments: [], application_deadline: '2026-12-01' }], meta: { total: 1 } })
const stageFor = url => url === suki.CAREERS_PAGE_URL ? 'careers' : url === suki.OFFICIAL_CAREERS_HANDOFF_URL ? 'handoff' : 'feed'

for (const [route, run] of Object.entries(routes)) for (const kind of kinds) test(`Suki ${route} pre-abort ${kind} admits no collaborator option getter`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), reads = []
  caller.abort(reason)
  const options = { get signal() { reads.push('signal'); return caller.signal } }
  for (const key of ['fetchPage', 'fetchJson', 'now']) Object.defineProperty(options, key, { get() { reads.push(key); throw Error('Pre-aborted work must not be read') } })
  exact(await reflect(run(options)), reason); assert.deepEqual(reads, ['signal']); assert.deepEqual(descriptors(reason), before); clean(caller.signal)
})

const checkStage = async (run, stage, mode, kind) => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), calls = []
  const replacement = Object.freeze(Error('Authored unrelated transport replacement'))
  const deferred = mode === 'stalled' ? Promise.withResolvers() : null
  let clocks = 0, settled = false
  const produce = url => {
    calls.push(stageFor(url))
    if (stageFor(url) !== stage) return url === suki.GREENHOUSE_JOBS_API_URL ? emptyFeed() : pageFor(url)
    caller.abort(reason)
    if (mode === 'throw') throw replacement
    if (mode === 'reject') return Promise.reject(replacement)
    if (mode === 'stalled') return deferred.promise
    return url === suki.GREENHOUSE_JOBS_API_URL ? emptyFeed() : pageFor(url)
  }
  const pending = reflect(run({ signal: caller.signal, fetchPage: produce, fetchJson: produce, now() { clocks++; return stamp } }))
  pending.then(() => { settled = true })
  await turn()
  const settledBeforeRelease = settled
  if (deferred) deferred.reject(replacement)
  const result = await pending
  await turn()
  assert.equal(settledBeforeRelease, true, 'Caller cancellation must settle before the stalled collaborator is released')
  exact(result, reason); assert.deepEqual(calls, ['careers', 'handoff', 'feed'].slice(0, ['careers', 'handoff', 'feed'].indexOf(stage) + 1))
  assert.equal(clocks, 0); assert.deepEqual(descriptors(reason), before); clean(caller.signal)
}
for (const stage of ['careers', 'handoff', 'feed']) for (const mode of ['return', 'throw', 'reject', 'stalled']) for (const kind of kinds) test(`Suki public ${stage} abort ${kind} then ${mode} preserves caller and stops queued work`, () => checkStage(routes.public, stage, mode, kind))
for (const kind of kinds) test(`Suki factory stalled caller ${kind} owns late rejection`, () => checkStage(routes.factory, 'careers', 'stalled', kind))

for (const key of ['fetchPage', 'fetchJson', 'now']) for (const mode of ['return', 'throw']) for (const kind of kinds) test(`Suki ${key} option getter abort ${kind} then ${mode} prevents later getters`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), reads = []
  let calls = 0
  const options = { signal: caller.signal }
  for (const name of ['fetchPage', 'fetchJson', 'now']) Object.defineProperty(options, name, { get() {
    assert.equal(this, options); reads.push(name)
    if (name === key) { caller.abort(reason); if (mode === 'throw') throw Error('Authored getter replacement') }
    return () => { calls++; throw Error('Cancelled collaborator must not start') }
  } })
  exact(await reflect(suki.run(options)), reason)
  assert.deepEqual(reads, ['fetchPage', 'fetchJson', 'now'].slice(0, ['fetchPage', 'fetchJson', 'now'].indexOf(key) + 1))
  assert.equal(calls, 0); assert.deepEqual(descriptors(reason), before); clean(caller.signal)
})

for (const stage of ['careers', 'handoff']) for (const key of ['status', 'url', 'html']) for (const mode of ['return', 'throw']) for (const kind of kinds) test(`Suki ${stage} ${key} response getter abort ${kind} then ${mode} prevents later work`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), reads = [], calls = []
  let jsonCalls = 0, clocks = 0
  const result = await reflect(suki.run({ signal: caller.signal, fetchPage(url) {
    calls.push(stageFor(url))
    if (stageFor(url) !== stage) return pageFor(url)
    const response = {}
    for (const name of ['status', 'url', 'html']) Object.defineProperty(response, name, { get() {
      assert.equal(this, response); reads.push(name)
      if (name === key) { caller.abort(reason); if (mode === 'throw') throw Error('Authored response getter replacement') }
      return name === 'status' ? 200 : name === 'url' ? url : pageFor(url).html
    } })
    return response
  }, fetchJson() { jsonCalls++; return emptyFeed() }, now() { clocks++; return stamp } }))
  exact(result, reason); assert.deepEqual(reads, ['status', 'url', 'html'].slice(0, ['status', 'url', 'html'].indexOf(key) + 1))
  assert.deepEqual(calls, ['careers', 'handoff'].slice(0, stage === 'careers' ? 1 : 2)); assert.equal(jsonCalls, 0); assert.equal(clocks, 0)
  assert.deepEqual(descriptors(reason), before); clean(caller.signal)
})

for (const mode of ['return', 'throw', 'payload-getter']) for (const kind of kinds) test(`Suki ${mode} clock/extraction boundary abort ${kind} remains exact`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason)
  let clockCalls = 0, payloadReads = 0
  const payload = mode === 'payload-getter' ? { get jobs() { payloadReads++; caller.abort(reason); throw Error('Authored payload replacement') } }
    : { get jobs() { payloadReads++; throw Error('Clock cancellation must precede extraction') } }
  const result = await reflect(suki.run({ signal: caller.signal, fetchPage: pageFor, fetchJson: () => payload, now() {
    clockCalls++
    if (mode !== 'payload-getter') caller.abort(reason)
    if (mode === 'throw') throw Error('Authored clock replacement')
    return stamp
  } }))
  exact(result, reason); assert.equal(clockCalls, 1); assert.equal(payloadReads, mode === 'payload-getter' ? 1 : 0)
  assert.deepEqual(descriptors(reason), before); clean(caller.signal)
})

for (const stage of ['careers', 'handoff']) for (const mode of ['return', 'throw']) for (const kind of kinds) test(`Suki default ${stage} text getter abort ${kind} then ${mode} prevents body admission`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason), calls = []
  let bodyCalls = 0, getters = 0, jsonCalls = 0
  globalThis.fetch = (url, init) => {
    calls.push(stageFor(url)); assert.ok(init.signal instanceof AbortSignal)
    if (stageFor(url) !== stage) return { status: 200, url, text() { return pageFor(url).html } }
    return { status: 200, url, get text() {
      getters++; caller.abort(reason); if (mode === 'throw') throw Error('Authored body getter replacement')
      return function () { bodyCalls++; return pageFor(url).html }
    } }
  }
  let result
  try { result = await reflect(suki.run({ signal: caller.signal, fetchJson() { jsonCalls++; return emptyFeed() } })) } finally { globalThis.fetch = deny }
  exact(result, reason); assert.equal(bodyCalls, 0); assert.equal(getters, 1); assert.equal(jsonCalls, 0)
  assert.deepEqual(calls, ['careers', 'handoff'].slice(0, stage === 'careers' ? 1 : 2)); assert.deepEqual(descriptors(reason), before); clean(caller.signal)
})

for (const mode of ['throw', 'reject', 'stalled']) for (const kind of kinds) test(`Suki default HTML body abort ${kind} then ${mode} is bounded with late rejection owned`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), before = descriptors(reason)
  const deferred = mode === 'stalled' ? Promise.withResolvers() : null
  const replacement = Object.freeze(Error('Authored body replacement'))
  let calls = 0, bodies = 0, settled = false
  globalThis.fetch = url => {
    calls++
    const response = { status: 200, url, text() {
      assert.equal(this, response); bodies++; caller.abort(reason)
      if (mode === 'throw') throw replacement
      if (mode === 'reject') return Promise.reject(replacement)
      return deferred.promise
    } }
    return response
  }
  let result, settledBeforeRelease
  try {
    const pending = reflect(suki.run({ signal: caller.signal, fetchJson: emptyFeed }))
    pending.then(() => { settled = true }); await turn(); settledBeforeRelease = settled
    if (deferred) deferred.reject(replacement)
    result = await pending; await turn()
  } finally { globalThis.fetch = deny }
  assert.equal(settledBeforeRelease, true); exact(result, reason); assert.equal(calls, 1); assert.equal(bodies, 1)
  assert.deepEqual(descriptors(reason), before); clean(caller.signal)
})

for (const kind of kinds) test(`Suki default late fetch ${kind} never admits the returned body`, async () => {
  const caller = new AbortController(), reason = reasonFor(kind), deferred = Promise.withResolvers()
  let bodies = 0, calls = 0, settled = false
  globalThis.fetch = () => { calls++; caller.abort(reason); return deferred.promise }
  let result, settledBeforeRelease
  try {
    const pending = reflect(suki.run({ signal: caller.signal, fetchJson: emptyFeed }))
    pending.then(() => { settled = true }); await turn(); settledBeforeRelease = settled
    deferred.resolve({ status: 200, url: suki.CAREERS_PAGE_URL, text() { bodies++; return careersHtml } })
    result = await pending; await turn(); await turn()
  } finally { globalThis.fetch = deny }
  assert.equal(settledBeforeRelease, true); exact(result, reason); assert.equal(bodies, 0); assert.equal(calls, 1); clean(caller.signal)
})

const primaries = [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze(Error('Authored ordinary primary'))]]
for (const stage of ['careers', 'handoff', 'feed']) for (const mode of ['throw', 'reject']) for (const [kind, primary] of primaries) test(`Suki ordinary ${stage} ${mode} ${kind} remains exact`, async () => {
  const caller = new AbortController(), calls = []
  const produce = url => { calls.push(stageFor(url)); if (stageFor(url) === stage) { if (mode === 'throw') throw primary; return Promise.reject(primary) } return pageFor(url) }
  exact(await reflect(suki.run({ signal: caller.signal, fetchPage: produce, fetchJson: produce })), primary)
  assert.deepEqual(calls, ['careers', 'handoff', 'feed'].slice(0, ['careers', 'handoff', 'feed'].indexOf(stage) + 1)); assert.equal(caller.signal.aborted, false); clean(caller.signal)
})
for (const key of ['fetchPage', 'fetchJson', 'now']) for (const [kind, primary] of primaries) test(`Suki ordinary ${key} option getter ${kind} remains exact`, async () => {
  let calls = 0
  const options = { fetchPage() { calls++; throw Error('No transport admission') } }
  Object.defineProperty(options, key, { get() { throw primary } })
  exact(await reflect(suki.run(options)), primary); assert.equal(calls, 0)
})
for (const [kind, primary] of primaries) test(`Suki ordinary clock ${kind} remains exact`, async () => {
  exact(await reflect(suki.run({ fetchPage: pageFor, fetchJson: emptyFeed, now() { throw primary } })), primary)
})

test('Suki default HTML requests retain headers, 15s timeout, body receiver, one method read and source call order', async () => {
  const caller = new AbortController(), calls = [], originalTimeout = AbortSignal.timeout, timeouts = []
  let getters = 0, bodies = 0, clocks = 0
  AbortSignal.timeout = ms => { timeouts.push(ms); return new AbortController().signal }
  globalThis.fetch = (url, init) => {
    calls.push(url); assert.equal(init.redirect, 'follow'); assert.match(init.headers['User-Agent'], /Chrome\/138/)
    assert.equal(init.headers.Accept, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'); assert.ok(init.signal instanceof AbortSignal)
    const response = { status: 200, url, get text() { getters++; return function () { assert.equal(this, response); bodies++; return Promise.resolve(pageFor(url).html) } } }
    return response
  }
  try {
    const jobs = await suki.run({ signal: caller.signal, fetchJson(url, init) { assert.equal(this, undefined); assert.equal(init.signal, caller.signal); calls.push(url); return jobFeed() }, now() { assert.equal(this, undefined); clocks++; return stamp } })
    assert.equal(jobs.length, 1); assert.equal(jobs[0].source, 'suki'); assert.equal(jobs[0].country, 'India'); assert.equal(jobs[0].closingDate, '2026-12-01'); assert.equal(jobs[0].scrapedAt, stamp)
    assert.deepEqual(calls, [suki.CAREERS_PAGE_URL, suki.OFFICIAL_CAREERS_HANDOFF_URL, suki.GREENHOUSE_JOBS_API_URL])
    assert.deepEqual(timeouts, [15000, 15000]); assert.equal(getters, 2); assert.equal(bodies, 2); assert.equal(clocks, 1); clean(caller.signal)
  } finally { globalThis.fetch = deny; AbortSignal.timeout = originalTimeout }
})

test('Suki normal option reads preserve receiver and relative order; a promise-valued clock stays boxed as source data', async () => {
  const options = {}, reads = [], caller = new AbortController(), clockValue = Promise.resolve(stamp)
  const values = { signal: caller.signal, fetchPage(url) { assert.equal(this, undefined); return pageFor(url) }, fetchJson() { assert.equal(this, undefined); return jobFeed() }, now() { assert.equal(this, undefined); return clockValue } }
  for (const key of ['fetchPage', 'fetchJson', 'now', 'signal']) Object.defineProperty(options, key, { get() { assert.equal(this, options); reads.push(key); return values[key] } })
  const pending = reflect(suki.createSukiScraper().run(options))
  assert.deepEqual(reads.filter(key => key !== 'signal'), ['fetchPage', 'fetchJson', 'now']); assert.equal(reads.filter(key => key === 'signal').length, 1)
  const result = await pending; assert.equal(result.ok, true); assert.equal(result.value[0].scrapedAt, clockValue); clean(caller.signal)
})

test('Suki explicit null collaborators retain ordinary invalid-method behavior and never select defaults', async () => {
  const result = await reflect(suki.run({ fetchPage: null }))
  assert.equal(result.ok, false); assert.ok(result.reason instanceof TypeError)
})

test('Suki lifecycle protocols made no actual network or DB attempt', () => {
  assert.equal(networkAttempts, 0); assert.equal(databaseAttempts, 0)
  if (process.permission) for (const kind of ['addons', 'worker', 'child']) assert.equal(process.permission.has(kind), false)
})
