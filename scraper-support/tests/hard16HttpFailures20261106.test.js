import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { classifyScraperError } from '../utils/failureClassification.js'
import { withRetry } from '../utils/retry.js'
import { run as purplle, FIRST_PARTY_ROOT_URL } from '../../scraper/purplle/script.js'
import { POST_URL as PURPLLE_POST_URL } from '../../scraper/purplle/turboHire.js'
import { run as renewbuy, PROFILE_URL, JOBS_URL as RENEWBUY_JOBS_URL } from '../../scraper/renewbuy/script.js'
import { run as waymo, buildIndiaSearchUrl } from '../../scraper/waymo/script.js'

for (const [name, run, url, status] of [
  ['Purplle', purplle, FIRST_PARTY_ROOT_URL, 247],
  ['Waymo', waymo, buildIndiaSearchUrl(), 202],
]) test(`${name} unexpected HTTP ${status} stays an unavailable inventory with an upstream failure`, async t => {
  let calls = 0, cancelled = false
  const fetchImpl = async requested => {
    calls++
    assert.equal(requested, name === 'Purplle' && calls % 2 === 0 ? PURPLLE_POST_URL : url)
    return { status, url: requested, headers: new Headers(), body: { cancel() { cancelled = true } },
      text() { assert.fail('Non-job response must remain unread') } }
  }
  if (name === 'Waymo') t.mock.method(globalThis, 'fetch', fetchImpl)
  await assert.rejects(run({ fetchImpl }), error => {
    assert.equal(error.status, status)
    assert.equal(error.requestUrl, url)
    assert.equal(error.finalUrl, url)
    assert.equal(error.abortRetries, true)
    assert.equal(error.inventoryEvidence?.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence?.listingComplete, false)
    assert.equal(error.inventoryEvidence?.reportedTotal, null)
    const classified = classifyScraperError(error)
    assert.equal(classified.softFailure, true)
    assert.equal(classified.failureKind, 'upstream_unavailable')
    return true
  })
  assert.equal(calls, name === 'Purplle' ? 2 : 1)
  assert.equal(cancelled, true)
  await assert.rejects(withRetry(() => run({ fetchImpl }), { attempts: 3, baseDelayMs: 0, label: name + '-unavailable' }), error => {
    assert.equal(error.cause.status, status)
    assert.equal(error.abortRetries, true)
    assert.equal(classifyScraperError(error).softFailure, true)
    assert.equal(classifyScraperError(error).failureKind, 'upstream_unavailable')
    assert.equal(error.cause.inventoryEvidence.listingComplete, false)
    return true
  })
  assert.equal(calls, name === 'Purplle' ? 4 : 2, 'Each invocation must stop after its unavailable reviewed public surfaces')
})

const official = JSON.parse(await readFile(new URL('../../scraper/renewbuy/fixtures/official-responses.json', import.meta.url), 'utf8'))
for (const status of [403, 503]) test(`RenewBuy keeps native HTTP ${status} and the failing surface after eligible profile recovery`, async () => {
  const calls = []
  const failingSurface = status === 403 ? RENEWBUY_JOBS_URL : PROFILE_URL
  await assert.rejects(renewbuy({ fetchImpl: async url => {
    calls.push(url)
    if (url === PROFILE_URL || url === RENEWBUY_JOBS_URL) return { status, url, body: { cancel() {} },
      text() { assert.fail('Unavailable profile body is not a company profile') } }
    const packet = official.find(row => row.url === url)
    assert.ok(packet)
    return { status: packet.status, url: packet.finalUrl, text: async () => packet.body }
  } }), error => {
    assert.equal(error.status, status)
    assert.equal(error.requestUrl, failingSurface)
    assert.equal(error.finalUrl, failingSurface)
    assert.match(error.message, new RegExp('HTTP ' + status))
    assert.equal(error.inventoryEvidence.surface, failingSurface)
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.lifecycleCleanupAllowed, false)
    assert.equal(classifyScraperError(error).softFailure, true)
    assert.equal(classifyScraperError(error).failureKind, status === 403 ? 'blocked_or_access_denied' : 'network_or_timeout')
    return true
  })
  assert.equal(calls.length, status === 403 ? 4 : 3)
})

test('HTTP 200 employer drift remains a rejected contract rather than an upstream interruption', async () => {
  await assert.rejects(purplle({ fetchImpl: async url => ({ status: 200, url,
    body: new Response('<h1>Unrelated employer</h1>').body }) }), error => {
    assert.equal(error.failureType, undefined)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.match(error.message, /employer handoff changed/)
    return true
  })
})
