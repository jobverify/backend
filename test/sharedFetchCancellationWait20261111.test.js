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

// Explicitly authored lifecycle protocols. No employer response, native
// vacancy/inventory, country fact or physical HTTP completion is supplied.
let networkAttempts = 0, databaseAttempts = 0
const deny = () => { networkAttempts++; throw Error('Shared wait tests forbid actual network') }
globalThis.fetch = deny
for (const module of [http, https]) { module.get = deny; module.request = deny }
http2.connect = deny; net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny
tls.connect = deny; dgram.createSocket = deny
for (const module of [dns, dns.promises]) for (const key of Object.keys(module)) if (/^(?:lookup|resolve)/.test(key) && typeof module[key] === 'function') module[key] = deny
syncBuiltinESMExports()
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'mongoose' || /(?:^|\/)saveToDB\.js$/.test(specifier)) { databaseAttempts++; throw Error('No DB module belongs in these controls') }
  return nextResolve(specifier, context)
} })
const { fetchTextWithRetry, fetchJsonWithRetry } = await import('../scraper-support/utils/fetch.js')
const { getRetryMetadata } = await import('../scraper-support/utils/retry.js')
const url = 'https://authored.invalid/pending-wait'
const variants = [
  { name: 'text', read: fetchTextWithRetry, method: 'text', mime: 'text/plain', value: () => 'Authored body' },
  { name: 'json', read: fetchJsonWithRetry, method: 'json', mime: 'application/json', value: () => ({ authored: true }) },
  { name: 'html-as-json', read: fetchJsonWithRetry, method: 'text', mime: 'text/html', value: () => '<title>Authored page</title>' },
]
const kinds = ['null', 'false', 'zero', 'empty', 'frozen', 'default', 'network', 'frozen-network', 'opaque', 'symbol']
const infoFor = kind => {
  let reads = 0
  const value = kind === 'null' ? null : kind === 'false' ? false : kind === 'zero' ? 0 : kind === 'empty' ? ''
    : kind === 'default' ? AbortSignal.abort().reason : kind === 'symbol' ? Symbol('Authored caller') : kind === 'opaque' ? Object.create(null)
      : ['network', 'frozen-network'].includes(kind) ? Object.assign(Error('Authored network caller'), { code: 'ECONNRESET' }) : Error('Authored caller')
  if (kind === 'opaque') for (const key of ['message', 'name', 'code', 'cause', 'then', 'toString', 'valueOf', Symbol.toPrimitive]) Object.defineProperty(value, key, { get() { reads++; throw Error('No caller reason inspection') } })
  if (['frozen', 'frozen-network', 'opaque'].includes(kind)) Object.freeze(value)
  const before = value !== null && typeof value === 'object' ? Object.getOwnPropertyDescriptors(value) : null
  return { value, check() { assert.equal(reads, 0); if (before) assert.deepEqual(Object.getOwnPropertyDescriptors(value), before) } }
}
const reflect = promise => Promise.resolve(promise).then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const exact = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason, reason), 'The exact opaque caller must survive') }
const primary = (result, reason) => { assert.equal(result.ok, false); assert.ok(Object.is(result.reason.cause, reason), 'The original retry cause must survive') }
const turn = () => new Promise(resolve => setImmediate(resolve))
const clean = signals => { for (const signal of new Set(signals.filter(Boolean))) assert.equal(getEventListeners(signal, 'abort').length, 0) }
const responseFor = variant => ({ ok: true, status: 200, url, headers: new Headers({ 'content-type': variant.mime }) })
const invoke = (variant, fetchImpl, signal, extra = {}) => variant.read(url, { attempts: 1, baseDelayMs: 0, timeoutMs: 0, signal, fetchImpl, ...extra })

