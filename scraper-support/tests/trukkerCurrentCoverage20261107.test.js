import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from '../../scraper/trukkerindia/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/trukker-current-20261107/native-packets.json.gz', import.meta.url))))
const recorded = new Map(packets.map(packet => [packet.requestUrl, packet]))
globalThis.fetch = async () => { throw Error('Replay cannot use live network') }
const replay = (change = (_url, packet) => packet) => {
  const requests = [], counts = new Map()
  const fetchImpl = async (url, init = {}) => {
    url = String(url)
    assert.equal(init.method ?? 'GET', 'GET')
    assert.equal(init.redirect, 'manual')
    assert.ok(recorded.has(url), 'Undeclared public read: ' + url)
    requests.push(url); counts.set(url, (counts.get(url) || 0) + 1)
    const packet = change(url, structuredClone(recorded.get(url)), counts.get(url))
    const response = new Response(packet.body, {status: packet.status, headers: packet.headers || {'content-type': 'text/html'}})
    Object.defineProperty(response, 'url', {value: packet.url})
    return response
  }
  return {requests, options: {fetchImpl, fetchHtml: async url => recorded.get(url).body, requestIntervalMs: 0, now: () => '2026-11-07T14:00:00Z'}}
}

test('TruKKer follows its current declared JSON inventory and retains complete typed India criteria', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Replay cannot use live network') })
  const r = replay(), jobs = await run(r.options)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.jobId, 'operations-coordinator-bangalore')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Bangalore')
  assert.equal(job.nativeSourceRecord.COUNTRY, 'India')
  for (const sentence of [...job.nativeSourceRecord.KEYRESPONSIBILITIES, ...job.nativeSourceRecord.QUALIFICATIONS]) assert.ok(job.jobDescription.includes(sentence))
  assert.equal(job.applyUrl, 'mailto:career@trukker.com')
  assert.equal(job.postingDate, null)
  assert.equal(job.firstEverPostedAt, null)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(r.requests.filter(url => url.endsWith('career.json?v=1')).length, 2)
})

test('TruKKer does not use its India branding when the own native country is foreign', async () => {
  const r = replay((url, packet) => {
    if (url.includes('career.json')) {
      const rows = JSON.parse(packet.body)
      rows.find(row => row.URL === 'operations-coordinator-bangalore').COUNTRY = 'United Arab Emirates'
      packet.body = JSON.stringify(rows)
    }
    return packet
  }), jobs = await run(r.options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('TruKKer rejects a changed native client before reading its declared inventory', async () => {
  const r = replay((url, packet) => { if (url.endsWith('/career-positions')) packet.body = packet.body.replace('var JOBS;', 'var JOBS; /* changed native contract */'); return packet })
  await assert.rejects(run(r.options), /native client contract changed/)
  assert.equal(r.requests.some(url => url.includes('career.json')), false)
})

test('TruKKer rejects a closing native criteria change', async () => {
  const r = replay((url, packet, visit) => {
    if (url.endsWith('career.json?v=1') && visit === 2) {
      const rows = JSON.parse(packet.body)
      rows.find(row => row.URL === 'operations-coordinator-bangalore').QUALIFICATIONS.push('Changed closing qualification')
      packet.body = JSON.stringify(rows)
    }
    return packet
  })
  await assert.rejects(run(r.options), /closing native inventory changed/)
})

for (const location of ['Dubai', 'Dubai, United Arab Emirates']) test(`TruKKer holds an own physical worksite conflict: ${location}`, async () => {
  const r = replay((url, packet) => {
    if (url.includes('career.json')) {
      const rows = JSON.parse(packet.body)
      rows.find(row => row.URL === 'operations-coordinator-bangalore').LOCATION = location
      packet.body = JSON.stringify(rows)
    }
    return packet
  }), jobs = await run(r.options)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('TruKKer preserves opaque cancellation after the final native response hook', async () => {
  const r = replay(), controller = new AbortController(), reason = Symbol('closing native cancellation')
  let careerReads = 0
  await assert.rejects(run({...r.options, signal: controller.signal, onNativeResponse: page => {
    if (page.url === 'https://www.trukker.com/careers' && ++careerReads === 2) controller.abort(reason)
  }}), error => error === reason)
  assert.equal(careerReads, 2)
})
