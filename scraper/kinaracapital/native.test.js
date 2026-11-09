import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { createKinaraCapitalScraper } from './script.js'

const careers = 'https://kinaracapital.com/careers/'
const response = (body, { status = 200, url = careers } = {}) => ({ status, url, text: async () => body })
const gap = error => {
  assert.equal(error.code, 'KINARACAPITAL_COVERAGE_GAP')
  assert.equal(error.sourceListingComplete, false)
  assert.equal(error.sourceScopeComplete, false)
  assert.equal(error.lifecycleCleanupAllowed, false)
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.firstParty, false)
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.inventoryEvidence.indiaFacetCount, null)
  return true
}

test('Kinara Capital unavailable careers never certifies empty inventory', async () => {
  await assert.rejects(createKinaraCapitalScraper().run({ fetchImpl: async () => response('Bad Gateway', { status: 502 }) }), gap)
})

test('unknown careers markup, generic no-jobs text and unverified redirects remain coverage gaps', async () => {
  for (const fixture of [response('<h1>Kinara Capital Careers</h1>'), response('<h1>No jobs available</h1>'), response('<h1>Careers</h1>', { url: 'https://unverified.example/jobs/' })]) {
    await assert.rejects(createKinaraCapitalScraper().run({ fetchImpl: async () => fixture }), gap)
  }
})

test('captured official APPLY NOW handoff is checked but unavailable native inventory remains unknown', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/official-careers.json', import.meta.url)))
  const urls = []
  const transportFailure = Error('Failed to fetch native board')
  await assert.rejects(createKinaraCapitalScraper().run({ fetchImpl: async url => {
    urls.push(url)
    if (url === careers) return response(captured.body)
    throw transportFailure
  } }), error => {
    gap(error)
    assert.equal(error.cause, transportFailure)
    assert.equal(error.inventoryEvidence.pagesFetched, 1)
    return true
  })
  assert.deepEqual(urls, [careers, 'https://careers.kinaracapital.com/'])
})

test('native fetch and body share the aggregate deadline with the official page', async () => {
  const captured = JSON.parse(readFileSync(new URL('./fixtures/official-careers.json', import.meta.url)))
  for (const bodyHangs of [false, true]) {
    let nativeSignal
    await assert.rejects(createKinaraCapitalScraper().run({ timeoutMs: 25, fetchImpl: async (url, options) => {
      if (url === careers) return response(captured.body)
      nativeSignal = options.signal
      return bodyHangs ? { status: 200, url, text: () => new Promise(() => {}) } : new Promise(() => {})
    } }), error => gap(error) && /timeout/i.test(error.message))
    assert.equal(nativeSignal.aborted, true)
  }
})

test('fake APPLY NOW markup in a comment cannot authorize a native request', async () => {
  let calls = 0
  await assert.rejects(createKinaraCapitalScraper().run({ fetchImpl: async () => {
    calls++
    return response('<!-- <a href="https://careers.kinaracapital.com/">APPLY NOW</a> -->')
  } }), gap)
  assert.equal(calls, 1)
})

test('one aggregate deadline aborts a noncooperative fetch and body', async () => {
  for (const bodyHangs of [false, true]) {
    let signal
    const start = Date.now()
    await assert.rejects(createKinaraCapitalScraper().run({ timeoutMs: 25, fetchImpl: async (url, options) => {
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
  await assert.rejects(createKinaraCapitalScraper().run({ signal: controller.signal, fetchImpl: async () => { calls++; return response('') } }), error => error === reason)
  assert.equal(calls, 0)
})

test('caller cancellation aborts an in-flight noncooperative transport', async () => {
  const controller = new AbortController()
  let requestSignal
  const pending = createKinaraCapitalScraper().run({ signal: controller.signal, fetchImpl: async (_, options) => {
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
  await assert.rejects(createKinaraCapitalScraper().run({ timeoutMs: 2 ** 32, fetchImpl: async () => { calls++; return response('') } }), gap)
  assert.equal(calls, 0)
})

test('TLS transport failure preserves the cause without producing inventory', async () => {
  const failure = Object.assign(new Error('certificate has expired'), { code: 'CERT_HAS_EXPIRED' })
  await assert.rejects(createKinaraCapitalScraper().run({ fetchImpl: async () => { throw failure } }), error => {
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

test('raw browser captures and compressed copies retain their manifest checksums', () => {
  const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest.json', import.meta.url)))
  const sha = body => createHash('sha256').update(body).digest('hex')
  for (const entry of manifest.fixtures) {
    const raw = readFileSync(new URL(`./fixtures/${entry.file}`, import.meta.url))
    const compressed = readFileSync(new URL(`./fixtures/${entry.compressedFile}`, import.meta.url))
    assert.equal(sha(raw), entry.sha256)
    assert.equal(sha(compressed), entry.compressedSha256)
    assert.deepEqual(gunzipSync(compressed), raw)
    const parsed = JSON.parse(raw)
    const responses = Array.isArray(parsed) ? parsed : [parsed]
    assert.deepEqual(responses.map(r => typeof r.body === 'string' ? sha(r.body) : null), entry.responses.map(r => r.bodySha256))
  }
})
