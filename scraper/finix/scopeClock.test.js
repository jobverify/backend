import assert from 'node:assert/strict'
import fs from 'node:fs'
import nodeTest from 'node:test'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { resolveZeroJobOutcome } from '../../scraper-support/runner.js'

const test = (name, run) => nodeTest(name, { concurrency: false }, run)
const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./native-captures/research-current-20261101.json.gz', import.meta.url))))
const packet = capture.packets.find(value => value.url === 'https://api.lever.co/v0/postings/finix?mode=json')
const bytes = Buffer.from(packet.rawBodyBase64, 'base64')
assert.equal(createHash('sha256').update(bytes).digest('hex'), packet.bodySHA256)
const actual = () => JSON.parse(bytes.toString('utf8'))
const source = getScraperCatalog().find(provider => provider.source === 'finix')
const syntheticIndia = () => {
  const native = structuredClone(actual()[0])
  Object.assign(native, { id: '00000000-0000-4000-8000-000000000101', text: 'Synthetic future India protocol role',
    country: 'IN', datePosted: '2026-10-31T00:00:00Z',
    hostedUrl: 'https://jobs.lever.co/finix/00000000-0000-4000-8000-000000000101',
    applyUrl: 'https://jobs.lever.co/finix/00000000-0000-4000-8000-000000000101/apply',
    nativeAiDisclosure: { description: 'Synthetic native AI assessment disclosure retained as an original field.' },
    categories: { ...native.categories, location: 'Pune, India', allLocations: ['Pune, India'] } })
  return native
}
// Offline protocol replay only. The original API packet was read once; these
// tests reuse it for opening/closing and may add a synthetic India role. The
// original clocks remain in the fixture and are not promoted to a new live run.
const exercise = async rows => {
  const RealDate = globalThis.Date, clock = Date.parse(packet.completedAt)
  class OriginalClock extends RealDate {
    constructor(...args) { super(...(args.length ? args : [clock])) }
    static now() { return clock }
  }
  const audits = [], calls = []
  globalThis.Date = OriginalClock
  try {
    const jobs = await createCatalogScraper(source).run({
      fetchJson: async url => {
        assert.equal(url, packet.url)
        calls.push(url)
        return structuredClone(rows)
      },
      onAudit: audit => audits.push(audit),
    })
    return { jobs, evidence: readInventoryEvidence(jobs), audits, calls }
  } finally { globalThis.Date = RealDate }
}

test('Finix current unresolved country inventory has no certification clock and retains both complete native arrays', async () => {
  const rows = actual(), result = await exercise(rows)
  assert.equal(rows.length, 26)
  assert.equal(result.jobs.length, 0)
  assert.equal(result.calls.length, 2)
  assert.equal(result.evidence.status, 'coverage-gap')
  assert.equal(result.evidence.listingComplete, false)
  assert.equal(result.evidence.reportedTotal, 26)
  assert.equal(result.evidence.indiaFacetCount, null)
  assert.equal(result.evidence.verifiedAt, null)
  assert.notEqual(resolveZeroJobOutcome({ provider: source }, result.jobs, []), 'fetched-zero')
  assert.deepEqual(result.audits[0].opening, rows)
  assert.deepEqual(result.audits[0].closing, rows)
  assert.equal(result.audits[0].lifecycleCleanupAllowed, false)
  assert.equal(result.audits[0].companyGlobalTotal, null)
  assert.equal(result.audits[0].companyIndiaTotal, null)
})

test('Finix partial inventory retains a future India role and every original native criterion, location and date without certifying the source', async () => {
  const india = syntheticIndia(), rows = [...actual(), india], result = await exercise(rows)
  assert.equal(result.jobs.length, 1)
  const job = result.jobs[0]
  assert.deepEqual(job.nativeRecord, india)
  assert.equal(job.nativeCreatedAt, india.createdAt)
  assert.equal(job.postingDate, '2026-10-31T00:00:00.000Z')
  assert.ok(job.jobDescription.includes(india.openingPlain))
  assert.ok(job.jobDescription.includes(india.descriptionBodyPlain))
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(result.evidence.verifiedAt, null)
  assert.equal(result.evidence.indiaFacetCount, null)
  assert.deepEqual(result.audits[0].opening, rows)
  assert.deepEqual(result.audits[0].closing, rows)
})

test('Finix complete synthetic India control retains its original observation clock and native creation/publication distinction', async () => {
  const india = syntheticIndia(), result = await exercise([india])
  assert.equal(result.jobs.length, 1)
  assert.equal(result.evidence.listingComplete, true)
  assert.equal(result.evidence.verifiedAt, packet.completedAt)
  assert.equal(result.evidence.indiaFacetCount, 1)
  assert.deepEqual(result.jobs[0].nativeRecord, india)
  assert.equal(result.jobs[0].nativeCreatedAt, india.createdAt)
  assert.equal(result.jobs[0].postingDate, '2026-10-31T00:00:00.000Z')
})