for (const variant of variants) for (const stage of ['request', 'body']) for (const timing of ['inside-factory', 'external']) for (const late of ['fulfill', 'reject']) for (const kind of kinds) test(`shared ${variant.name} pending ${stage} ${timing} ${kind} settles before late ${late}`, async () => {
  const caller = new AbortController(), info = infoFor(kind), deferred = Promise.withResolvers(), response = responseFor(variant), signals = [caller.signal]
  let requests = 0, bodies = 0, entered = 0, settled = false
  const pendingValue = () => { entered++; if (timing === 'inside-factory') caller.abort(info.value); return deferred.promise }
  response[variant.method] = function () { assert.equal(this, response); bodies++; return stage === 'body' ? pendingValue() : Promise.resolve(variant.value()) }
  const pending = reflect(invoke(variant, function (_url, init) {
    assert.equal(this, undefined); assert.equal(_url, url); requests++; signals.push(init.signal)
    return stage === 'request' ? pendingValue() : response
  }, caller.signal))
  pending.then(() => { settled = true })
  await turn()
  assert.equal(entered, 1)
  if (timing === 'external') caller.abort(info.value)
  await turn()
  const settledBeforeRelease = settled
  if (late === 'reject') deferred.reject(Object.freeze(Error('Authored late producer rejection')))
  else deferred.resolve(stage === 'request' ? response : variant.value())
  const result = await pending; await turn(); await turn()
  assert.equal(settledBeforeRelease, true, 'Cancellation must settle while the admitted producer is still pending')
  exact(result, info.value); assert.equal(requests, 1); assert.equal(bodies, stage === 'body' ? 1 : 0)
  info.check(); clean(signals)
})

for (const variant of variants) for (const kind of kinds) test(`shared ${variant.name} pre-aborted ${kind} admits no request factory`, async () => {
  const caller = new AbortController(), info = infoFor(kind)
  let requests = 0
  caller.abort(info.value)
  exact(await reflect(invoke(variant, () => { requests++; throw Error('No request admission') }, caller.signal)), info.value)
  assert.equal(requests, 0); info.check(); clean([caller.signal])
})

for (const variant of variants) for (const stage of ['request', 'body']) for (const mode of ['throw', 'reject']) for (const kind of kinds) test(`shared ${variant.name} ${stage} factory abort ${kind} then ${mode} owns the original result`, async () => {
  const caller = new AbortController(), info = infoFor(kind), response = responseFor(variant), signals = [caller.signal]
  const replacement = Object.freeze(Error('Authored synchronous/async replacement'))
  let requests = 0, bodies = 0
  const produce = () => { caller.abort(info.value); if (mode === 'throw') throw replacement; return Promise.reject(replacement) }
  response[variant.method] = function () { assert.equal(this, response); bodies++; return stage === 'body' ? produce() : Promise.resolve(variant.value()) }
  exact(await reflect(invoke(variant, (_url, init) => { requests++; signals.push(init.signal); return stage === 'request' ? produce() : response }, caller.signal)), info.value)
  await turn(); assert.equal(requests, 1); assert.equal(bodies, stage === 'body' ? 1 : 0); info.check(); clean(signals)
})

for (const variant of variants) for (const stage of ['request', 'body']) for (const late of ['fulfill', 'reject']) test(`shared ${variant.name} existing attempt signal bounds a pending ${stage} before ${late}`, async t => {
  t.mock.method(console, 'warn', () => {})
  const deadline = new AbortController(), reason = Object.freeze(new DOMException('Authored existing attempt deadline', 'TimeoutError')), deferred = Promise.withResolvers(), response = responseFor(variant), signals = [deadline.signal]
  t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
  let settled = false, requests = 0, bodies = 0
  response[variant.method] = () => { bodies++; return stage === 'body' ? deferred.promise : Promise.resolve(variant.value()) }
  const pending = reflect(invoke(variant, (_url, init) => { requests++; signals.push(init.signal); return stage === 'request' ? deferred.promise : response }, undefined, { timeoutMs: 1 }))
  pending.then(() => { settled = true }); await turn(); deadline.abort(reason); await turn()
  const settledBeforeRelease = settled
  if (late === 'reject') deferred.reject(Error('Authored late timeout replacement'))
  else deferred.resolve(stage === 'request' ? response : variant.value())
  const result = await pending; await turn()
  assert.equal(settledBeforeRelease, true); primary(result, reason); assert.equal(requests, 1); assert.equal(bodies, stage === 'body' ? 1 : 0); clean(signals)
})

