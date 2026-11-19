import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createApexonScraper, hasOfficialHomepageSignal, HOMEPAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-originals-20261119.json.gz', import.meta.url))))
const home = Buffer.from(capture.packets[0].bodyBase64, 'base64').toString()
const title = 'Data, AI, and Agentic Engineering Services | Apexon'
const replay = async (change = html => html) => createApexonScraper().run({ now: () => capture.capturedAt,
  fetchText: async url => {
    const packet = capture.packets.find(row => row.requestedUrl === url)
    if (!packet) throw Object.assign(Error('Recorded original response boundary'), { abortRetries: true })
    return { status: packet.status, url: packet.url, html: change(Buffer.from(packet.bodyBase64, 'base64').toString(), url) }
  } })

test('current Apexon original responses retain their captured hashes', () => {
  for (const packet of capture.packets) {
    const bytes = Buffer.from(packet.bodyBase64, 'base64')
    assert.equal(bytes.length, packet.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.sha256)
  }
})

test('the November19 Apexon title and active headline qualify the current own careers handoff', () => {
  assert.equal(hasOfficialHomepageSignal(home), true)
})

test('current homepage branding restores native acquisition without changing role identity or criteria', async () => {
  const jobs = await replay()
  assert.deepEqual(jobs.map(job => job.requisitionId), ['7561', '7476'])
  assert.deepEqual(jobs.map(job => job.title), ['Client Partner', 'Java Developer'])
  assert.ok(jobs.every(job => job.sourceDescription.length > 4000 && job.nativeHiringOrganization.name === 'Apexon'))
  assert.ok(jobs.every(job => job.nativeSourceRecord.documentSHA256 && !job.sourceScopeComplete && !job.lifecycleCleanupAllowed))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, change] of [
  ['unreviewed title suffix', html => html.replaceAll(title, title + ' extra')],
  ['missing current headline', html => html.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/i, '$1Unrelated enterprise$2')],
  ['foreign careers handoff', html => html.replaceAll('https://www.apexon.com/about/careers/', 'https://foreign.invalid/about/careers/')],
  ['inert current publisher', html => '<template>' + html + '</template>'],
]) test('current Apexon branding still rejects ' + name, async () => {
  assert.equal(hasOfficialHomepageSignal(change(home)), false)
  await assert.rejects(replay((html, url) => url === HOMEPAGE_URL ? change(html) : html), /official homepage/)
})
