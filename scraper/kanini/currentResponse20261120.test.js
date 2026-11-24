import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { currentKaniniTransport } from './currentTransport20261117.js'
import { sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const listing = 'https://kanini.com/careers/open-positions/'
const current = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-corporate-20261120.json.gz', import.meta.url))))
// Current corporate responses replayed alongside earlier captured native data.
// This regression establishes response semantics; it does not assert live counts.
const native = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz', import.meta.url))))
const currentSearch = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-search-response-20261120.json.gz', import.meta.url))))
const text = packet => Buffer.from(packet.bodyBase64, 'base64').toString()

test('KANINI current own 302 document without a redirect target reaches native acquisition and retains the cleanup hold', async () => {
  const statuses = []
  const jobs = await run({ requestIntervalMs: 0, fetchImpl: async (url, init) => {
    const packet = current.responses.find(row => row.url === url)
      ?? native.responses.find(row => row.url === url && (row.method ?? 'GET') === init.method && (row.requestBody ?? '') === (init.body ?? ''))
    assert.ok(packet, 'Only a captured declared public read ' + url)
    if (url === listing) { statuses.push(packet.status); assert.equal(packet.headers.location, undefined) }
    return Object.defineProperty(new Response(text(packet), { status: packet.status, headers: packet.headers }), 'url', { value: packet.url })
  } })
  assert.deepEqual(statuses, [302, 302])
  assert.equal(jobs.length, 11)
  assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(jobs.nativeCollectionEvidence.retainedResponses.filter(row => row.url === listing).every(row => row.status === 302), true)
})

for (const [label, url, headers, responseURL] of [
  ['a declared foreign redirect', listing, { location: 'https://foreign.example/jobs' }, listing],
  ['an unexpected own redirect', listing, { location: '/different-jobs/' }, listing],
  ['another endpoint returning 302', 'https://kanini.com/careers/', {}, 'https://kanini.com/careers/'],
  ['foreign response identity', listing, {}, 'https://foreign.example/jobs'],
]) test('KANINI does not admit ' + label + ' as the current listing entity', async () => {
  const packet = current.responses.find(row => row.url === listing)
  const io = currentKaniniTransport({ requestIntervalMs: 0, allowedRequest: () => true,
    fetchImpl: async () => Object.defineProperty(new Response(text(packet), { status: 302, headers: { ...packet.headers, ...headers } }), 'url', { value: responseURL }) })
  try { await assert.rejects(io.read(url)) } finally { io.close() }
})

test('KANINI actual current native query redirect remains an inventory hold', async () => {
  assert.equal(currentSearch.status, 302)
  assert.equal(currentSearch.headers.location, listing)
  assert.equal(Buffer.from(currentSearch.bodyBase64, 'base64').length, 0)
  const io = currentKaniniTransport({ requestIntervalMs: 0, allowedRequest: () => true,
    fetchImpl: async () => Object.defineProperty(new Response(text(currentSearch), { status: currentSearch.status, headers: currentSearch.headers }), 'url', { value: currentSearch.finalUrl }) })
  try {
    await assert.rejects(io.read(currentSearch.url, 'html', currentSearch.requestBody), error =>
      error.httpStatus === 302 && error.sourceScopeComplete === false && error.lifecycleCleanupAllowed === false)
  } finally { io.close() }
})
