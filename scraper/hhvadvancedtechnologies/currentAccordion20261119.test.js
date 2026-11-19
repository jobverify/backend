import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createHhvAdvancedTechnologiesScraper, extractJobsFromCareersPage, HOMEPAGE_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-originals-20261119.json.gz', import.meta.url))))
const homepage = Buffer.from(capture.packets[0].bodyBase64, 'base64').toString()
const careers = Buffer.from(capture.packets[1].bodyBase64, 'base64').toString()
const replay = (change = html => html) => createHhvAdvancedTechnologiesScraper().run({
  now: () => capture.capturedAt,
  fetchText: async url => ({ status: 200, url, html: url === HOMEPAGE_URL ? homepage : change(careers) }),
})

test('HHV complete originals retain the captured byte hashes', () => {
  for (const packet of capture.packets) {
    const bytes = Buffer.from(packet.bodyBase64, 'base64')
    assert.equal(bytes.length, packet.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.sha256)
  }
})

test('current HHV responsibilities heading retains all 33 active, own accordion vacancies', () => {
  const jobs = extractJobsFromCareersPage(careers)
  assert.equal(jobs.length, 33)
  const logistics = jobs.find(job => job.title === 'Jr. Engineer Program Management- Sales & Logistics (TFOD)')
  assert.match(logistics.jobDescription, /Receive and record customer enquiries and RFQs/)
  assert.match(logistics.jobDescription, /MS Word, Excel, Power Point Presentation/)
  assert.ok(jobs.every(job => job.jobDescription.length < 5000), 'An accordion description must not absorb footer or later page content')
})

test('HHV source acquisition preserves full original role criteria and reconciles its closing page', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 33)
  assert.ok(jobs.every(job => ((/Education Qualification\s*:/.test(job.sourceDescription)
    && /Years of Experience\s*:/.test(job.sourceDescription)) || /Experience & Qualification:/.test(job.sourceDescription))
    && job.nativeSourceRecord.accordionHTML))
  assert.ok(jobs.every(job => job.nativeBoardListingComplete && job.sourceDetailComplete
    && !job.sourceScopeComplete && !job.lifecycleCleanupAllowed && job.country === 'India'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 33)
})

for (const [name, change] of [
  ['unreviewed description heading', html => html.replaceAll('Responsibilities:', 'Opportunities:')],
  ['foreign application origin', html => html.replaceAll('https://hhvadvancedtech.com/apply-now?', 'https://foreign.invalid/apply-now?')],
  ['foreign native role location', html => html.replaceAll('Dabaspet, Bangalore', 'Boston, USA')],
  ['inert accordion inventory', html => '<template>' + html + '</template>'],
]) test('HHV current accordion acquisition rejects ' + name, async () => {
  await assert.rejects(replay(change), /HHV Advanced Technologies|HHV native/)
})

test('closing HHV criteria drift keeps validated own roles and an incomplete listing hold', async () => {
  let reads = 0
  const jobs = await createHhvAdvancedTechnologiesScraper().run({ fetchText: async url => url === HOMEPAGE_URL ? homepage
    : ++reads === 1 ? careers : careers.replace('Receive and record customer enquiries and RFQs', 'Receive and review customer enquiries and RFQs') })
  assert.equal(jobs.length, 33)
  assert.equal(jobs[0].nativeBoardListingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing-native-inventory-changed/)
})
