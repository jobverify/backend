import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261120.json.gz', import.meta.url))))
const historical = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz', import.meta.url))))
const text = packet => Buffer.from(packet.bodyBase64, 'base64').toString('utf8')
function replay(edit = (packet, body) => body) {
  return { requestIntervalMs: 0, fetchImpl: async (url, init) => {
    const packet = captured.responses.find(packet => packet.url === url)
    assert.ok(packet, 'Only the captured current employer-declared request ' + url)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    return Object.defineProperty(new Response(edit(packet, text(packet)), { status: packet.status, headers: packet.headers }), 'url', { value: packet.finalUrl })
  } }
}

test('Ameyo current coherent Exotel deployment retains native roles without assigning unproven Ameyo employers', async () => {
  const jobs = await run(replay())
  const native = JSON.parse(text(captured.responses.find(packet => packet.url.endsWith('/widget/2176/openings/'))))
  assert.equal(jobs.length, 0)
  assert.deepEqual(jobs.nativeCollectionEvidence.nativeOpeningInventory.fullRows, native)
  assert.ok(native.length > 30)
  assert.ok(native.every(row => row.company_name === 'Exotel Techcom Pvt Ltd'))
  assert.equal(jobs.nativeCollectionEvidence.closingFullNativeInventoryMatch, true)
  assert.equal(jobs.nativeCollectionEvidence.failures.length, native.length)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Ameyo current deployment rejects a mixed careers build and unreviewed executable changes', async () => {
  await assert.rejects(run(replay((packet, body) => packet.url === 'https://exotel.com/about-us/careers/'
    ? text(historical.responses.find(row => row.requestedURL === packet.url)) : body)), /profile|deployment/)
  await assert.rejects(run(replay((packet, body) => packet.url.endsWith('/0ron4gsg4ubd4.js')
    ? body + ';globalThis.unreviewedRecruitingRules=true' : body)), /profile|program/)
})

test('Ameyo current deployment still rejects an altered employer careers handoff', async () => {
  await assert.rejects(run(replay((packet, body) => packet.url === 'https://exotel.com/ameyo-contact-center-by-exotel/'
    ? body.replaceAll('/about-us/careers/', '/foreign-careers/') : body)), /profile|handoff/)
})
