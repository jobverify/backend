import assert from 'node:assert/strict'
import test from 'node:test'
import { createThryveDigitalScraper, COMPANY, SOURCE, DARWINBOX_ORIGIN, DARWINBOX_COMPANY_ID } from '../scraper/thryvedigital/script.js'
import { createDarwinboxScraper } from '../scraper/darwinbox/script.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'

const careersHtml = `<html><head><title>Careers</title></head><body>
  <h1>An enGenious career, rooted in India.</h1>
  <h2>Our Employee Value Proposition</h2>
  <h2>CULTURE WE ARE BUILDING TOGETHER</h2>
  <a href="https://tdh.darwinbox.in/ms/candidate/careers">CLICK HERE TO JOIN US</a>
</body></html>`

const nativeRecords = Array.from({ length: 154 }, (_, index) => ({
  id: `fixture-native-${index + 1}`,
  title: `Healthcare Data Engineer ${index + 1}`,
  department_name: 'Technology',
  locations: index === 150 ? 'Multiple Locations' : 'Chennai, Tamil Nadu, India',
  country: 'India',
  emp_type_name: 'Full Time',
  experience: '4 - 7 Years',
  posted_on: '20-Oct-2026',
  jd: '<p>Build reliable healthcare data pipelines, reconcile operational records, investigate data quality issues and collaborate with engineering teams to deliver tested production improvements.</p>',
}))

const transport = {
  fetchText: async url => {
    assert.equal(url, 'https://www.goengen.in/careers')
    return careersHtml
  },
  fetchListingPage: async ({ page, pageSize, companyId }) => {
    assert.equal(companyId, 'main')
    assert.equal(pageSize, 10)
    return { status: 'success', job_counts: 154, data: nativeRecords.slice((page - 1) * 10, page * 10) }
  },
}

test('ordinary Thryve defaults exhaust a 154-record feed beyond ten pages without dropping late India roles', async () => {
  const jobs = await createThryveDigitalScraper().run(transport)

  assert.equal(jobs.length, 154)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 154)
  assert.equal(jobs.at(-1).jobId, 'fixture-native-154')
  assert(jobs.every(hasSourceDescription))
  assert.equal(jobs.find(job => job.jobId === 'fixture-native-151').location, 'Multiple Locations')
  assert.equal(jobs.find(job => job.jobId === 'fixture-native-151').jobDescription, nativeRecords[150].jd)
  assert(jobs.every(job => job.sourceListingComplete !== false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.pagesFetched, 16)
  assert.equal(evidence.reportedTotal, 154)
  assert.equal(evidence.indiaFacetCount, 154)
  assert.equal(evidence.reason, 'darwinbox-complete-public-pagination')
})

test('Thryve preserves the delegated discovery-only evidence when a caller explicitly limits pagination', async () => {
  const original = structuredClone(nativeRecords)
  const startedAt = Date.now()
  const jobs = await createThryveDigitalScraper().run({ ...transport, maxPages: 2 })
  const delegated = await createDarwinboxScraper({
    companyName: COMPANY, source: SOURCE, origin: DARWINBOX_ORIGIN, companyId: DARWINBOX_COMPANY_ID,
  }).run({ fetchListingPage: transport.fetchListingPage, maxPages: 2 })
  const completedAt = Date.now()

  assert.equal(jobs.length, 20)
  assert(jobs.every(job => job.sourceListingComplete === false))
  const evidence = readInventoryEvidence(jobs)
  const expected = readInventoryEvidence(delegated)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 2)
  assert.equal(evidence.reportedTotal, 154)
  assert.equal(evidence.reason, 'darwinbox-incomplete-or-limited-pagination')
  assert.deepEqual({ ...evidence, verifiedAt: null }, { ...expected, verifiedAt: null })
  for (const item of [evidence, expected]) {
    assert.ok(Date.parse(item.verifiedAt) >= startedAt && Date.parse(item.verifiedAt) <= completedAt)
  }
  for (const job of [...jobs, ...delegated]) {
    assert.ok(Date.parse(job.scrapedAt) >= startedAt && Date.parse(job.scrapedAt) <= completedAt)
  }
  const nativeFields = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'scrapedAt'))
  assert.deepEqual(jobs.map(nativeFields), delegated.map(nativeFields))
  assert.deepEqual(nativeRecords, original)
})
