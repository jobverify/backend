import test from 'node:test'
import assert from 'node:assert/strict'
import { transport } from '../../scraper/anandengineeringproductspvtltd/currentTransport.js'

const HOME = 'https://anandengg.in/'
const BODY = Buffer.from('<html><body>Synthetic transport budget unit fixture</body></html>')

function fixture(t, options = {}) {
  const state = { clock: 0, requests: [] }
  t.mock.method(performance, 'now', () => state.clock)
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network in Anand budget test') })
  const io = transport({
    ...options,
    fetchResponse: async (url, init) => {
      state.requests.push({ url, init })
      return { status: 200, finalURL: HOME, headers: { 'content-type': 'text/html; charset=utf-8' },
        contentType: 'text/html; charset=utf-8', bytes: BODY }
    },
  })
  t.after(() => io.control.dispose())
  return { io, state }
}

test('Anand native source budget permits an explicitly longer collection and preserves the original read', async t => {
  const { io, state } = fixture(t, { sourceTimeoutMs: 1000000 })
  state.clock = 350000
  const result = await io.read(HOME)
  assert.deepEqual(result.bytes, BODY)
  assert.equal(result.text, '<html><body>Synthetic transport budget unit fixture</body></html>')
  assert.deepEqual(result.headers, { 'content-type': 'text/html; charset=utf-8' })
  assert.equal(state.requests.length, 1)
  assert.equal(state.requests[0].url, HOME)
  assert.equal(state.requests[0].init.method, 'GET')
  assert.equal(state.requests[0].init.credentials, 'omit')
  assert.equal(state.requests[0].init.redirect, 'manual')
  assert.deepEqual(state.requests[0].init.headers, { Accept: 'text/html' })
  assert.equal(state.requests[0].init.signal, io.control.signal)
  assert.equal(io.originals[0].originalBodyComplete, true)
  assert.equal(io.originals[0].requestedURL, HOME)
  assert.equal(io.originals[0].finalURL, HOME)
  assert.equal(io.originals[0].bodyBase64, BODY.toString('base64'))
})

test('Anand native source budget still expires the default collection before another read', async t => {
  const { io, state } = fixture(t)
  state.clock = 300001
  await assert.rejects(io.read(HOME), /source deadline exceeded/)
  assert.equal(state.requests.length, 0)
  assert.equal(io.originals.length, 0)
})

test('Anand native source budget accepts the explicit ceiling but stops at its deadline', async t => {
  const { io, state } = fixture(t, { sourceTimeoutMs: 4000000 })
  state.clock = 3999999
  assert.deepEqual((await io.read(HOME)).bytes, BODY)
  state.clock = 4000000
  await assert.rejects(io.read(HOME), /source deadline exceeded/)
  assert.equal(state.requests.length, 1)
})

for (const value of [4000001, 0, -1, 1.5, NaN, Infinity, '1000000']) {
  test('Anand native source budget rejects an invalid explicit limit: ' + String(value), t => {
    assert.throws(() => fixture(t, { sourceTimeoutMs: value }), RangeError)
  })
}

test('Anand native source budget honors the existing timeout alias above the default', async t => {
  const { io, state } = fixture(t, { sourceTimeoutMs: null, timeoutMs: 1000000 })
  state.clock = 350000
  assert.deepEqual((await io.read(HOME)).bytes, BODY)
})

test('Anand native source budget gives an explicit source limit precedence over the timeout alias', async t => {
  const { io, state } = fixture(t, { sourceTimeoutMs: 1000000, timeoutMs: 0 })
  state.clock = 350000
  assert.deepEqual((await io.read(HOME)).bytes, BODY)
})

for (const field of ['readTimeoutMs', 'observerTimeoutMs']) {
  test('Anand native source budget preserves the 15 second ' + field + ' ceiling', t => {
    assert.throws(() => fixture(t, { [field]: 15001, sourceTimeoutMs: 1000000 }), RangeError)
  })
}

test('Anand native source budget still enforces the per-read deadline inside a longer collection', async t => {
  let clock = 0, requests = 0
  t.mock.method(performance, 'now', () => clock)
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected network in Anand budget test') })
  const io = transport({ sourceTimeoutMs: 1000000, fetchResponse: async () => {
    requests++
    clock = 15000
    return { status: 200, finalURL: HOME, headers: { 'content-type': 'text/html' }, contentType: 'text/html', bytes: BODY }
  } })
  t.after(() => io.control.dispose())
  await assert.rejects(io.read(HOME), /read\/body deadline exceeded/)
  assert.equal(requests, 1)
})

for (const reason of [Object.freeze({ kind: 'opaque-caller-cancellation' }), 0, null]) {
  test('Anand native source budget preserves the exact caller abort reason: ' + String(reason), async t => {
    const controller = new AbortController()
    const { io, state } = fixture(t, { signal: controller.signal, sourceTimeoutMs: 1000000 })
    controller.abort(reason)
    await assert.rejects(io.read(HOME), error => error === reason)
    assert.equal(state.requests.length, 0)
    assert.equal(io.originals.length, 0)
  })
}