for (const variant of variants) for (const stage of ['request', 'body']) for (const order of ['caller-first', 'attempt-first']) for (const kind of kinds) test(`shared ${variant.name} pending ${stage} observes ${order} ${kind} with caller priority`, async t => {
  const caller = new AbortController(), deadline = new AbortController(), info = infoFor(kind), deferred = Promise.withResolvers(), response = responseFor(variant), signals = [caller.signal, deadline.signal]
  const timeout = Object.freeze(new DOMException('Authored attempt reason', 'TimeoutError'))
  t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
  let settled = false
  response[variant.method] = () => stage === 'body' ? deferred.promise : Promise.resolve(variant.value())
  const pending = reflect(invoke(variant, (_url, init) => { signals.push(init.signal); return stage === 'request' ? deferred.promise : response }, caller.signal, { timeoutMs: 1 }))
  pending.then(() => { settled = true }); await turn()
  if (order === 'caller-first') { caller.abort(info.value); deadline.abort(timeout) }
  else { deadline.abort(timeout); caller.abort(info.value) }
  await turn(); const settledBeforeRelease = settled
  deferred.reject(Error('Authored late dual-abort replacement'))
  const result = await pending; await turn()
  assert.equal(settledBeforeRelease, true); exact(result, info.value); info.check(); clean(signals)
})

for (const variant of variants) test(`shared ${variant.name} already-expired existing attempt admits no request`, async t => {
  t.mock.method(console, 'warn', () => {})
  const deadline = new AbortController(), reason = Object.freeze(new DOMException('Authored already elapsed attempt', 'TimeoutError'))
  deadline.abort(reason); t.mock.method(AbortSignal, 'timeout', () => deadline.signal)
  let requests = 0
  primary(await reflect(invoke(variant, () => { requests++; return responseFor(variant) }, undefined, { timeoutMs: 1 })), reason)
  assert.equal(requests, 0); clean([deadline.signal])
})

for (const variant of variants) test(`shared ${variant.name} actual existing timeout bounds an ignored signal without a new deadline`, async t => {
  t.mock.method(console, 'warn', () => {})
  const deferred = Promise.withResolvers(), response = responseFor(variant), signals = []
  const stage = variant.name === 'text' ? 'request' : 'body'
  let timer
  response[variant.method] = () => stage === 'body' ? deferred.promise : Promise.resolve(variant.value())
  const pending = reflect(invoke(variant, (_url, init) => { signals.push(init.signal); return stage === 'request' ? deferred.promise : response }, undefined, { timeoutMs: 5 }))
  const window = new Promise(resolve => { timer = setTimeout(() => resolve(null), 80) })
  const observed = await Promise.race([pending, window]); clearTimeout(timer)
  deferred.reject(Error('Authored forced release after timeout observation'))
  const result = await pending; await turn()
  assert.ok(observed !== null, 'The existing attempt deadline must settle the exported call')
  assert.equal(result.ok, false); assert.equal(result.reason.cause, signals[0].reason); assert.equal(signals[0].reason.name, 'TimeoutError'); clean(signals)
})

for (const variant of variants) test(`shared ${variant.name} registers before both factories and cleans own listeners after ordinary completion`, async t => {
  t.mock.method(console, 'warn', () => {})
  const caller = new AbortController(), response = responseFor(variant), signals = [caller.signal]
  let requestListeners = 0, bodyListeners = 0
  response[variant.method] = function () { assert.equal(this, response); bodyListeners = getEventListeners(signals[1], 'abort').length; return Promise.resolve(variant.value()) }
  const result = await reflect(invoke(variant, (_url, init) => { signals.push(init.signal); requestListeners = getEventListeners(init.signal, 'abort').length; return response }, caller.signal))
  assert.equal(result.ok, variant.name !== 'html-as-json'); assert.ok(requestListeners > 0); assert.ok(bodyListeners > 0); clean(signals)
})

for (const variant of variants) test(`shared ${variant.name} response then getter is assimilated only once at the request wait`, async t => {
  t.mock.method(console, 'warn', () => {})
  const caller = new AbortController(), response = responseFor(variant)
  let thenReads = 0
  Object.defineProperty(response, 'then', { get() { thenReads++; return undefined } })
  response[variant.method] = () => Promise.resolve(variant.value())
  const result = await reflect(invoke(variant, () => response, caller.signal))
  assert.equal(result.ok, variant.name !== 'html-as-json'); assert.equal(thenReads, 1); clean([caller.signal])
})
for (const variant of variants.filter(v => v.name !== 'html-as-json')) test(`shared ${variant.name} metadata boxes a raw body value without extra then inspection`, async () => {
  const caller = new AbortController(), response = responseFor(variant)
  let thenReads = 0
  const value = { authored: true, get then() { thenReads++; return undefined } }
  response[variant.method] = () => value
  const result = await invoke(variant, () => response, caller.signal, { includeResponseMetadata: true })
  assert.equal(result[variant.name === 'json' ? 'payload' : 'html'], value); assert.equal(thenReads, 1)
  assert.deepEqual(getRetryMetadata(result), { attemptsUsed: 1, retries: 0, retryDelayMs: 0 }); clean([caller.signal])
})

