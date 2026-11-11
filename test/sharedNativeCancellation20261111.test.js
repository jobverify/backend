import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'
import https from 'node:https'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'

// Synthetic collaborators and task-boundary HTTPS/proxy protocols only. No
// DNS/socket/TLS/HTTP/DB/browser/model operation or native inventory is supplied.
const proxyURL = new URL('../scraper-support/native-sources/publicNativeGetSources/pinnedProxyAgent.js', import.meta.url).href
const mockedProxy = 'data:text/javascript,' + encodeURIComponent(`export {publicProxyError} from ${JSON.stringify(proxyURL)};export const createPinnedProxyAgent=(...args)=>globalThis.__sharedNativeProxy(...args);`)
globalThis.__sharedNativeProxy = () => null
registerHooks({ resolve(specifier, context, next) {
  return specifier === './pinnedProxyAgent.js' && context.parentURL?.includes('/publicNativeGetSources/safeTransport.js')
    ? { url: mockedProxy, shortCircuit: true } : next(specifier, context)
} })
const { createPublicPageReader, pinnedHTTPSFetch } = await import('../scraper-support/native-sources/publicNativeGetSources/safeTransport.js')
const { createPeopleStrongPairScraper } = await import('../scraper-support/shared/peopleStrongNativePair20261027.js')
const { scenario } = await import('../scraper-support/tests/peopleStrongNativePair20261027.fixtures.js')
const now = '2026-11-11T00:00:00.000Z'
const reasons = [['null', null], ['false', false], ['zero', 0], ['empty', ''],
  ['frozen', Object.freeze(Error('Synthetic frozen cancellation'))], ['native-default', AbortSignal.abort().reason]]
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const reflect = promise => promise.then(value => ({ ok: true, value }), reason => ({ ok: false, reason }))
const turn = () => new Promise(resolve => setImmediate(resolve))
const bounded = async promise => { let timer; try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve({ pending: true }), 100) })]) } finally { clearTimeout(timer) } }
let sequence = 0
const url = () => 'https://synthetic-native-' + (++sequence) + '.example.test/careers'
const exact = (result, reason) => { assert.equal(result.pending, undefined); assert.equal(result.ok, false); assert.equal(result.reason, reason) }

