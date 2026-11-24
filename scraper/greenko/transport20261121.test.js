import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import https from 'node:https'
import test, { after, beforeEach } from 'node:test'

// All network is replaced at the external boundary before the legacy factories
// capture fetch. No vacancy or current-source qualification is asserted here.
const savedFetch = globalThis.fetch
const savedRequest = https.request
const calls = []
let handler, fallbackCalls
const unexpectedFallback = new Error('Unexpected second HTTPS transport')
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method || 'GET', redirect: init.redirect })
  return handler(String(url), init)
}
https.request = () => { fallbackCalls++; throw unexpectedFallback }
after(() => { globalThis.fetch = savedFetch; https.request = savedRequest })
beforeEach(() => {
  calls.length = 0; fallbackCalls = 0
  handler = () => { throw new Error('Unexpected offline transport call') }
})
const greenko = await import('./script.js')
const compatibilityFile = new URL('../../scraper-support/tests/greenkoScript.test.js', import.meta.url)
const homepage = readFileSync(compatibilityFile, 'utf8').match(/const homepageHtml = `([\s\S]*?)`/)[1]
const HOME = 'https://www.greenkogroup.com/'
const SHELL = 'https://greenkogroup.darwinbox.in/ms/candidatev2/main/careers/allJobs'
const API = 'https://greenkogroup.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main'
const response = (body, status = 200, json = false) => new Response(body, {
  status, headers: { 'content-type': json ? 'application/json' : 'text/html; charset=utf-8' },
})
const run = options => greenko.createGreenkoScraper().run(options)

for (const stage of ['home', 'session', 'listing']) {
  for (const status of [202, 401, 402, 403, 406, 407, 429, 451]) {
    test(`Greenko ${stage}: HTTP ${status} stops before any further request`, async () => {
      handler = url => {
        if (url === HOME && stage !== 'home') return response(homepage)
        if (url === SHELL && stage === 'listing') return response('<html>Session transport control</html>')
        return response(stage === 'listing' ? '{"transportControl":true}' : homepage, status, stage === 'listing')
      }
      await assert.rejects(run(), error => error.status === status || error.httpStatus === status)
      assert.deepEqual(calls.map(call => call.url), stage === 'home' ? [HOME] : stage === 'session' ? [HOME, SHELL] : [HOME, SHELL, API])
      assert.equal(fallbackCalls, 0)
    })
  }
}

for (const stage of ['home', 'session', 'listing']) {
  test(`Greenko ${stage}: permanent certificate error keeps its exact cause without fallback`, async () => {
    const cause = Object.assign(new Error('unable to verify the first certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' })
    const original = new TypeError('fetch failed', { cause })
    handler = url => {
      if (url === HOME && stage !== 'home') return response(homepage)
      if (url === SHELL && stage === 'listing') return response('<html>Session transport control</html>')
      throw original
    }
    await assert.rejects(run(), error => error === original && error.cause === cause)
    assert.equal(calls.length, stage === 'home' ? 1 : stage === 'session' ? 2 : 3)
    assert.equal(fallbackCalls, 0)
  })
}

test('Greenko preserves a frozen original TLS error and cause', async () => {
  const cause = Object.freeze(Object.assign(new Error('unable to get local issuer certificate'), { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' }))
  const original = Object.freeze(new TypeError('fetch failed', { cause }))
  handler = () => { throw original }
  await assert.rejects(run(), error => error === original && error.cause === cause)
  assert.equal(calls.length, 1)
  assert.equal(fallbackCalls, 0)
})

test('Greenko performs no fetch when the caller is already aborted', async () => {
  const controller = new AbortController(), reason = new Error('Caller cancelled before request')
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal }), error => error === reason)
  assert.equal(calls.length, 0)
})

test('Greenko rejects a completed response if the caller aborted during fetch', async () => {
  const controller = new AbortController(), reason = new Error('Caller cancelled during request')
  handler = () => { controller.abort(reason); return response(homepage) }
  await assert.rejects(run({ signal: controller.signal }), error => error === reason)
  assert.equal(calls.length, 1)
})

test('Greenko body read failure cannot cause another homepage request', async () => {
  const original = new Error('Original response body failed')
  handler = () => { const result = response(homepage); result.text = async () => { throw original }; return result }
  await assert.rejects(run(), error => error === original)
  assert.equal(calls.length, 1)
  assert.equal(fallbackCalls, 0)
})

test('Greenko does not turn an empty completed response into successful inventory', async () => {
  handler = () => response('')
  await assert.rejects(run())
  assert.equal(calls.length, 1)
})

test('Greenko rejects a Response.error result after one request', async () => {
  handler = () => Response.error()
  await assert.rejects(run())
  assert.equal(calls.length, 1)
})

test('Greenko still applies its existing homepage guard to successful HTML', async () => {
  handler = () => response('<html><title>Different publisher</title></html>')
  await assert.rejects(run(), /verified Greenko homepage/i)
  assert.equal(calls.length, 1)
})
