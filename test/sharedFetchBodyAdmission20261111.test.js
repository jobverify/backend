import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks, syncBuiltinESMExports } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import http2 from 'node:http2'
import net from 'node:net'
import tls from 'node:tls'
import dns from 'node:dns'
import dgram from 'node:dgram'

// Authored lifecycle protocols only: no employer response, vacancy, native
// inventory or country-coverage observation is supplied by this test file.
let networkAttempts = 0, databaseAttempts = 0
const deny = () => { networkAttempts++; throw Error('Shared fetch body tests forbid actual network') }
globalThis.fetch = deny
for (const module of [http, https]) { module.get = deny; module.request = deny }
http2.connect = deny; net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny
tls.connect = deny; dgram.createSocket = deny
for (const module of [dns, dns.promises]) for (const key of Object.keys(module)) if (/^(?:lookup|resolve)/.test(key) && typeof module[key] === 'function') module[key] = deny
syncBuiltinESMExports()
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'mongoose' || /(?:^|\/)saveToDB\.js$/.test(specifier)) { databaseAttempts++; throw Error('DB imports are outside shared fetch body tests') }
  return nextResolve(specifier, context)
} })
const { fetchTextWithRetry, fetchJsonWithRetry } = await import('../scraper-support/utils/fetch.js')
const { getRetryMetadata } = await import('../scraper-support/utils/retry.js')
const url = 'https://authored.invalid/body-boundary'
const variants = [
  { name: 'text', read: fetchTextWithRetry, method: 'text', mime: 'text/html', value: () => 'Authored text' },
  { name: 'json', read: fetchJsonWithRetry, method: 'json', mime: 'application/json', value: () => ({ authored: true }) },
  { name: 'html-as-json', read: fetchJsonWithRetry, method: 'text', mime: 'text/html', value: () => '<title>Authored shell</title><p>Plain HTML</p>' },
]
const kinds = ['null', 'false', 'zero', 'empty', 'frozen', 'default', 'network', 'frozen-network', 'opaque', 'symbol']
const infoFor = kind => {
  let reads = 0
  const value = kind === 'null' ? null : kind === 'false' ? false : kind === 'zero' ? 0 : kind === 'empty' ? ''
    : kind === 'default' ? AbortSignal.abort().reason : kind === 'symbol' ? Symbol('authored caller') : kind === 'opaque' ? Object.create(null)
      : kind === 'network' || kind === 'frozen-network' ? Object.assign(Error('Authored network caller'), { code: 'ECONNRESET' }) : Error('Authored caller')
  if (kind === 'opaque') for (const key of ['message', 'name', 'code', 'cause', 'then', 'toString', 'valueOf', Symbol.toPrimitive]) Object.defineProperty(value, key, { get() { reads++; throw Error('Caller reason must remain opaque') } })
  if (['opaque', 'frozen', 'frozen-network'].includes(kind)) Object.freeze(value)
  const before = value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
  return { value, check() { assert.equal(reads, 0); if (before) assert.deepEqual(Object.getOwnPropertyDescriptors(value), before) } }
}
const reflect = promise => Promise.resolve(promise).then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason, reason), 'The exact opaque caller must survive') }
const primary = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason.cause, reason), 'Existing retry wrapper must retain the ordinary primary') }
const turn = () => new Promise(resolve => setImmediate(resolve))
const responseFor = variant => ({ ok: true, status: 200, url, headers: new Headers({ 'content-type': variant.mime }) })
const invoke = (variant, fetchImpl, signal, extra = {}) => variant.read(url, { attempts: 1, baseDelayMs: 0, timeoutMs: 0, signal, fetchImpl, ...extra })

for (const variant of variants) for (const mode of ['return', 'throw']) for (const kind of kinds) test(`shared ${variant.name} body getter abort ${kind} then ${mode} admits no method`, async () => {
  const caller = new AbortController(), info = infoFor(kind), response = responseFor(variant)
  let requests = 0, reads = 0, bodies = 0
  Object.defineProperty(response, variant.method, { get() {
    assert.equal(this, response); reads++; caller.abort(info.value)
    if (mode === 'throw') throw Error('Authored replacement getter failure')
    return function () { assert.equal(this, response); bodies++; return Promise.resolve(variant.value()) }
  } })
  exact(await reflect(invoke(variant, () => { requests++; return response }, caller.signal)), info.value)
  assert.equal(requests, 1); assert.equal(reads, 1); assert.equal(bodies, 0); info.check()
})