for (const [kind, reason] of reasons) for (const api of ['public', 'people']) for (const stage of ['pre-aborted', 'in-flight', 'throwing-transport']) {
  test(`${api} ${stage} preserves ${kind} caller reason`, async () => {
    const controller = new AbortController(), replacement = Object.freeze(Error('Synthetic transport replacement'))
    let calls = 0
    const fetchPage = () => { calls++; if (stage === 'throwing-transport') { controller.abort(reason); throw replacement }
      queueMicrotask(() => controller.abort(reason)); return new Promise(() => {}) }
    if (stage === 'pre-aborted') controller.abort(reason)
    const pending = api === 'public' ? createPublicPageReader({ signal: controller.signal, fetchPage }).read(url())
      : createPeopleStrongPairScraper('anthem').run({ signal: controller.signal, fetchPage, now })
    exact(await bounded(reflect(pending)), reason); assert.equal(calls, stage === 'pre-aborted' ? 0 : 1)
  })
}
test('immediate false cancellation prevents a queued DNS collaborator', async () => {
  const controller = new AbortController(); let dns = 0, requests = 0
  const reader = createPublicPageReader({ signal: controller.signal, resolveHost: async () => { dns++; return [{ address: '8.8.8.8', family: 4 }] },
    testOnlyInjectedTransport: true, fetchImpl: () => { requests++; throw Error('Cancelled DNS must not reach transport') } })
  const pending = reflect(reader.read(url())); controller.abort(false)
  exact(await pending, false); await turn(); assert.equal(dns, 0); assert.equal(requests, 0)
})
for (const [kind, reason] of reasons) {
  test(`PeopleStrong observation clock abort plus throw preserves ${kind}`, async () => {
    const controller = new AbortController(); let calls = 0
    exact(await reflect(createPeopleStrongPairScraper('anthem').run({ signal: controller.signal,
      now: () => { controller.abort(reason); throw Error('Synthetic clock replacement') }, fetchPage: () => { calls++; throw Error('No transport') } })), reason)
    assert.equal(calls, 0)
  })
  test(`PeopleStrong awaited report abort plus throw preserves ${kind}`, async () => {
    const controller = new AbortController(), fixture = scenario('anthem')
    exact(await reflect(createPeopleStrongPairScraper('anthem').run({ signal: controller.signal, fetchPage: fixture.fetchPage, now,
      onReport: async () => { controller.abort(reason); throw Error('Synthetic report replacement') } })), reason)
  })
  test(`public request observer abort plus throw preserves ${kind}`, async () => {
    const controller = new AbortController(); let requests = 0
    const reader = createPublicPageReader({ signal: controller.signal, resolveHost: async () => [{ address: '8.8.8.8', family: 4 }], testOnlyInjectedTransport: true,
      fetchImpl: () => { requests++; assert.fail('Cancelled request observer admitted transport') },
      onRequest: () => { controller.abort(reason); throw Error('Synthetic observer replacement') } })
    exact(await reflect(reader.read(url())), reason); assert.equal(requests, 0)
  })
}
test('PeopleStrong stalled report is cancelled without waiting for its late rejection', async () => {
  const controller = new AbortController(), fixture = scenario('anthem'), entered = deferred(), release = deferred()
  const pending = reflect(createPeopleStrongPairScraper('anthem').run({ signal: controller.signal, fetchPage: fixture.fetchPage, now,
    onReport: () => { entered.resolve(); return release.promise } }))
  await entered.promise; controller.abort(false); const early = await bounded(pending)
  release.reject(Error('Synthetic late report rejection')); await pending; await turn(); exact(early, false)
})
test('PeopleStrong late fetch completion after cancellation cannot start text body work', async t => {
  const controller = new AbortController(), entered = deferred(), release = deferred(); let bodies = 0, cancelled = 0
  t.mock.method(globalThis, 'fetch', () => { entered.resolve(); return release.promise })
  const pending = reflect(createPeopleStrongPairScraper('anthem').run({ signal: controller.signal, now }))
  await entered.promise; controller.abort(false); const early = await bounded(pending)
  release.resolve({ status: 200, url: 'https://anthembio.com/careers/', text: async () => { bodies++; return '' }, body: { cancel: async () => { cancelled++ } } })
  await pending; await turn(); await turn(); exact(early, false); assert.equal(bodies, 0); assert.equal(cancelled, 1)
})
test('public late transport response cancels its body once and never acquires a reader', async () => {
  const controller = new AbortController(), entered = deferred(), release = deferred(); let cancelled = 0, readers = 0
  const reader = createPublicPageReader({ signal: controller.signal, resolveHost: async () => [{ address: '8.8.8.8', family: 4 }], testOnlyInjectedTransport: true,
    fetchImpl: () => { entered.resolve(); return release.promise } })
  const pending = reflect(reader.read(url())); await entered.promise; controller.abort(false); const early = await pending
  release.resolve({ body: { cancel: async () => { cancelled++; throw Error('Synthetic cleanup rejection') }, getReader: () => { readers++; assert.fail('Late body read') } } })
  await turn(); await turn(); exact(early, false); assert.equal(cancelled, 1); assert.equal(readers, 0)
})
test('public body cancellation and release errors cannot replace an earlier parser failure', async () => {
  const primary = Object.freeze(Error('Synthetic original body failure')); let cancelled = 0, released = 0
  const reader = createPublicPageReader({ resolveHost: async () => [{ address: '8.8.8.8', family: 4 }], testOnlyInjectedTransport: true,
    fetchImpl: async () => ({ status: 200, headers: new Headers(), body: { getReader: () => ({ read: async () => { throw primary },
      cancel: () => { cancelled++; throw Error('Synthetic cancel failure') }, releaseLock: () => { released++; throw Error('Synthetic release failure') } }) } }) })
  exact(await reflect(reader.read(url())), primary); assert.equal(cancelled, 1); assert.equal(released, 1)
})

