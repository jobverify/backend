import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createFinzlyScraper } from '../../scraper/finzly/script.js'
import { finzlyCapture, finzlyNativeOptions } from './fixtures/finzlyNativeOptions.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const client = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/finzly/fixtures/optimizer-client-20261028.json.gz', import.meta.url))))
const options = (change = body => body) => {
  const capture = finzlyCapture()
  for (const packet of capture.packets) {
    if (packet.url === 'https://finzly.com/careers/') packet.body = packet.body.replace(/https:\/\/finzly\.com\/wp-content\/themes\/salient-child\/assets\/js\/app\.js(?:\?ver=\d+)?/g, client.url)
    if (packet.url.includes('/assets/js/app.js')) Object.assign(packet, { url: client.url, finalUrl: client.url, body: change(client.body) })
  }
  return finzlyNativeOptions(capture)
}
test('Finzly verifies the currently advertised optimizer bundle containing the same local role filters', async () => {
  const jobs = await createFinzlyScraper().run(options())
  assert.equal(jobs.length, 12)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('Finzly rejects changed optimizer bytes', async () => {
  await assert.rejects(createFinzlyScraper().run(options(body => body + '\n// unreviewed')), /client contract changed/)
})
