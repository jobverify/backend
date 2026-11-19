import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { runNativeCorteva, readCortevaOriginalResponses } from './nativeCurrent.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'
const captured = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-capture-20261119.json.gz', import.meta.url))))
const replay = async (change = packet => packet) => {
  let calls = 0
  const jobs = await runNativeCorteva({ now: captured.capturedAt, fetchResponse: async (url, init) => {
    const packet = captured.packets[calls++]
    assert.ok(packet, 'Only captured requests are admitted')
    assert.equal(url, packet.requestedURL)
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
    const current = change(structuredClone(packet))
    return { ...current, bytes: Buffer.from(current.body) }
  } })
  assert.equal(calls, captured.packets.length)
  return jobs
}
test('November19 Corteva exact public replay retains zero as unknown India coverage after the client deployment changes', async () => {
  const jobs = await replay()
  const assessment = assessSoftFailureAcquisition({ source: 'corteva', companyName: 'Corteva' }, jobs)
  assert.equal(jobs.length, 0)
  assert.equal(assessment.runnerOutcome.success, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readCortevaOriginalResponses(jobs).length, captured.packets.length)
})
test('November19 Corteva exact replay cannot turn contradictory India placement into a role', async () => {
  await assert.rejects(replay(packet => {
    if (!packet.requestedURL.includes('/api/pcsx/search?')) return packet
    const payload = JSON.parse(packet.body)
    payload.data.positions[0].locations = ['Hyderabad, India']
    delete packet.bodySHA256
    return { ...packet, body: JSON.stringify(payload) }
  }), /work-country/)
})
