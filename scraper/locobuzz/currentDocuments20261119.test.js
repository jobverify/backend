import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createLocobuzzScraper } from './script.js'
import { readCurrentLocobuzzCards, readLocobuzzPdfRole } from './nativeInventory.js'
import { extractTextFromPdfBuffer } from '../../scraper-support/shared/pdfText.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-originals-20261119.json.gz', import.meta.url))))
const page = Buffer.from(capture.packets[0].bodyBase64, 'base64').toString()
const sourceURL = 'https://locobuzz.com/careers/'
const replay = async ({ changePage = html => html, changePdf, fetchPdf } = {}) => createLocobuzzScraper().run({
  now: () => capture.capturedAt,
  fetchText: async () => ({ status: 200, url: sourceURL, html: changePage(page) }),
  fetchPdf: fetchPdf || (async url => {
    const packet = capture.packets.find(row => row.requestedUrl === url)
    if (!packet) throw Error('Undeclared or uncaptured document URL: ' + url)
    const bytes = Buffer.from(packet.bodyBase64, 'base64')
    return { status: packet.status, url: packet.url, contentType: packet.headers['content-type'],
      bytes: changePdf ? changePdf(bytes, url) : bytes }
  }),
})

test('Locobuzz fixtures retain the complete publisher and eight original PDF byte hashes', () => {
  assert.equal(capture.packets.length, 9)
  for (const packet of capture.packets) {
    const bytes = Buffer.from(packet.bodyBase64, 'base64')
    assert.equal(bytes.length, packet.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.sha256)
  }
})

test('current Locobuzz cards bind eight own titles, India locations, declared documents and matching applications', () => {
  const cards = readCurrentLocobuzzCards(page, sourceURL)
  assert.equal(cards.length, 8)
  assert.equal(cards[0].title, 'Enterprise Sales Manager')
  assert.equal(cards[6].title, 'UX Designer')
  assert.ok(cards.every(card => card.documentURL.startsWith('https://locobuzz.com/careers/jd/')
    && new URL(card.applyUrl).pathname === 'careers@locobuzz.com'))
})

test('current Locobuzz source acquisition retains full PDF criteria and original evidence for all eight roles', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 8)
  const ux = jobs.find(job => job.title === 'UX Designer')
  assert.equal(ux.jobId, 'ux-designer')
  assert.match(ux.sourceDescription, /profiles without a portfolio will not be considered/)
  assert.match(ux.sourceDescription, /accessibility principles, and responsive design/)
  assert.ok(jobs.every(job => job.sourceDescription.length > 2000 && job.nativeSourceRecord.pdfSHA256
    && job.nativeSourceRecord.cardHTML && job.nativeBoardListingComplete && job.sourceDetailComplete
    && !job.sourceScopeComplete && !job.lifecycleCleanupAllowed && !job.applicationVisited))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Locobuzz document parser refuses employer, role, location, criteria and closing-status substitutions', async () => {
  const card = readCurrentLocobuzzCards(page, sourceURL)[6]
  const packet = capture.packets.find(row => row.requestedUrl === card.documentURL)
  const text = await extractTextFromPdfBuffer(Buffer.from(packet.bodyBase64, 'base64'))
  assert.equal(readLocobuzzPdfRole(card, text).nativeRoleTitle, 'UX Designer')
  for (const modified of [text.replace('Locobuzz builds', 'Other Business builds'), text.replaceAll('UX Designer', 'Product Manager'),
    text.replace('Mumbai', 'Singapore'), text.replaceAll('KEY SKILLS', 'TEAM EVENTS'),
    text + '\nThis position is closed.']) assert.throws(() => readLocobuzzPdfRole(card, modified), /Locobuzz native/)
})

for (const [name, changePage] of [
  ['foreign document origin', html => html.replaceAll('/careers/jd/', 'https://foreign.invalid/careers/jd/')],
  ['foreign role location', html => html.replaceAll('Mumbai / Gurugram / Bengaluru', 'Singapore')],
  ['conflicting application title', html => html.replace('Application%20%E2%80%94%20Enterprise%20Sales%20Manager', 'Application%20%E2%80%94%20Other%20Role')],
  ['inert current inventory', html => '<template>' + html + '</template>'],
  ['unreconciled published role count', html => html.replace('8<!-- --> roles open', '9<!-- --> roles open')],
]) test('Locobuzz current acquisition rejects ' + name, async () => {
  await assert.rejects(replay({ changePage }), /Locobuzz/)
})

test('a PDF HTTP or response identity failure cannot become a title-only role', async () => {
  for (const result of [{ status: 404, url: 'https://locobuzz.com/careers/jd/enterprise-sales-manager.pdf', bytes: Buffer.from('%PDF-') },
    { status: 200, url: 'https://foreign.invalid/role.pdf', contentType: 'application/pdf', bytes: Buffer.from('%PDF-') }]) {
    await assert.rejects(replay({ fetchPdf: async () => result }), /Locobuzz native/)
  }
})

test('the current permanent slash redirect retains the exact own careers publisher and closing route', async () => {
  const reads = []
  const jobs = await createLocobuzzScraper().run({ fetchText: async url => {
    reads.push(url)
    if (url === 'https://locobuzz.com/careers') throw Object.assign(Error('Current permanent redirect'), { status: 301 })
    assert.equal(url, sourceURL)
    return { status: 200, url, html: page }
  }, fetchPdf: async url => {
    const packet = capture.packets.find(row => row.requestedUrl === url)
    return { status: 200, url, contentType: 'application/pdf', bytes: Buffer.from(packet.bodyBase64, 'base64') }
  } })
  assert.equal(jobs.length, 8)
  assert.deepEqual(reads, ['https://locobuzz.com/careers', sourceURL, sourceURL])
})
