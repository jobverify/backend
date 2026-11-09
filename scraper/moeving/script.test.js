import assert from 'node:assert/strict'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

test('MoEVing captured inactive Freshteam tenant is an explicit coverage gap with unknown counts', async () => {
  const capture = JSON.parse(readFileSync(new URL('./fixtures/board-response.json', import.meta.url)))
  await assert.rejects(run({ fetchText: async url => {
    assert.equal(url, capture.url)
    return capture.body
  }, now: () => '2026-10-23T04:22:07.272Z' }), error => {
    assert.match(error.message, /inactive Freshteam tenant/)
    assert.equal(error.code, 'MOEVING_COVERAGE_GAP')
    assert.equal(error.abortRetries, true)
    assert.equal(error.sourceListingComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.deepEqual(classifyScraperError(error), {
      softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap',
    })
    assert.deepEqual(error.inventoryEvidence, {
      status: 'coverage-gap', surface: 'https://moeving.freshteam.com/jobs', firstParty: false,
      listingComplete: false, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: '2026-10-23T04:22:07.272Z', reason: 'inactive-freshteam-tenant',
    })
    return true
  })
})

test('MoEVing unknown shells and inaccessible inventories remain typed gaps with unknown vacancy counts', async () => {
  for (const fetchText of [async () => '<html>New recruiting widget</html>',
    async () => { throw new Error('transport unavailable') }]) {
    await assert.rejects(run({ fetchText }), error => {
      assert.equal(error.code, 'MOEVING_COVERAGE_GAP')
      assert.equal(error.abortRetries, true)
      assert.deepEqual(classifyScraperError(error), {
        softFailure: true, upstreamOutage: false, failureKind: 'coverage_gap',
      })
      assert.equal(error.inventoryEvidence.status, 'coverage-gap')
      assert.equal(error.inventoryEvidence.listingComplete, false)
      assert.equal(error.inventoryEvidence.reportedTotal, null)
      assert.equal(error.inventoryEvidence.indiaFacetCount, null)
      assert.equal(error.lifecycleCleanupAllowed, false)
      return true
    })
  }
})

test('MoEVing captured branded Join Us rental shell cannot certify an empty job inventory', async () => {
  const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/official-response.json.gz', import.meta.url))))
  await assert.rejects(run({ fetchText: async () => capture.body }), /inventory unverified/)
})

test('MoEVing rejects unavailable or unrecognised native inventory instead of certifying zero', async () => {
  for (const body of ['', '<html><title>Careers</title></html>', '<html>Moove careers</html>']) {
    await assert.rejects(run({ fetchText: async () => body }), /unverified|unavailable|inventory|identity/i)
  }
  await assert.rejects(run({ fetchText: async () => { throw new Error('upstream unavailable') } }), /upstream unavailable/)
})

test('MoEVing aggregate deadline bounds dependencies that ignore cancellation', async () => {
  await assert.rejects(run({ fetchText: () => new Promise(() => {}), timeoutMs: 20 }), /timeout|deadline/i)
})

test('MoEVing caller cancellation propagates even when dependency ignores its signal', async () => {
  const controller = new AbortController()
  const reason = new Error('caller cancelled MoEVing')
  const pending = run({ fetchText: () => new Promise(() => {}), signal: controller.signal, timeoutMs: 500 })
  controller.abort(reason)
  await assert.rejects(pending, error => error === reason)
})

test('MoEVing import with dry-run does not fetch or persist', () => {
  const before = statSync(new URL('./jobs.json', import.meta.url)).mtimeMs
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    globalThis.fetch = () => { throw new Error('import fetched') }
    process.argv.push('--dry-run')
    await import('./scraper/moeving/script.js')
  `], { cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 3000 })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(statSync(new URL('./jobs.json', import.meta.url)).mtimeMs, before)
})

test('MoEVing default transport rejects HTTP failures and employer identity redirects', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }))
  await assert.rejects(run(), /HTTP 503/)
  globalThis.fetch = async () => ({ ok: true, status: 200, url: 'https://moove.freshteam.com/jobs', text: async () => 'Careers' })
  await assert.rejects(run(), /identity/)
})

test('MoEVing aggregate deadline also covers an ignored response body signal', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true, status: 200, url: 'https://moeving.freshteam.com/jobs', text: () => new Promise(() => {}),
  }))
  await assert.rejects(run({ timeoutMs: 20 }), /deadline/)
})
