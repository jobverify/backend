import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run as aarogyaai} from '../../scraper/aarogyaai/script.js'
import * as aktek from '../../scraper/aktek/script.js'
import {readInventoryEvidence, isFreshCompleteInventoryEvidence} from '../utils/inventoryEvidence.js'

// All adversarial pages below are synthetic. Only this four-response fixture
// contains captured public document bytes, and its replay never renews them.
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/unavailableSentinel20261106/capture.json.gz', import.meta.url))))
const unknown = error => {
  assert.equal(error.softFailure, true)
  assert.equal(error.abortRetries, true)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  assert.equal(isFreshCompleteInventoryEvidence(error.inventoryEvidence), false)
  return true
}
const within = async promise => {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Test watchdog: source request/body deadline was not enforced')), 400) })]) }
  finally { clearTimeout(timer) }
}

test('AarogyaAI transport timeouts cannot become a successful empty inventory', async () => {
  const calls = []
  await assert.rejects(aarogyaai({probeUrl: async url => { calls.push(url); return {url, finalUrl:url, status:null, html:null, errorKind:'timeout'} }}), error => {
    unknown(error)
    assert.equal(error.failureKind, 'network_or_timeout')
    assert.equal(error.inventoryEvidence.verifiedAt, null)
    return true
  })
  assert.deepEqual(calls, ['https://aarogyaai.com/'], 'Stop after the unavailable configured root; guessed routes do not prove a vacancy count')
})

for (const [source, run, option, url] of [
  ['AarogyaAI', aarogyaai, 'probeUrl', 'https://aarogyaai.com/'],
  ['Aktek', aktek.run, 'fetchPage', 'https://aktek.io/'],
]) {
  for (const status of [403, 429, 503]) test(`${source} preserves original HTTP ${status} without a false surface-change diagnosis`, async () => {
    let calls = 0
    await assert.rejects(run({[option]: async requested => { calls++; assert.equal(requested, url); return {url, finalUrl:url, status, html:'Synthetic unavailable response', headers:{'retry-after':'7'}} }}), error => {
      unknown(error)
      assert.equal(error.status, status)
      assert.equal(error.requestUrl, url)
      assert.equal(error.failureKind, status === 503 ? 'network_or_timeout' : 'blocked_or_access_denied')
      if (status === 429) assert.equal(error.retryDelayMs, 7000)
      return true
    })
    assert.equal(calls, 1)
  })
  test(`${source} honors cancellation before any public request`, async () => {
    const controller = new AbortController(), reason = Object.freeze({reason:'synthetic caller cancellation'})
    controller.abort(reason)
    let calls = 0
    await assert.rejects(run({signal:controller.signal, [option]:async () => { calls++; throw Error('Read after cancellation') }}), error => error === reason)
    assert.equal(calls, 0)
  })
  test(`${source} bounds an injected public request that ignores its abort signal`, async () => {
    await assert.rejects(within(run({requestTimeoutMs:20, [option]:async () => new Promise(() => {})})), error => {
      unknown(error)
      assert.equal(error.failureKind, 'network_or_timeout')
      assert.match(error.message, /deadline|timeout/i)
      return true
    })
  })
  test(`${source} keeps its deadline active while the native response body is stalled`, async t => {
    let init, cancelled = false
    t.mock.method(globalThis, 'fetch', async (requested, options) => {
      assert.equal(requested, url)
      init = options
      return {url, status:200, headers:new Headers({'content-type':'text/html'}),
        body:new ReadableStream({pull() { return new Promise(() => {}) }, cancel() { cancelled = true }}),
        text:async () => new Promise(() => {})}
    })
    await assert.rejects(within(run({requestTimeoutMs:20})), error => { unknown(error); assert.equal(error.failureKind, 'network_or_timeout'); return true })
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    assert.equal(init.signal.aborted, true)
    assert.equal(cancelled, true)
  })
  test(`${source} rejects oversized native response bodies before accepting a document`, async t => {
    let cancelled = false
    t.mock.method(globalThis, 'fetch', async () => ({url, status:200, headers:new Headers({'content-type':'text/html'}),
      body:new ReadableStream({start(controller) { controller.enqueue(new Uint8Array(2*1024*1024+1)) }, cancel() { cancelled = true }}),
      text:async () => 'Synthetic text() must not hide the actual oversized stream'}))
    await assert.rejects(within(run({requestTimeoutMs:150})), error => { unknown(error); assert.equal(error.failureKind, 'source_inventory_unavailable'); assert.match(error.message, /byte|size|limit/i); return true })
    assert.equal(cancelled, true)
  })
  test(`${source} rejects a substituted final response URL`, async () => {
    await assert.rejects(run({[option]:async () => ({url:'https://unrelated.invalid/', finalUrl:'https://unrelated.invalid/', status:200, html:'Synthetic unrelated document'})}), error => {
      unknown(error)
      assert.equal(error.failureKind, 'surface_drift_or_fail_closed')
      assert.equal(error.finalUrl, 'https://unrelated.invalid/')
      return true
    })
  })
}

test('AarogyaAI reachable HTML remains an unavailable inventory until a real hiring contract is qualified', async () => {
  await assert.rejects(aarogyaai({probeUrl:async url => ({url, finalUrl:url, status:200, html:'<title>AarogyaAI</title><h1>Synthetic corporate homepage</h1>'})}), error => {
    unknown(error)
    assert.equal(error.failureKind, 'source_inventory_unavailable')
    assert.equal(error.upstreamOutage, false)
    return true
  })
})

test('Aktek accepts its genuine current two-section sitemap without inventing a category sitemap', () => {
  const page = fixture.responses.find(row => row.url === 'https://aktek.io/sitemap_index.xml')
  assert.ok(page)
  assert.equal(aktek.hasExpectedSitemapIndexSignal(page.html), true)
  assert.equal(aktek.hasExpectedSitemapIndexSignal(page.html.replace('</sitemapindex>', '<sitemap><loc>https://unrelated.invalid/jobs.xml</loc></sitemap></sitemapindex>')), false)
})

test('Aktek missing-route checks bind the response to the exact requested route', () => {
  const page = {status:404, url:'https://unrelated.invalid/careers', html:'<title>Page not found - AKTEK</title>'}
  assert.equal(aktek.isMissingCareerRoute(page, 'https://aktek.io/careers'), false)
  assert.equal(aktek.isMissingCareerRoute({...page, url:'https://aktek.io/careers'}, 'https://aktek.io/jobs'), false)
})

test('Aktek genuine corporate crawl documents produce an explicit coverage gap with unknown vacancy totals', async () => {
  const calls = []
  const jobs = await aktek.run({fetchPage:async url => {
    calls.push(url)
    const response = fixture.responses.find(row => row.url === url)
    assert.ok(response, 'Read only a genuine captured declared document; no synthetic missing-careers responses')
    return response
  }})
  assert.deepEqual(calls, ['https://aktek.io/', 'https://aktek.io/robots.txt', 'https://aktek.io/sitemap_index.xml', 'https://aktek.io/page-sitemap.xml'])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, null)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
})