for (const variant of variants) for (const stage of ['request', 'body']) test(`shared ${variant.name} ordinary ${stage} native Promise constructor is read only by the original await/catch`, async t => {
  t.mock.method(console, 'warn', () => {})
  const caller = new AbortController(), response = responseFor(variant)
  let constructors = 0
  const tracked = Promise.resolve(stage === 'request' ? response : variant.value())
  Object.defineProperty(tracked, 'constructor', { get() { constructors++; return Promise } })
  response[variant.method] = () => stage === 'body' ? tracked : Promise.resolve(variant.value())
  const result = await reflect(invoke(variant, () => stage === 'request' ? tracked : response, caller.signal))
  assert.equal(result.ok, variant.name !== 'html-as-json'); assert.equal(constructors, 1); clean([caller.signal])
})
for (const variant of variants) for (const stage of variant.name === 'html-as-json' ? ['request'] : ['request', 'body']) test(`shared ${variant.name} ordinary ${stage} native Promise does not read an unused own then getter`, async () => {
  const caller = new AbortController(), response = responseFor(variant)
  let thenReads = 0
  const tracked = Promise.resolve(stage === 'request' ? response : variant.value())
  Object.defineProperty(tracked, 'then', { get() { thenReads++; throw Error('The original native await does not inspect this own then getter') } })
  response[variant.method] = () => stage === 'body' ? tracked : Promise.resolve(variant.value())
  const result = await reflect(invoke(variant, () => stage === 'request' ? tracked : response, caller.signal))
  assert.equal(result.ok, variant.name !== 'html-as-json'); assert.equal(thenReads, 0); clean([caller.signal])
})
test('shared HTML catch keeps its original native Promise own then lookup and ordinary primary', async t => {
  t.mock.method(console, 'warn', () => {})
  const caller = new AbortController(), response = responseFor(variants[2]), reason = Object.freeze(Error('Authored catch then primary'))
  const tracked = Promise.resolve(variants[2].value())
  let thenReads = 0
  Object.defineProperty(tracked, 'then', { get() { thenReads++; throw reason } })
  response.text = () => tracked
  primary(await reflect(invoke(variants[2], () => response, caller.signal)), reason)
  assert.equal(thenReads, 1); clean([caller.signal])
})

const primaries = [['undefined', undefined], ['null', null], ['false', false], ['zero', 0], ['empty', ''], ['frozen', Object.freeze(Error('Authored ordinary primary'))]]
for (const variant of variants) for (const stage of ['request', 'body']) for (const [kind, reason] of primaries) test(`shared ${variant.name} ordinary ${stage} ${kind} retains retry cause and releases own listeners`, async t => {
  t.mock.method(console, 'warn', () => {})
  const caller = new AbortController(), response = responseFor(variant), signals = [caller.signal]
  response[variant.method] = () => { if (stage === 'body') throw reason; return Promise.resolve(variant.value()) }
  primary(await reflect(invoke(variant, (_url, init) => { signals.push(init.signal); if (stage === 'request') throw reason; return response }, caller.signal)), reason)
  assert.equal(caller.signal.aborted, false); clean(signals)
})

for (const stage of ['request', 'body']) test(`shared pending ${stage} ignores a synthetic non-aborting event and still observes later real caller abort`, async () => {
  const caller = new AbortController(), response = responseFor(variants[1]), deferred = Promise.withResolvers()
  let settled = false
  response.json = () => stage === 'body' ? deferred.promise : { authored: true }
  const pending = reflect(invoke(variants[1], () => stage === 'request' ? deferred.promise : response, caller.signal))
  pending.then(() => { settled = true }); await turn()
  caller.signal.dispatchEvent(new Event('abort'))
  assert.equal(caller.signal.aborted, false)
  caller.abort(false); await turn(); const settledBeforeRelease = settled
  deferred.reject(Error('Authored late release after a non-aborting event'))
  exact(await pending, false); await turn()
  assert.equal(settledBeforeRelease, true); clean([caller.signal])
})

test('shared wait controls made no actual network, DB or expanded-capability attempt', () => {
  assert.equal(networkAttempts, 0); assert.equal(databaseAttempts, 0)
  if (process.permission) for (const kind of ['addons', 'worker', 'child']) assert.equal(process.permission.has(kind), false)
})
