import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const captured = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261120.json.gz', import.meta.url))))
const historical = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261118.json.gz', import.meta.url))))
const text = packet => Buffer.from(packet.bodyBase64, 'base64').toString('utf8')
function replay(edit = (packet, body) => body) {
  return { requestIntervalMs: 0, fetchImpl: async (url, init) => {
    const packet = captured.responses.find(packet => packet.url === url)
    assert.ok(packet, 'Only a captured own declared native request ' + url)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    return Object.defineProperty(new Response(edit(packet, text(packet)), { status: packet.status, headers: packet.headers }), 'url', { value: packet.finalUrl })
  } }
}

test('Contlo current help-navigation deployment preserves its full India role and native application restrictions', async () => {
  const jobs = await run(replay())
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '10bfc88c061c2a93c7ea9098')
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].jobDescription, /1 to 3 years/)
  assert.equal(jobs[0].nativeApplicationRestrictions.resumeRequired, true)
  assert.equal(jobs.nativeCollectionEvidence.closingFullNativeModelsMatch, true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Contlo current corporate admission rejects an unseen executable and mixed corporate deployment', async () => {
  await assert.rejects(run(replay((packet, body) => packet.url === 'https://contlo.com/'
    ? body.replace('</body>', '<script>window.unreviewedHiringRules=true</script></body>') : body)), /whole finite current corporate deployment/)
  await assert.rejects(run(replay((packet, body) => packet.url === 'https://contlo.com/careers'
    ? text(historical.responses.find(row => row.url === packet.url)) : body)), /whole finite current corporate deployment/)
})

test('Contlo current role page still rejects unreviewed code when the analytics declaration is absent', async () => {
  await assert.rejects(run(replay((packet, body) => packet.url.includes('/apply/10bfc')
    ? body.replace('</body>', '<script>window.unreviewedApplicationRule=true</script></body>') : body)), /native body\/executable structure/)
})