for (const variant of variants) for (const kind of kinds) test(`shared ${variant.name} pre-aborted ${kind} reads no response/body collaborator`, async () => {
  const caller = new AbortController(), info = infoFor(kind)
  let requests = 0
  caller.abort(info.value)
  exact(await reflect(invoke(variant, () => { requests++; throw Error('No transport admission') }, caller.signal)), info.value)
  assert.equal(requests, 0); info.check()
})

for (const variant of variants) for (const order of ['caller-first', 'attempt-first']) for (const kind of kinds) test(`shared ${variant.name} getter observes ${order} ${kind} with caller priority and zero body calls`, async t => {
  const caller = new AbortController(), deadline = new AbortController(), info = infoFor(kind), response = responseFor(variant)
  const timeout = Object.freeze(new DOMException('Authored attempt deadline', 'TimeoutError'))
  t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
  let bodies = 0
  Object.defineProperty(response, variant.method, { get() {
    if (order === 'caller-first') { caller.abort(info.value); deadline.abort(timeout) }
    else { deadline.abort(timeout); caller.abort(info.value) }
    return function () { bodies++; return Promise.resolve(variant.value()) }
  } })
  exact(await reflect(invoke(variant, () => response, caller.signal, { timeoutMs: 1 })), info.value)
  assert.equal(bodies, 0); info.check()
})

for (const variant of variants) test(`shared ${variant.name} own attempt deadline after method getter prevents invocation`, async t => {
  t.mock.method(console, 'warn', () => {})
  const deadline = new AbortController(), reason = Object.freeze(new DOMException('Authored own attempt timeout', 'TimeoutError')), response = responseFor(variant)
  t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
  let reads = 0, bodies = 0
  Object.defineProperty(response, variant.method, { get() { reads++; deadline.abort(reason); return function () { bodies++; return Promise.resolve(variant.value()) } } })
  primary(await reflect(invoke(variant, () => response, undefined, { timeoutMs: 1 })), reason)
  assert.equal(reads, 1); assert.equal(bodies, 0)
})

for (const variant of variants) for (const kind of kinds) test(`shared ${variant.name} cancellation from ok getter prevents even reading the body method: ${kind}`, async () => {
  const caller = new AbortController(), info = infoFor(kind), response = responseFor(variant)
  let reads = 0, bodies = 0
  Object.defineProperty(response, 'ok', { get() { caller.abort(info.value); return true } })
  Object.defineProperty(response, variant.method, { get() { reads++; return function () { bodies++; return Promise.resolve(variant.value()) } } })
  exact(await reflect(invoke(variant, () => response, caller.signal)), info.value)
  assert.equal(reads, 0); assert.equal(bodies, 0); info.check()
})
for (const variant of variants.filter(v => v.name !== 'text')) for (const kind of kinds) test(`shared ${variant.name} MIME observer cancellation prevents body lookup: ${kind}`, async () => {
  const caller = new AbortController(), info = infoFor(kind), response = responseFor(variant)
  let reads = 0, bodies = 0
  response.headers = { get(name) { assert.equal(name, 'content-type'); caller.abort(info.value); return variant.mime } }
  Object.defineProperty(response, variant.method, { get() { reads++; return function () { bodies++; return Promise.resolve(variant.value()) } } })
  exact(await reflect(invoke(variant, () => response, caller.signal)), info.value)
  assert.equal(reads, 0); assert.equal(bodies, 0); info.check()
})

for (const variant of variants) for (const kind of kinds) test(`shared ${variant.name} invoked method abort ${kind} keeps its late rejection owned`, async () => {
  const caller = new AbortController(), info = infoFor(kind), response = responseFor(variant), deferred = Promise.withResolvers()
  let reads = 0, bodies = 0
  Object.defineProperty(response, variant.method, { get() { reads++; return function () { assert.equal(this, response); bodies++; caller.abort(info.value); return deferred.promise } } })
  const pending = reflect(invoke(variant, () => response, caller.signal))
  await turn(); deferred.reject(Object.freeze(Error('Authored late body replacement')))
  exact(await pending, info.value); await turn()
  assert.equal(reads, 1); assert.equal(bodies, 1); info.check()
})

