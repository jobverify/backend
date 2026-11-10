import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/snowplow20261110-board-drift.json.gz', import.meta.url))))

test('an unreviewed program added to the November 10 deployment preserves evidence and unknown inventory', async () => {
  const calls = []
  await assert.rejects(createCurrentSnowplowScraper().run({fetchPage: async (url, init) => {
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    assert.equal(init.credentials, 'omit')
    const packet = capture.packets.find(packet => packet.requestedURL === url)
    assert.ok(packet, 'No unreviewed renderer or feed may be read after the new board is rejected: ' + url)
    const raw = Buffer.from(packet.rawBodyBase64, 'base64')
    assert.equal(createHash('sha256').update(raw).digest('hex'), packet.sha256)
    assert.equal(new TextDecoder('utf-8', {fatal: true}).decode(raw), packet.body)
    calls.push(url)
    const response = structuredClone(packet)
    if (url === 'https://snowplow.careers.hibob.com/') {
      response.body = response.body.replace('</body>', '<script>window.unreviewed = true</script></body>')
      delete response.rawBodyBase64
    }
    return response
  }}), error => {
    assert.match(error.message, /unreviewed complete raw employer\/native DOM or activation/)
    assert.equal(error.code, 'SNOWPLOW_NATIVE_INCOMPLETE')
    assert.equal(error.nativeEvidence.corporateDOMEquivalences.length, 1)
    assert.equal(error.nativeEvidence.nativeInventoryCount, null)
    assert.equal(error.nativeEvidence.sourceScopeComplete, false)
    assert.equal(error.nativeEvidence.cleanupAllowed, false)
    assert.equal(error.inventoryEvidence.firstParty, true)
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    assert.deepEqual(inventoryCleanupOptions({inventoryEvidence: error.inventoryEvidence}), {replaceExisting: false})
    const board = error.retainedNativeResponses.find(receipt => receipt.url === 'https://snowplow.careers.hibob.com/')
    assert.equal(board.response.bodyComplete, true)
    assert.match(board.response.body, /window\.unreviewed = true/)
    assert.match(board.response.body, /master-5469897ef786ca1c09e58c08905a2fcfde68d927/)
    assert.match(board.response.body, /main\.86790cb31de360bc\.js/)
    return true
  })
  assert.deepEqual(calls, ['https://snowplow.io/careers', 'https://snowplow.careers.hibob.com/'])
})
