import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { transport } from './native.fixture.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-handoff-20261120.json.gz', import.meta.url))))
const official = 'https://www.olyv.co.in/about-us'
const policy = 'https://cdn.olyv.co.in/images/app/consent/document/english/smartcoin-privacy-policy.html'
const replay = change => {
  const underlying = transport()
  return async (url, init) => {
    const packet = packets.find(row => row.requestedUrl === url)
    if (!packet) return underlying(url, init)
    return { status: packet.status, url: packet.url, text: async () => change?.(url, packet.body) ?? packet.body }
  }
}

test('SmartCoin current Olyv handoff binds its linked legal employer and retains native roles with scope holds', async () => {
  const jobs = await run({ fetchImpl: replay() })
  // Role responses are the unchanged November 6 native fixture. Only current
  // corporate ownership is under test; this does not claim 40 current roles.
  assert.equal(jobs.length, 40)
  assert.ok(jobs.every(job => job.company === 'SmartCoin' && job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('SmartCoin current handoff rejects a different linked legal employer', async () => {
  await assert.rejects(run({ fetchImpl: replay((url, body) => url === policy
    ? body.replaceAll('SmartCoin Financials Private Limited', 'Another Financial Company') : body) }), /employer|handoff/)
})

test('SmartCoin current corporate provenance needs the active exact portal and linked legal policy', async () => {
  await assert.rejects(run({ fetchImpl: replay((url, body) => url === official
    ? body.replaceAll('https://smartcoin.keka.com/careers', 'https://other.keka.com/careers') : body) }), /handoff/)
  await assert.rejects(run({ fetchImpl: replay((url, body) => url === official
    ? body.replaceAll(policy, 'https://foreign.example/privacy') : body) }), /employer|handoff/)
})