const primaries = [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze(Error('Authored ordinary body primary'))]]
for (const variant of variants) for (const stage of ['getter', 'method']) for (const [kind, reason] of primaries) test(`shared ${variant.name} ordinary ${stage} ${kind} retains original retry cause`, async t => {
  t.mock.method(console, 'warn', () => {})
  const response = responseFor(variant)
  let reads = 0, bodies = 0
  Object.defineProperty(response, variant.method, { get() { reads++; if (stage === 'getter') throw reason; return function () { assert.equal(this, response); bodies++; throw reason } } })
  primary(await reflect(invoke(variant, () => response)), reason)
  assert.equal(reads, 1); assert.equal(bodies, stage === 'getter' ? 0 : 1)
})
for (const variant of variants.filter(v => v.name !== 'html-as-json')) for (const [kind, reason] of primaries) test(`shared ${variant.name} ordinary rejected ${kind} body retains original cause`, async t => {
  t.mock.method(console, 'warn', () => {})
  const response = responseFor(variant)
  response[variant.method] = () => Promise.reject(reason)
  primary(await reflect(invoke(variant, () => response)), reason)
})
for (const variant of variants) for (const [kind, value] of primaries) test(`shared ${variant.name} invalid ${kind} method remains TypeError without a default substitute`, async t => {
  t.mock.method(console, 'warn', () => {})
  const response = responseFor(variant)
  Object.defineProperty(response, variant.method, { get() { return value } })
  const result = await reflect(invoke(variant, () => response))
  assert.equal(result.ok, false); assert.ok(result.reason.cause instanceof TypeError)
})

for (const variant of variants.filter(v => v.name !== 'html-as-json')) for (const [kind, value] of [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''], ['object', { authored: true }]]) test(`shared ${variant.name} raw ${kind} return stays accepted with original identity`, async () => {
  const response = responseFor(variant)
  let reads = 0, bodies = 0
  Object.defineProperty(response, variant.method, { get() { reads++; return function () { assert.equal(this, response); bodies++; return value } } })
  const result = await invoke(variant, () => response)
  assert.ok(Object.is(result, value)); assert.equal(reads, 1); assert.equal(bodies, 1)
})
for (const variant of variants.filter(v => v.name !== 'html-as-json')) test(`shared ${variant.name} custom thenable keeps receiver, one read and normal response metadata`, async () => {
  const response = responseFor(variant), value = variant.value()
  let reads = 0, bodies = 0, thens = 0
  const thenable = { then(resolve) { assert.equal(this, thenable); thens++; resolve(value) } }
  Object.defineProperty(response, variant.method, { get() { reads++; return function () { assert.equal(this, response); bodies++; return thenable } } })
  const result = await invoke(variant, () => response, undefined, { includeResponseMetadata: true })
  assert.equal(result[variant.name === 'json' ? 'payload' : 'html'], value)
  assert.equal(result.status, 200); assert.equal(result.url, url); assert.deepEqual(getRetryMetadata(result), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 })
  assert.equal(reads, 1); assert.equal(bodies, 1); assert.equal(thens, 1)
})

for (const mode of ['promise-reject', 'custom-catch', 'plain-string', 'thenable-without-catch']) test(`shared HTML-as-JSON preserves its original ${mode} catch contract`, async t => {
  t.mock.method(console, 'warn', () => {})
  const response = responseFor(variants[2]); let reads = 0, bodies = 0, catches = 0, thens = 0
  const value = mode === 'promise-reject' ? Promise.reject(Error('Authored unreadable HTML')) : mode === 'plain-string' ? '<title>Authored raw</title>'
    : mode === 'thenable-without-catch' ? { then(resolve) { thens++; resolve('unselected') } }
      : { catch(_onRejected) { assert.equal(this, value); catches++; return '<title>Authored custom</title>' } }
  Object.defineProperty(response, 'text', { get() { reads++; return function () { assert.equal(this, response); bodies++; return value } } })
  const result = await reflect(invoke(variants[2], () => response))
  assert.equal(result.ok, false)
  if (['plain-string', 'thenable-without-catch'].includes(mode)) assert.ok(result.reason.cause instanceof TypeError)
  else { assert.match(result.reason.cause.message, /Expected JSON.*received HTML/); assert.equal(result.reason.cause.failureKind, 'parser_or_contract_error'); assert.equal(result.reason.cause.abortRetries, true) }
  assert.equal(reads, 1); assert.equal(bodies, 1); assert.equal(catches, mode === 'custom-catch' ? 1 : 0); assert.equal(thens, 0)
})

for (const [kind, read, body, contentType] of [['text', fetchTextWithRetry, 'Authored native Response text', 'text/plain'], ['json', fetchJsonWithRetry, '{"authored":true}', 'application/json']]) test(`shared ${kind} keeps native Response method receiver without network`, async () => {
  const response = new Response(body, { headers: { 'content-type': contentType } })
  const value = await read(url, { attempts: 1, timeoutMs: 0, fetchImpl: () => response })
  assert.deepEqual(value, kind === 'text' ? body : { authored: true }); assert.equal(response.bodyUsed, true)
})

test('shared body controls made no actual network, DB or expanded-capability attempt', () => {
  assert.equal(networkAttempts, 0); assert.equal(databaseAttempts, 0)
  if (process.permission) for (const kind of ['addons', 'worker', 'child']) assert.equal(process.permission.has(kind), false)
})
