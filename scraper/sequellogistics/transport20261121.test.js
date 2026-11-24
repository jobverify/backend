import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import https from 'node:https'
import test, { after, beforeEach } from 'node:test'

const savedFetch = globalThis.fetch, savedRequest = https.request
let handler, fallbackCalls
const calls = []
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), redirect: init.redirect, signal: init.signal })
  return handler(String(url), init)
}
https.request = () => { fallbackCalls++; throw new Error('Unexpected second HTTPS transport') }
after(() => { globalThis.fetch = savedFetch; https.request = savedRequest })
beforeEach(() => {
  calls.length = 0; fallbackCalls = 0
  handler = () => { throw new Error('Unexpected offline transport call') }
})
const sequel = await import('./script.js')
// Reuse the existing parser compatibility fixture; it is not vacancy proof.
const careers = readFileSync(new URL('./script.test.js', import.meta.url), 'utf8').match(/const careersHtml = `([\s\S]*?)`/)[1]
const HOME = 'https://www.sequelglobal.com/career.html'
const response = (body, status = 200) => new Response(body, {
  status, headers: { 'content-type': 'text/html; charset=utf-8' },
})

for (const status of [202, 401, 402, 403, 406, 407, 429, 451]) {
  test(`Sequel text transport rejects HTTP ${status} after one request`, async () => {
    handler = () => response('Transport status control', status)
    await assert.rejects(sequel.defaultFetchText(HOME), error => error.status === status || error.httpStatus === status)
    assert.equal(calls.length, 1)
    assert.equal(fallbackCalls, 0)
  })
  test(`Sequel default factory stops HTTP ${status} before the lateral page`, async () => {
    handler = url => {
      if (url === HOME) return response(careers, status)
      throw new Error('A restricted origin must not be requested again')
    }
    await assert.rejects(sequel.createSequelLogisticsScraper().run(), error => error.status === status || error.httpStatus === status)
    assert.deepEqual(calls.map(call => call.url), [HOME])
    assert.equal(fallbackCalls, 0)
  })
}

for (const frozen of [false, true]) {
  test(`Sequel preserves ${frozen ? 'frozen' : 'original'} TLS cause without a second transport`, async () => {
    const cause = Object.assign(new Error('unable to verify the first certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })
    const original = new TypeError('fetch failed', { cause })
    if (frozen) { Object.freeze(cause); Object.freeze(original) }
    handler = () => { throw original }
    await assert.rejects(sequel.defaultFetchText(HOME, {
      insecureFetchTextImpl: () => { fallbackCalls++; return 'Forbidden fallback result' },
    }), error => error === original && error.cause === cause)
    assert.equal(calls.length, 1)
    assert.equal(fallbackCalls, 0)
  })
}

test('Sequel text transport makes no request for a pre-aborted caller', async () => {
  const controller = new AbortController(), reason = new Error('Caller cancelled before request')
  controller.abort(reason)
  await assert.rejects(sequel.defaultFetchText(HOME, { signal: controller.signal }), error => error === reason)
  assert.equal(calls.length, 0)
})

test('Sequel default factory makes no request for a pre-aborted caller', async () => {
  const controller = new AbortController(), reason = new Error('Caller cancelled before source run')
  controller.abort(reason)
  await assert.rejects(sequel.createSequelLogisticsScraper().run({ signal: controller.signal }), error => error === reason)
  assert.equal(calls.length, 0)
})

test('Sequel rejects a completed response after caller cancellation', async () => {
  const controller = new AbortController(), reason = new Error('Caller cancelled during fetch')
  handler = () => { controller.abort(reason); return response('Completed transport response') }
  await assert.rejects(sequel.defaultFetchText(HOME, { signal: controller.signal }), error => error === reason)
  assert.equal(calls.length, 1)
})

test('Sequel rejects completed text after caller cancellation during body read', async () => {
  const controller = new AbortController(), reason = new Error('Caller cancelled during body read')
  handler = () => {
    const result = response('Body control')
    result.text = async () => { controller.abort(reason); return 'Completed transport response' }
    return result
  }
  await assert.rejects(sequel.defaultFetchText(HOME, { signal: controller.signal }), error => error === reason)
  assert.equal(calls.length, 1)
})

test('Sequel factory cannot advance after a completed-but-cancelled careers read', async () => {
  const controller = new AbortController(), reason = new Error('Caller cancelled before lateral read')
  handler = url => {
    if (url === HOME) { controller.abort(reason); return response(careers) }
    throw new Error('A cancelled source must not advance')
  }
  await assert.rejects(sequel.createSequelLogisticsScraper().run({ signal: controller.signal }), error => error === reason)
  assert.deepEqual(calls.map(call => call.url), [HOME])
})

test('Sequel preserves original body read failure without another request', async () => {
  const original = new Error('Original response body failed')
  handler = () => { const result = response('Body control'); result.text = async () => { throw original }; return result }
  await assert.rejects(sequel.defaultFetchText(HOME), error => error === original)
  assert.equal(calls.length, 1)
  assert.equal(fallbackCalls, 0)
})

test('Sequel rejects Response.error instead of returning empty text', async () => {
  handler = () => Response.error()
  await assert.rejects(sequel.defaultFetchText(HOME))
  assert.equal(calls.length, 1)
})

test('Sequel rejects an absent completed Response', async () => {
  handler = () => undefined
  await assert.rejects(sequel.defaultFetchText(HOME))
  assert.equal(calls.length, 1)
})

test('Sequel rejects non-string completed text', async () => {
  handler = () => { const result = response('Body control'); result.text = async () => undefined; return result }
  await assert.rejects(sequel.defaultFetchText(HOME))
  assert.equal(calls.length, 1)
})

test('Sequel rejects empty completed text', async () => {
  handler = () => response('')
  await assert.rejects(sequel.defaultFetchText(HOME))
  assert.equal(calls.length, 1)
})

test('Sequel accepts successful nonempty text with redirects held for inspection', async () => {
  handler = () => response('Nonempty successful transport response')
  assert.equal(await sequel.defaultFetchText(HOME), 'Nonempty successful transport response')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].redirect, 'manual')
})

test('Sequel rejects a redirect rather than following another URL', async () => {
  handler = () => new Response('Redirect control', { status: 302, headers: { location: '/lateral-staff' } })
  await assert.rejects(sequel.defaultFetchText(HOME), error => error.status === 302)
  assert.equal(calls.length, 1)
})
