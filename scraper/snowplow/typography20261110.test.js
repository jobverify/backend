import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {typographyAlias, typographyTarget, typographyPacket} from './typography20261110.fixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'

const read = name => JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/' + name, import.meta.url))))
const native = read('native-cohort-20261109-evening.json.gz')
const assets = new Map(read('declared-build-20261109.json.gz').packets.map(packet => [packet.requestedURL, packet]))
const archive = new Map(read('current-native-20261106-evening.json.gz').packets.map(packet => [packet.requestUrl, packet]))

async function replay(mutate = () => {}, denied = false) {
  const calls = []
  let audit
  const jobs = await createCurrentSnowplowScraper().run({onAudit: value => { audit = value }, fetchPage: async (url, init) => {
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit')
    const matches = native.packets.filter(packet => packet.url === url)
    const occurrence = calls.filter(call => call.url === url).length
    const packet = url === typographyAlias ? typographyPacket(denied ? 'plain' : 'browser')
      : url === typographyTarget ? typographyPacket('target')
      : matches.length ? matches[Math.min(occurrence, matches.length - 1)].response : assets.get(url) || archive.get(url)
    assert.ok(packet, 'Only actual captured public endpoints: ' + url)
    const response = {status: packet.status, url: packet.url, contentType: packet.contentType,
      body: packet.body, headers: packet.headers, bodyComplete: packet.bodyComplete ?? true}
    mutate(response, url, calls)
    calls.push({url, init})
    return response
  }})
  return {jobs, audit, calls, evidence: readInventoryEvidence(jobs)}
}

test('current public typography redirect is proved twice while corporate and country disagreements stay unresolved', async () => {
  const {jobs, audit, calls, evidence} = await replay()
  assert.equal(audit.gaps.some(reason => reason.startsWith('unreviewed-declared-stylesheet:')), false)
  for (const url of [typographyAlias, typographyTarget]) {
    assert.equal(calls.filter(call => call.url === url).length, 2)
    const originals = audit.retainedNativeResponses.filter(receipt => receipt.url === url)
    assert.equal(originals.length, 2)
    assert.ok(originals.every(receipt => receipt.response.body === typographyPacket(url === typographyAlias ? 'browser' : 'target').body))
  }
  const styleReads = calls.filter(call => [typographyAlias, typographyTarget].includes(call.url))
  assert.ok(styleReads.every(call => call.init.headers.Referer === 'https://snowplow.careers.hibob.com/'))
  assert.ok(styleReads.every(call => /Chrome\/148\.0\.0\.0/.test(call.init.headers['User-Agent'])))
  assert.equal(audit.nativeInventoryCount, 10)
  assert.equal(jobs.length, 0)
  assert.match(audit.gaps.join(';'), /corporate\/native inventory identity mismatch/)
  assert.match(audit.gaps.join(';'), /unreconciled-native-role-reference/)
  assert.match(audit.gaps.join(';'), /native-posting-country-disagreement:1b29b2e2-8fa7-431f-948d-060d8ec1fe33/)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(audit.sourceScopeComplete, false)
  assert.equal(audit.cleanupAllowed, false)
  assert.deepEqual(inventoryCleanupOptions({inventoryEvidence: evidence}), {replaceExisting: false})
})

test('a denied current typography request retains its original response and unresolved stylesheet gap', async () => {
  const {audit, calls, evidence} = await replay(undefined, true)
  assert.ok(audit.gaps.includes('unreviewed-declared-stylesheet:' + typographyAlias))
  assert.equal(calls.filter(call => call.url === typographyTarget).length, 0)
  assert.ok(audit.retainedNativeResponses.some(receipt => receipt.url === typographyAlias && receipt.response.status === 403))
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

for (const [label, mutate, reason] of [
  ['foreign redirect destination', (response, url) => { if (url === typographyAlias) response.headers.location = 'https://example.invalid/fonts.css' }, /unreviewed publisher resource redirect/],
  ['unreviewed publisher path', (response, url) => { if (url === typographyAlias) response.headers.location = 'https://fonts.hibob.com/other.css' }, /unreviewed publisher resource redirect/],
  ['missing redirect location', (response, url) => { if (url === typographyAlias) delete response.headers.location }, /unreviewed publisher resource redirect/],
  ['changed CSS bytes', (response, url) => { if (url === typographyTarget) response.body += '\nbody{display:none}' }, /renderer\/style\/program changed/],
  ['changed CSS MIME', (response, url) => { if (url === typographyTarget) response.contentType = 'text/html' }, /renderer\/style\/program changed/],
  ['closing CSS edit', (response, url, calls) => { if (url === typographyTarget && calls.some(call => call.url === url)) response.body += '\na{visibility:hidden}' }, /renderer\/style\/program changed/],
]) test('current typography proof rejects ' + label + ' and keeps raw evidence', async () => {
  await assert.rejects(replay(mutate), error => {
    assert.match(error.message, reason)
    assert.equal(error.nativeEvidence.sourceScopeComplete, false)
    assert.equal(error.nativeEvidence.cleanupAllowed, false)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    assert.ok(error.retainedNativeResponses.some(receipt => receipt.url === typographyAlias))
    assert.equal(error.nativeEvidence.attempts.some(attempt => /example\.invalid|\/other\.css$/.test(attempt.url)), false)
    return true
  })
})