function physical(t, { proxy = false, syncDestroy = true } = {}) {
  const request = new EventEmitter(), socket = new EventEmitter(), incoming = Readable.from([Buffer.from('Synthetic original body')])
  Object.assign(socket, { remoteAddress: '8.8.8.8', connecting: false, encrypted: true, authorized: true })
  Object.assign(incoming, { socket, statusCode: 200, headers: { 'content-type': 'text/plain' }, httpVersion: '1.1' })
  incoming.on('error', () => {}) // A test observer captures mock teardown events; no socket exists.
  let requestDestroy = 0, agentDestroy = 0, responseCallback, settings, ends = 0
  const replacement = Object.assign(Error('Synthetic raw request error'), { code: 'ECONNRESET' })
  request.destroy = () => { requestDestroy++; if (syncDestroy) request.emit('error', replacement); return request }
  request.end = () => { ends++ }
  globalThis.__sharedNativeProxy = () => proxy ? { address: '8.8.8.8', agent: { destroy: () => { agentDestroy++ } } } : null
  t.after(() => { globalThis.__sharedNativeProxy = () => null })
  t.mock.method(https, 'request', (options, respond) => { settings = options; responseCallback = respond; return request })
  return { request, socket, incoming, replacement, connect: () => request.emit('socket', socket), respond: () => responseCallback(incoming),
    get settings() { return settings }, get requestDestroy() { return requestDestroy }, get agentDestroy() { return agentDestroy }, get ends() { return ends } }
}
for (const proxy of [false, true]) for (const [kind, reason] of reasons) {
  test(`mock pinned HTTPS ${proxy ? 'proxy' : 'direct'} cancellation ${kind} owns synchronous teardown errors`, async t => {
    const io = physical(t, { proxy }), controller = new AbortController()
    const pending = reflect(pinnedHTTPSFetch(url(), { validatedAddresses: [{ address: '8.8.8.8', family: 4 }], signal: controller.signal, headers: {} }))
    controller.abort(reason); io.request.emit('error', io.replacement)
    exact(await bounded(pending), reason); assert.equal(io.requestDestroy, 1); assert.equal(io.agentDestroy, proxy ? 1 : 0)
  })
}
for (const callback of ['onConnected', 'onResponseHeaders']) for (const proxy of [false, true]) {
  test(`mock pinned ${proxy ? 'proxy' : 'direct'} ${callback} throw stays owned before request error teardown`, async t => {
    const io = physical(t, { proxy }), original = Object.freeze(Error('Synthetic callback failure'))
    const pending = reflect(pinnedHTTPSFetch(url(), { validatedAddresses: [{ address: '8.8.8.8', family: 4 }], headers: {}, [callback]: () => { throw original } }))
    let escaped
    try { io.connect(); io.respond() } catch (error) { escaped = error; io.request.emit('error', io.replacement) }
    const result = await bounded(pending)
    if (result.pending) io.request.emit('error', io.replacement)
    assert.equal(escaped, undefined); exact(result, original); assert.equal(io.requestDestroy, 1); assert.equal(io.agentDestroy, proxy ? 1 : 0)
  })
  for (const [kind, reason] of reasons) test(`mock pinned ${proxy ? 'proxy' : 'direct'} ${callback} abort ${kind} beats callback rejection`, async t => {
    const io = physical(t, { proxy }), controller = new AbortController()
    const pending = reflect(pinnedHTTPSFetch(url(), { validatedAddresses: [{ address: '8.8.8.8', family: 4 }], signal: controller.signal,
      headers: {}, [callback]: async () => { controller.abort(reason); throw Error('Synthetic asynchronous observer replacement') } }))
    io.connect(); io.respond(); exact(await bounded(pending), reason); await turn()
    assert.equal(io.requestDestroy, 1); assert.equal(io.agentDestroy, proxy ? 1 : 0)
  })
  test(`mock pinned ${proxy ? 'proxy' : 'direct'} ${callback} asynchronous noncancel failure keeps identity`, async t => {
    const io = physical(t, { proxy }), original = Object.freeze(Error('Synthetic asynchronous callback failure'))
    const pending = reflect(pinnedHTTPSFetch(url(), { validatedAddresses: [{ address: '8.8.8.8', family: 4 }], headers: {}, [callback]: async () => { throw original } }))
    io.connect(); io.respond(); exact(await bounded(pending), original); await turn()
    assert.equal(io.requestDestroy, 1); assert.equal(io.agentDestroy, proxy ? 1 : 0)
  })
}
for (const proxy of [false, true]) {
  test(`mock pinned ${proxy ? 'proxy' : 'direct'} response arriving after cancellation is destroyed before body work`, async t => {
    const io = physical(t, { proxy }), controller = new AbortController(); let bodyReads = 0, notifications = 0
    const originalRead = io.incoming._read
    t.mock.method(io.incoming, '_read', function (...args) { bodyReads++; return Reflect.apply(originalRead, this, args) })
    const pending = reflect(pinnedHTTPSFetch(url(), { validatedAddresses: [{ address: '8.8.8.8', family: 4 }], headers: {}, signal: controller.signal,
      onConnected: () => { notifications++ } }))
    controller.abort(false); io.request.emit('error', io.replacement); exact(await pending, false)
    io.respond(); await turn(); await turn()
    assert.equal(io.incoming.destroyed, true); assert.equal(bodyReads, 0); assert.equal(notifications, 0); assert.equal(io.requestDestroy, 1); assert.equal(io.agentDestroy, proxy ? 1 : 0)
  })
  test(`mock pinned ${proxy ? 'proxy' : 'direct'} normal raw error classification remains unchanged`, async t => {
    const io = physical(t, { proxy }), pending = reflect(pinnedHTTPSFetch(url(), { validatedAddresses: [{ address: '8.8.8.8', family: 4 }], headers: {} }))
    io.request.emit('error', io.replacement); const result = await pending
    assert.equal(result.ok, false)
    if (proxy) { assert.notEqual(result.reason, io.replacement); assert.equal(result.reason.code, 'ECONNRESET'); assert.equal(result.reason.message, 'Configured HTTPS proxy request failed (ECONNRESET)') }
    else assert.equal(result.reason, io.replacement)
  })
  test(`mock pinned ${proxy ? 'proxy' : 'direct'} transport preserves public TLS and origin request arguments`, async t => {
    const io = physical(t, { proxy }), target = url(), pending = pinnedHTTPSFetch(target, { validatedAddresses: [{ address: '8.8.8.8', family: 4 }], headers: { Accept: 'text/html' } })
    io.connect(); io.respond(); const response = await pending
    assert.equal(await response.text(), 'Synthetic original body')
    assert.equal(io.settings.method, 'GET'); assert.equal(io.settings.rejectUnauthorized, true); assert.equal(io.settings.servername, new URL(target).hostname)
    assert.equal(io.settings.checkServerIdentity('8.8.8.8', { subjectaltname: 'DNS:other.example' }).code, 'ERR_TLS_CERT_ALTNAME_INVALID')
    if (proxy) { assert.equal(io.settings.hostname, '8.8.8.8'); assert.equal(new Headers(io.settings.headers).get('host'), new URL(target).host) }
    else { assert.equal(io.settings.hostname, new URL(target).hostname); let pinned; io.settings.lookup(new URL(target).hostname, { all: true }, (error, values) => { assert.equal(error, null); pinned = values }); assert.deepEqual(pinned, [{ address: '8.8.8.8', family: 4 }]) }
  })
}
