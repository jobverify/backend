import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from '../scraper/waymo/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {accessibleNativePackets} from '../scraper/waymo/test-data/accessibleNativePackets.js'
import {createCatalogScraper, getScraperCatalog} from '../scraper-support/providers/index.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/waymo-native-quality.json.gz', import.meta.url))))
const now = () => capture.startedAt
const replay = (calls, edit = () => {}) => async url => {
  const original = capture.packets.find(p => p.requestedURL === url)
  assert.ok(original, 'Uncaptured Waymo request: ' + url)
  assert.equal(createHash('sha256').update(original.bodyText).digest('hex'), original.bodySHA256)
  const packet = structuredClone(original)
  edit(packet, calls)
  calls.push({url, status: packet.status})
  if (packet.status !== 200) throw Object.assign(Error('Waymo HTTP ' + packet.status), {status: packet.status, requestUrl: url, finalUrl: packet.finalURL})
  return packet.bodyText
}
const assertStop = calls => {
  const interrupted = calls.findIndex(c => c.status !== 200)
  assert.ok(interrupted >= 0)
  assert.equal(calls.length, interrupted + 1, 'No requests after the first interruption')
}

test('current Waymo HTTP 202 application interruption stops the source and retains three earlier full native models', async () => {
  const calls = [], jobs = await run({fetchText: replay(calls), now})
  assertStop(calls)
  assert.equal(calls.length, 8)
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(j => j.country === 'India' && j.nativeJobPosting && j.jobDescription.length > 1500))
  assert.ok(jobs.every(j => !j.sourceDetailComplete && !j.nativeRoleClosingReconciled && !j.sourceScopeComplete && !j.lifecycleCleanupAllowed))
  assert.equal(jobs.nativeCollectionEvidence.closingIndiaCount, null)
  assert.equal(jobs.nativeCollectionEvidence.incompleteCollectionFailure.status, 202)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const status of [202, 401, 403, 429, 451]) test('Waymo stops on application HTTP ' + status + ' without continuing to another role or closing request', async () => {
  const calls = [], jobs = await run({fetchText: replay(calls, p => {if (p.requestedURL.includes('/blocks/')) p.status = status}), now})
  assertStop(calls)
  assert.equal(calls.length, 4)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeApplicationFailure.status, status)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].activeApplyVerified, false)
  assert.equal(jobs.nativeCollectionEvidence.incompleteCollectionFailure.status, status)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

for (const status of [202, 401, 403, 429, 451]) test('Waymo stops on a closing application HTTP ' + status + ' and keeps only previously reconciled role criteria', async () => {
  const calls = []
  const jobs = await run({now: () => '2026-10-31T07:30:00.000Z', fetchText: async url => {
    const packet = accessibleNativePackets.find(p => p.url === url)
    assert.ok(packet, 'Missing accessible native model')
    const code = url.includes('/blocks/') && calls.some(c => c.url === url) ? status : packet.status
    calls.push({url, status: code})
    if (code !== 200) throw Object.assign(Error('Waymo HTTP ' + code), {status: code, requestUrl: url, finalUrl: packet.finalUrl})
    return packet.body
  }})
  assertStop(calls)
  assert.equal(calls.length, 10)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].nativeRoleClosingReconciled, true)
  assert.equal(jobs[0].nativeApplicationFailure.status, status)
  assert.equal(jobs[0].activeApplyVerified, false)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.individuallyReconciledRoles, 1)
  assert.equal(jobs.nativeCollectionEvidence.incompleteCollectionFailure.status, status)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('fresh post-repair registered Waymo route stops on the first unavailable role with no invented empty inventory', async t => {
  const calls = [], original = capture.postRepairRun
  assert.equal(original.packets.length, 3)
  t.mock.method(globalThis, 'fetch', async url => {
    const packet = original.packets.find(p => p.requestedURL === String(url))
    assert.ok(packet, 'Uncaptured post-repair request')
    assert.equal(createHash('sha256').update(packet.bodyText).digest('hex'), packet.bodySHA256)
    calls.push({url: String(url), status: packet.status})
    const response = new Response(packet.bodyText, {status: packet.status, headers: packet.headers})
    Object.defineProperty(response, 'url', {value: packet.finalURL})
    return response
  })
  const provider = getScraperCatalog().find(p => p.source === 'waymo')
  await assert.rejects(createCatalogScraper(provider).run({now: () => original.startedAt}), error => {
    assert.equal(error.status, 202)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    return true
  })
  assertStop(calls)
  assert.equal(calls.length, 3)
})
