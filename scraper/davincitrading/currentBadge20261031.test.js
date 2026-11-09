import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createDaVinciTradingScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-native-20261031.json.gz', import.meta.url))))
const BOARD = 'https://job-boards.eu.greenhouse.io/davinciderivatives'
const options = (change = value => value) => {
  const counts = new Map()
  return { now: () => packets.at(-1).observedAt, fetchPage: async url => {
    const index = counts.get(url) || 0
    counts.set(url, index + 1)
    const packet = structuredClone(packets.filter(packet => packet.url === url)[index])
    assert.ok(packet, 'Unexpected current Da Vinci request: ' + url)
    if (url === BOARD) packet.body = change(packet.body)
    return { ...packet, url: packet.finalUrl }
  } }
}

test('current native New badge does not change the bound Da Vinci title or location', async () => {
  const jobs = await createDaVinciTradingScraper().run(options())
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Experienced Quant')
  assert.equal(jobs[0].jobId, '4046811101')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Mumbai, Maharashtra, India')
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 17)
})

for (const [label, change] of [
  ['unknown badge', html => html.replace('class="tag-text">New', 'class="tag-text">Closed')],
  ['country text in the badge', html => html.replace('class="tag-text">New', 'class="tag-text">New, India')],
  ['hidden actual title', html => html.replace('class="body body--medium">HR Business Partner', 'class="body body--medium" hidden>HR Business Partner')],
  ['conflicting visible location', html => html.replace('HR Business Partner<span class="tag-container" style="margin-left:8px"><span class="ellipse"><span class="tag-text">New</span></span></span></p><p class="body body__secondary body--metadata">Amsterdam, North Holland, Netherlands', 'HR Business Partner<span class="tag-container" style="margin-left:8px"><span class="ellipse"><span class="tag-text">New</span></span></span></p><p class="body body__secondary body--metadata">Mumbai, Maharashtra, India')],
]) test('current Da Vinci badge parsing rejects ' + label, async () => {
  await assert.rejects(createDaVinciTradingScraper().run(options(html => {
    const changed = change(html)
    assert.notEqual(changed, html, 'Mutation must affect captured input')
    return changed
  })), /Da Vinci native identity/)
})
