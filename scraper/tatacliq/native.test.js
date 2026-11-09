import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { createTataCliqScraper } from './script.js'

const careers = 'https://www.tatacliq.com/careers'
const response = (body, { status = 200, url = careers } = {}) => ({ status, url, text: async () => body })
const gap = error => {
  assert.equal(error.code, 'TATACLIQ_COVERAGE_GAP')
  assert.equal(error.sourceListingComplete, false)
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.firstParty, false)
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  return true
}

test('TataCliq unavailable careers never certifies empty inventory', async () => {
  await assert.rejects(createTataCliqScraper().run({ fetchImpl: async () => response('Bad Gateway', { status: 502 }) }), gap)
})

test('unknown careers markup, generic no-jobs text and Tata Digital redirects remain coverage gaps', async () => {
  for (const fixture of [response('<h1>TataCliq Careers</h1>'), response('<h1>No jobs available</h1>'), response('<h1>Tata Digital Careers</h1>', { url: 'https://www.tatadigital.com/careers' })]) {
    await assert.rejects(createTataCliqScraper().run({ fetchImpl: async () => fixture }), gap)
  }
})

test('one aggregate deadline aborts a noncooperative fetch and body', async () => {
  for (const bodyHangs of [false, true]) {
    let signal
    const start = Date.now()
    await assert.rejects(createTataCliqScraper().run({ timeoutMs: 25, fetchImpl: async (url, options) => {
      assert.equal(url, careers)
      signal = options.signal
      return bodyHangs ? { status: 200, url: careers, text: () => new Promise(() => {}) } : new Promise(() => {})
    } }), error => gap(error) && /timeout/i.test(error.message))
    assert.equal(signal.aborted, true)
    assert.ok(Date.now() - start < 1000)
  }
})

test('caller cancellation rejects promptly without starting an already cancelled request', async () => {
  const controller = new AbortController()
  const reason = new Error('caller cancellation')
  controller.abort(reason)
  let calls = 0
  await assert.rejects(createTataCliqScraper().run({ signal: controller.signal, fetchImpl: async () => { calls++; return response('') } }), error => error === reason)
  assert.equal(calls, 0)
})

test('caller cancellation aborts an in-flight noncooperative transport', async () => {
  const controller = new AbortController()
  let requestSignal
  const pending = createTataCliqScraper().run({ signal: controller.signal, fetchImpl: async (_, options) => {
    requestSignal = options.signal
    return new Promise(() => {})
  } })
  const reason = new Error('in-flight caller cancellation')
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
  assert.equal(requestSignal.aborted, true)
})

test('oversized timeout rejects before a request or timer overflow', async () => {
  let calls = 0
  await assert.rejects(createTataCliqScraper().run({ timeoutMs: 2 ** 32, fetchImpl: async () => { calls++; return response('') } }), gap)
  assert.equal(calls, 0)
})

test('TLS transport failure preserves the cause without producing inventory', async () => {
  const failure = Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' })
  await assert.rejects(createTataCliqScraper().run({ fetchImpl: async () => { throw failure } }), error => {
    gap(error)
    assert.equal(error.cause, failure)
    assert.equal(error.inventoryEvidence.pagesFetched, 0)
    return true
  })
})

test('import with --dry-run does not invoke network or persistence', () => {
  const url = new URL('./script.js', import.meta.url).href
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import fs from 'node:fs'; fs.writeFileSync=()=>{throw Error('unexpected persistence')}; process.argv.push('--dry-run'); globalThis.fetch=()=>{throw Error('unexpected network')}; await import(${JSON.stringify(url)}); console.log('safe import')`], { encoding: 'utf8', timeout: 3000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout.trim(), 'safe import')
})

