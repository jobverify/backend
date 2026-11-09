import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { verifyCarrierGroupDelegation, PRIVACY } from './nativeBinding.js'
import { run } from './script.js'
import { carrierSearchPacket } from '../../test/helpers/carrierNativeSearch.js'
import { readInventoryDelegationEvidence } from '../../scraper-support/utils/inventoryDelegationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const native = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-group-20261031.json.gz', import.meta.url))))
const groupTransport = mutate => async url => {
  const page = structuredClone(native.packets.find(row => row.url === url))
  assert.ok(page, 'Uncaptured current group request ' + url)
  page.url = page.finalUrl
  mutate?.(page)
  return page
}

test('Carrier Global actual group and privacy responses retain their oldest native clock and exact body hashes', async () => {
  const binding = await verifyCarrierGroupDelegation({ fetchPage: groupTransport() })
  assert.equal(binding.canonicalSource, 'carrier')
  assert.equal(binding.legalEmployerAlias, false)
  assert.equal(binding.companyScopeComplete, false)
  assert.equal(binding.observation?.verifiedAt, '2026-10-31T08:05:18.951Z')
  assert.equal(binding.observation.evidence.url, PRIVACY)
  assert.deepEqual(binding.observation.evidence.responses, [
    { url: 'https://www.corporate.carrier.com/', finalUrl: 'https://www.carrier.com/us/en/', status: 200,
      sha256: '4677bdc29fe93e0f875b8ca5149c85cb87bb1e032ccad3cac7b73efcd3922fd5' },
    { url: PRIVACY, finalUrl: PRIVACY, status: 200,
      sha256: '2239b8eae9f67b403267db490c066fe0e467d9b70a52508a55e416f01f19044c' },
  ])
})

for (const [name, mutate] of [
  ['untimed legacy page', page => { delete page.capturedAt }],
  ['future native clock', page => { page.capturedAt = '2999-01-01T00:00:00Z' }],
  ['invalid native clock', page => { page.capturedAt = 'unknown' }],
]) test('Carrier Global ' + name + ' cannot create a current observation', async () => {
  const binding = await verifyCarrierGroupDelegation({ fetchPage: groupTransport(mutate) })
  assert.equal(binding.observation, null)
  assert.equal(binding.companyScopeComplete, false)
})

for (const [name, mutate] of [
  ['unrelated collective employer', page => { page.body = page.body.replaceAll('Carrier Global Corporation', 'Unrelated Corporation') }],
  ['hidden group definition', page => { page.body = '<div hidden>' + page.body + '</div>' }],
  ['inert group definition', page => { page.body = '<div inert>' + page.body + '</div>' }],
  ['foreign final URL', page => { page.finalUrl = 'https://example.invalid/privacy-notice/' }],
  ['HTTP403', page => { page.status = 403 }],
]) test('Carrier Global rejects ' + name + ' before observing delegation', async () => {
  await assert.rejects(verifyCarrierGroupDelegation({ fetchPage: groupTransport(page => {
    if (page.url === PRIVACY) mutate(page)
  }) }), /Carrier Global current group delegation/)
})

test('Carrier Global cancellation during a native page retains the exact caller reason', async () => {
  const controller = new AbortController(), reason = Error('stop current group binding')
  await assert.rejects(verifyCarrierGroupDelegation({ signal: controller.signal,
    fetchPage: groupTransport(() => controller.abort(reason)) }), error => error === reason)
})

test('Carrier Global rejects and cancels an oversized native body before retaining delegation evidence', async t => {
  let cancelled = 0
  t.mock.method(globalThis, 'fetch', async () => {
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(2000001)) },
      cancel() { cancelled += 1 },
    }), { headers: { 'content-type': 'text/html' } })
    Object.defineProperty(response, 'url', { value: 'https://www.carrier.com/us/en/' })
    return response
  })
  await assert.rejects(verifyCarrierGroupDelegation(), /body bound/)
  assert.equal(cancelled, 1)
})

test('Carrier Global attaches only relationship proof while preserving the canonical historical child boundary', async t => {
  // Group pages are the current capture; the59-job canonical child inventory is
  // an explicitly historical offline boundary, not a fresh native child run.
  const f = JSON.parse(gunzipSync(readFileSync(new URL('../carrier.workday/fixtures/runtime-current59-20261021.json.gz', import.meta.url))))
  const packets = [...native.packets.map(page => ({ ...page, finalURL: page.finalUrl, method: 'GET', requestBody: null })),
    ...f.packets, carrierSearchPacket()], used = new Set()
  const read = (url, init = {}) => {
    const index = packets.findIndex((page, index) => !used.has(index) && page.url === String(url)
      && page.method === (init.method ?? 'GET') && page.requestBody === (init.body ?? null))
    assert.ok(index >= 0, 'Uncaptured offline Carrier boundary request ' + url)
    used.add(index)
    return structuredClone(packets[index])
  }
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const page = read(url, init), response = new Response(page.body, { status: page.status })
    Object.defineProperty(response, 'url', { value: page.finalURL })
    return response
  })
  const jobs = await run({ now: f.trial.completedAt, fetchPage: async (url, init) => {
    const page = read(url, init)
    return { ...page, url: page.finalURL, capturedAt: page.capturedAt ?? page.checkedAt }
  } })
  assert.equal(jobs.length, 59)
  assert.equal(used.size, 71)
  assert.ok(jobs.every(job => job.source === 'carrier' && job.company === 'Carrier' && job.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  const proof = readInventoryDelegationEvidence(jobs)
  assert.equal(proof?.source, 'carrierglobal')
  assert.deepEqual(proof.sources, ['carrier'])
  assert.equal(proof.verifiedAt, '2026-10-31T08:05:18.951Z')
  assert.equal(proof.evidence.url, PRIVACY)
})
