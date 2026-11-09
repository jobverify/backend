import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { run } from './script.js'

const capture = JSON.parse(readFileSync(new URL('./fixtures/official-careers.json', import.meta.url)))
const response = (body = capture.body, status = 200, finalUrl = capture.finalUrl) => async url => {
  assert.equal(url, 'https://incred.com/Career-Page/')
  const r=new Response(body,{status});Object.defineProperty(r,'url',{value:finalUrl});return r
}
const unknown = error => {
  assert.equal(error.code, 'INCRED_COVERAGE_GAP')
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  assert.equal(error.inventoryEvidence.listingComplete, false)
  return true
}

test('InCred native SSR loading sentinel does not certify recruiting inventory empty', async () => {
  await assert.rejects(run({ fetchImpl: response() }), error => {
    unknown(error)
    assert.equal(error.inventoryEvidence.pagesFetched, 1)
    assert.equal(error.lifecycleCleanupAllowed,false)
    return true
  })
})
test('InCred HTTP failure and redirect cannot become zero', async () => {
  for (const fetchImpl of [response('', 503), response(capture.body, 200, 'https://other.example/')]) {
    await assert.rejects(run({ fetchImpl }), unknown)
  }
})
test('InCred unavailable native response is a typed unknown inventory', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw Error('offline') } }), unknown)
})
test('InCred unknown identity and truncated bodies cannot certify inventory', async () => {
  for (const body of ['<html><head><title>Maintenance</title></head><body>InCred No Current Opening</body></html>', capture.body.slice(0, -30)]) {
    await assert.rejects(run({ fetchImpl: response(body) }), error => {
      unknown(error)
      assert.match(error.cause.message,/identity|unclosed|truncated|slice|envelope/i)
      return true
    })
  }
})
test('InCred hidden recruiting markup cannot supply current contact channels', async () => {
  const body = capture.body.replace('<section class="page5">', '<section class="page5" style="content-visibility:hidden">')
  await assert.rejects(run({ fetchImpl: response(body) }), error => {
    unknown(error)
    assert.match(error.cause.message,/handoff|careers section/i)
    return true
  })
})
test('InCred pre-abort preserves the exact caller reason before fetch', async () => {
  const controller = new AbortController(), reason = Error('stop before fetch')
  controller.abort(reason)
  await assert.rejects(run({ signal: controller.signal, fetchImpl: () => assert.fail('unexpected fetch') }), error => error === reason)
})
test('InCred caller cancellation interrupts noncooperative fetch and body readers', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async url => {const r=new Response(new ReadableStream({pull(){return new Promise(()=>{})}}),{status:200});Object.defineProperty(r,'url',{value:url});return r}]) {
    const controller = new AbortController(), reason = Error('stop now')
    const pending = run({ signal: controller.signal, fetchImpl })
    controller.abort(reason)
    await assert.rejects(pending, error => error === reason)
  }
})
test('InCred preserves caller reason after native body reading has begun', async () => {
  let entered
  const reading = new Promise(resolve => { entered = resolve })
  const controller = new AbortController(), reason = Error('stop reading body')
  const pending=run({signal:controller.signal,fetchImpl:async url=>{const r=new Response(new ReadableStream({pull(){entered();return new Promise(()=>{})}}),{status:200});Object.defineProperty(r,'url',{value:url});return r}})
  await reading
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
})
test('InCred body-reader errors remain unknown inventory', async () => {
  await assert.rejects(run({ fetchImpl: async url => {const r=new Response(new ReadableStream({start(c){c.error(Error('body failed'))}}),{status:200});Object.defineProperty(r,'url',{value:url});return r} }), unknown)
})
test('InCred aggregate deadline bounds both noncooperative fetch and body readers', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async url => {const r=new Response(new ReadableStream({pull(){return new Promise(()=>{})}}),{status:200});Object.defineProperty(r,'url',{value:url});return r}]) {
    await assert.rejects(run({ fetchImpl, timeoutMs: 15 }), /deadline/)
  }
})
