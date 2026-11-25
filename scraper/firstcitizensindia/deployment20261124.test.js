import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { runCurrentFirstCitizensInventory } from './currentNative20261111.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const load = path => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))))
const currentSearch = load('./test-data/deployment-20261124/search.json.gz')
const currentClient = load('./test-data/deployment-20261124/client.json.gz')
const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest-20261111.json', import.meta.url)))
const packets = new Map(manifest.receipts.map(row => [row.requestedURL, {
  body: gunzipSync(readFileSync(new URL('./fixtures/' + row.fixture, import.meta.url))).toString(),
  type: row.headers['content-type'],
}]))
packets.set('https://jobs.firstcitizens.com/jobs', { body: currentSearch.body, type: currentSearch.headers['content-type'] })
packets.set(currentClient.requestedUrl, { body: currentClient.body, type: currentClient.headers['content-type'] })
const replay = change => runCurrentFirstCitizensInventory({ fetchImpl: async url => {
  const packet = packets.get(url)
  assert.ok(packet, 'Unadvertised public URL ' + url)
  const response = new Response(change?.(url, packet.body) ?? packet.body, { headers: { 'content-type': packet.type } })
  return Object.defineProperty(response, 'url', { value: url })
} })

test('First Citizens current renderer retains exhaustive native country qualification for the captured India zero', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('First Citizens refuses changed current renderer bytes before accepting native zero evidence', async () => {
  await assert.rejects(replay((url, body) => url === currentClient.requestedUrl ? body + ';changedNativeQuery()' : body), /renderer|client/)
})
