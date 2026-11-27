import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261117.json.gz', import.meta.url))))
const board = 'https://jobs.goodfit.so/jobs/springworks'
const token = value => JSON.stringify(value).slice(1, -1)

function replay(change) {
  let count = 0
  return { get count() { return count }, options: { fetchImpl: async (url, init) => {
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    const packet = fixture.packets.find(value => value.requestedURL === String(url))
    assert.ok(packet, 'Only original declared public URLs may be requested')
    let html = Buffer.from(packet.bodyBase64, 'base64').toString('utf8')
    if (url === board) html = change(html, ++count)
    return Object.defineProperty(new Response(html, { status: packet.status, headers: packet.headers }), 'url', { value: packet.url })
  } } }
}

function location(html, value) {
  const needle = token('"locations":[]')
  assert.ok(html.includes(needle), 'Modify a real native vacancy location field')
  return html.replace(needle, token('"locations":' + JSON.stringify(value)))
}

test('Springworks retains a native null location as unknown without publishing or certifying an empty inventory', async () => {
  const io = replay(html => location(html, null))
  const jobs = await run(io.options)
  assert.equal(io.count, 2)
  assert.equal(jobs.length, 0)
  const evidence = jobs.nativeCollectionEvidence
  assert.equal(readSourceObservationEvidence(jobs, 'springworks').observedRecordCount, 11)
  assert.equal(evidence.observations[0].nativeRecord.locations, null)
  assert.equal(evidence.observations[0].country, null)
  assert.equal(evidence.observations[0].fullRoleCriteriaQualified, false)
  assert.equal(evidence.nativeOpening.native.rows[0].locations, null)
  assert.equal(evidence.nativeClosing.native.rows[0].locations, null)
  assert.equal(evidence.wholeObservedNativeRowsClosingReconciled, true)
  assert.equal(evidence.sourceScopeComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Springworks rejects missing or unreviewed location field types', async () => {
  for (const value of ['India', {}, 0, false]) {
    const io = replay(html => location(html, value))
    await assert.rejects(run(io.options), /Native row identity\/model changed/)
    assert.equal(io.count, 1)
  }
  const io = replay(html => {
    const needle = token('"locations":[],')
    assert.ok(html.includes(needle))
    return html.replace(needle, '')
  })
  await assert.rejects(run(io.options), /Native row identity\/model changed/)
})

test('Springworks retains exact opening and closing location models when null differs from an empty array', async () => {
  const io = replay((html, round) => round === 1 ? location(html, null) : html)
  await assert.rejects(run(io.options), /Closing complete observed native models changed/)
  assert.equal(io.count, 2)
})

test('Springworks nullable workplaces still require the same native employer and card identity', async () => {
  const io = replay(html => {
    const changed = location(html, null)
    const needle = token('"name":"Springworks"')
    assert.ok(changed.includes(needle))
    return changed.replace(needle, token('"name":"Other Employer"'))
  })
  await assert.rejects(run(io.options), /Native row tenant label changed/)
  assert.equal(io.count, 1)
})
