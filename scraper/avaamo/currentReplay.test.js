import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recovery-20261113.json.gz', import.meta.url))))
const execute = mutate => {
  const counts = new Map()
  return run({ fetchImpl: async url => {
    const index = counts.get(url) || 0; counts.set(url, index + 1)
    const packet = capture.responses.filter(row => row.requestedUrl === url)[index]
    assert.ok(packet, 'Unexpected Avaamo public read: ' + url)
    const response = new Response(mutate ? mutate(packet.body, url) : packet.body, { status: packet.status, headers: packet.headers })
    Object.defineProperty(response, 'url', { value: packet.url }); return response
  } })
}

test('Avaamo current recovered publication validates all twelve roles and closing native inventory without relaxing titles', async () => {
  const jobs = await execute()
  assert.equal(jobs.length, 12)
  assert.ok(jobs.every(job => job.sourceDescription.length > 100 && job.sourceScopeComplete === false))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Avaamo still rejects an unrelated native page title on a current role page', async () => {
  await assert.rejects(execute((html, url) => url.includes('/career/')
    ? html.replace(/<title>[\s\S]*?<\/title>/, '<title>Other employer role</title>') : html), /native page title differs/)
})
