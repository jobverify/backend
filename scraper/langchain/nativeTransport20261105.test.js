import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createLangchainNativeScraper } from './nativeInventory.js'
import { serializeNativePayload } from './nativeTransport.js'

// Finite authored transport controls. Genuine capture bytes remain immutable.
const run = options => createLangchainNativeScraper().run(options)
const fixture = new URL('./test-data/native-inventory-20261105/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture)))
const receipts = manifest.records.map(row => ({ ...row, url: row.finalUrl,
  body: gunzipSync(readFileSync(new URL(row.bodyFile, fixture))).toString('utf8') }))
const tick = () => new Promise(resolve => setImmediate(resolve))

test('a response arriving after caller abort is cancelled without waiting for its cleanup promise', async t => {
  const controller = new AbortController(), reason = Symbol('late response')
  let finishFetch, cancels = 0
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finishFetch = resolve }))
  const result = run({ signal: controller.signal })
  await tick(); controller.abort(reason)
  await assert.rejects(result, error => error === reason)
  finishFetch({ body: { cancel: () => { cancels++; return new Promise(() => {}) } } })
  await tick()
  assert.equal(cancels, 1)
})

test('a reader arriving after caller abort is cancelled and released once', async t => {
  const controller = new AbortController(), reason = Symbol('late reader')
  let finishReader, readerRequested, cancels = 0, releases = 0
  const requested = new Promise(resolve => { readerRequested = resolve })
  t.mock.method(globalThis, 'fetch', async url => ({ status: 200, url, headers: new Headers(), body: {
    cancel: async () => {}, getReader: () => { readerRequested(); return new Promise(resolve => { finishReader = resolve }) },
  } }))
  const result = run({ signal: controller.signal })
  await requested; controller.abort(reason)
  await assert.rejects(result, error => error === reason)
  finishReader({ cancel: () => { cancels++; return new Promise(() => {}) }, releaseLock: () => { releases++ } })
  await tick()
  assert.equal(cancels, 1); assert.equal(releases, 1)
})

test('actual chunk bounds cannot be hidden by a byteLength property before a copy', async t => {
  const bytes = new Uint8Array(8000001)
  Object.defineProperty(bytes, 'byteLength', { value: 1 })
  let reads = 0, cancels = 0, releases = 0
  t.mock.method(globalThis, 'fetch', async url => ({ status: 200, url, headers: new Headers(), body: {
    getReader: () => ({ read: async () => ++reads === 1 ? { done: false, value: bytes } : { done: true },
      cancel: async () => { cancels++ }, releaseLock: () => { releases++ } }),
  } }))
  await assert.rejects(run(), /byte limit/i)
  assert.equal(cancels, 1); assert.equal(releases, 1)
})

test('a small caller-parsed row count cannot serialize an oversized role description first', async () => {
  const payload = JSON.parse(receipts[2].body)
  payload.jobs[0].descriptionHtml = 'x'.repeat(8000001)
  const stringify = JSON.stringify
  let serialized = 0
  JSON.stringify = function(value, ...args) { if (value === payload) serialized++; return stringify.call(this, value, ...args) }
  try {
    await assert.rejects(run({ fetchPage: async url => ({ ...receipts.find(row => row.requestedUrl === url) }),
      fetchJson: async () => payload }), /byte limit/i)
    assert.equal(serialized, 0)
  } finally { JSON.stringify = stringify }
})

test('caller-parsed opaque Proxies are rejected before payload, jobs-array or nested-row inspection', () => {
  for (const carrier of ['payload', 'jobs-array', 'nested-row']) {
    let traps = 0, hooks = 0
    const wrap = target => new Proxy(target, {
      ownKeys(value) { traps++; return Reflect.ownKeys(value) },
      getOwnPropertyDescriptor(value, key) { traps++; return Reflect.getOwnPropertyDescriptor(value, key) },
      getPrototypeOf(value) { traps++; return Reflect.getPrototypeOf(value) },
      has(value, key) { traps++; return key === 'toJSON' ? false : Reflect.has(value, key) },
      get(value, key, receiver) {
        traps++
        if (key === 'toJSON') return () => { hooks++; return { id: 'synthetic-hook-result' } }
        return Reflect.get(value, key, receiver)
      },
    })
    const payload = { apiVersion: '1', jobs: [{ id: 'synthetic-plain-row' }] }
    if (carrier === 'jobs-array') payload.jobs = wrap(payload.jobs)
    if (carrier === 'nested-row') payload.jobs[0] = wrap(payload.jobs[0])
    assert.throws(() => serializeNativePayload(carrier === 'payload' ? wrap(payload) : payload,
      { check() {}, byteLimit: 8000000, nativeRows: 2000 }), error => error.failureKind === 'coverage_gap')
    assert.equal(hooks, 0, carrier)
    assert.equal(traps, 0, carrier)
  }
})

for (const reason of [null, Symbol('opaque caller')]) test('opaque caller cancellation preserves ' + String(reason), async () => {
  const before = new AbortController(); before.abort(reason)
  await assert.rejects(run({ signal: before.signal }), error => error === reason)
  const during = new AbortController()
  await assert.rejects(run({ signal: during.signal, fetchDocument: async () => { during.abort(reason); return {} } }), error => error === reason)
})
