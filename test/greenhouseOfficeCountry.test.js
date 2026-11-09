import assert from 'node:assert/strict'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { attachGreenhouseSourceEvidence } from '../scraper-support/utils/greenhouseSourceEvidence.js'
import { reconcileGreenhouseOfficeCountries } from '../scraper-support/utils/greenhouseOfficeCountry.js'

globalThis.fetch = async () => assert.fail('Country reconciliation tests must use injected responses')
const provider = getScraperCatalog().find(row => row.source === 'gocardless')
const careers = 'https://gocardless.com/about/careers'
const office = (id, name) => ({ id, name, location: null, child_ids: [], parent_id: null })
const riga = () => office(88382, 'Riga'), lisbon = () => office(246085, 'Lisbon')
const role = (id, location, offices) => ({ id, title: 'Software Engineer', location: { name: location }, offices,
  absolute_url: `https://job-boards.greenhouse.io/gocardless/jobs/${id}`, metadata: null,
  content: '&lt;p&gt;Build database integrations and maintain reliable customer services.&lt;/p&gt;',
})
const fixtures = () => [role(8242496, 'Riga, Latvia', [riga()]), role(8210486, 'Lisbon, Portugal', [lisbon()]),
  role(7699256, 'Riga, Latvia', [riga(), lisbon()])]
const execute = async (records = fixtures(), { html = '<a href="https://boards.greenhouse.io/gocardless">Search Jobs</a>',
  currentProvider = provider, signal } = {}) => {
  const payload = { jobs: records, meta: { total: records.length } }, original = structuredClone(payload)
  const jobs = await createCatalogScraper(currentProvider).run({ signal,
    fetchPage: async url => { assert.equal(url, careers); return { status: 200, url, html } },
    fetchJson: async url => {
      assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/gocardless/jobs?content=true')
      return payload
    },
  })
  assert.deepEqual(payload, original, 'Cross-record country evidence cannot overwrite native office fields')
  return { jobs, evidence: readInventoryEvidence(jobs) }
}

test('registered GoCardless reconciles the same native office IDs against explicit country-scoped reference roles', async () => {
  const { jobs, evidence } = await execute()
  assert.equal(jobs.length, 0)
  assert.equal(evidence.listingComplete, true)
  assert.equal(evidence.reportedTotal, 3)
  assert.equal(evidence.indiaFacetCount, 0)
  assert.equal(evidence.pagesFetched, 2)
  assert.match(evidence.reason, /native-office-country-verified:/)
})

test('an assigned office without its own current country reference keeps the source incomplete', async () => {
  const { evidence } = await execute([fixtures()[0], fixtures()[2]])
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('another office ID with the same city name cannot borrow country evidence', async () => {
  const { evidence } = await execute([fixtures()[0], role(7699256, 'Riga, Latvia', [office(99999, 'Riga'), riga()])])
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('source-specific Greenhouse mappers reconcile inferred office locations before certifying their India output', async () => {
  const india = () => office(1234, 'Kochi')
  const records = [role(1, 'Kochi, India', [india()]), role(2, 'London, United Kingdom', [india()])]
  const mapped = [1, 2].map(id => ({ jobId: String(id), title: 'Software Engineer', country: 'India',
    location: 'Kochi, India', jobDescription: 'Build database integrations and maintain reliable customer services.' }))
  const options = { source: 'gocardless', companyName: 'GoCardless', companyCareerPage: careers,
    boardToken: 'gocardless', payload: { jobs: records, meta: { total: 2 } } }
  const complete = await attachGreenhouseSourceEvidence(mapped, options)
  assert.equal(readInventoryEvidence(complete).listingComplete, true)
  assert.equal(readInventoryEvidence(complete).indiaFacetCount, 2)
  const missing = await attachGreenhouseSourceEvidence([], options)
  assert.equal(readInventoryEvidence(missing).listingComplete, false)
  assert.equal(readInventoryEvidence(missing).indiaFacetCount, null)
  assert.match(readInventoryEvidence(missing).reason, /source-india-mapping-not-reconciled/)
})

test('a known assigned office does not supply a country to an unrelated primary city', async () => {
  const { evidence } = await execute([fixtures()[0], role(7699256, 'Toronto', [riga()])])
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('country references are scoped to this response and are never cached between source runs', async () => {
  assert.equal((await execute()).evidence.listingComplete, true)
  const later = await execute([fixtures()[2]])
  assert.equal(later.evidence.listingComplete, false)
  assert.equal(later.evidence.indiaFacetCount, null)
})

test('conflicting countries or changed definitions for one office ID leave its scope unresolved', async () => {
  for (const changed of [
    role(7699256, 'Riga, United States', [riga()]),
    role(7699256, 'Lisbon, Portugal', [office(88382, 'Lisbon')]),
    role(7699256, 'Riga, Latvia', [{ ...riga(), location: 'Riga, United States' }]),
  ]) {
    const { evidence } = await execute([fixtures()[0], changed])
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('remote, broad regional and parent offices cannot become city-level country references', async () => {
  for (const current of [office(1, 'Remote'), office(1, 'APAC'), { ...riga(), child_ids: [1] }]) {
    const { evidence } = await execute([role(1, `${current.name}, Latvia`, [current])])
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('unhandled geographic metadata stays visible after office countries reconcile', async () => {
  const records = fixtures()
  records[2].metadata = [{ name: 'Additional Work Region', value: 'APAC' }]
  const { evidence } = await execute(records)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})

test('unsupported geography cannot hide a conflicting native office definition', async () => {
  const changed = { ...role(3, 'Lisbon, Portugal', [office(88382, 'Lisbon, Portugal')]),
    additional_locations: ['Kochi, India'] }
  const records = [fixtures()[0], role(2, 'Riga', [riga()]), changed]
  const scope = reconcileGreenhouseOfficeCountries(records, { ...provider, boardToken: 'gocardless' })
  assert.equal(scope.byId.has(88382), false)
  for (const jobs of [(await execute(records)).jobs, await createPublishingGapAtsScraper({
    source: 'gocardless', companyName: 'GoCardless', atsPlatform: 'greenhouse', boardToken: 'gocardless',
  }).run({ fetchJson: async () => ({ jobs: records, meta: { total: records.length } }) })]) {
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  }
})

test('unrecognized geography on a role, primary location or office keeps its country scope unresolved', async () => {
  for (const change of [
    row => { row.additional_locations = ['Kochi, India'] },
    row => { row.location.additional_countries = ['India'] },
    row => { row.offices[0].additional_locations = ['Kochi, India'] },
  ]) {
    const records = [fixtures()[0]]
    change(records[0])
    const { evidence } = await execute(records)
    assert.equal(evidence.listingComplete, false)
    assert.equal(evidence.indiaFacetCount, null)
  }
})

test('an entirely different Greenhouse region cannot establish country evidence for a configured board', async () => {
  const records = fixtures().map(row => ({ ...row,
    absolute_url: row.absolute_url.replace('job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io') }))
  const globalProvider = { source: 'gocardless', companyName: 'GoCardless', companyCareerPage: careers,
    atsPlatform: 'greenhouse', boardToken: 'gocardless' }
  const jobs = await createPublishingGapAtsScraper(globalProvider).run({
    fetchJson: async () => ({ jobs: records, meta: { total: records.length } }),
  })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  const mapped = await attachGreenhouseSourceEvidence([], { ...globalProvider,
    payload: { jobs: records, meta: { total: records.length } } })
  assert.equal(readInventoryEvidence(mapped).listingComplete, false)
  assert.equal(readInventoryEvidence(mapped).indiaFacetCount, null)
  const euProvider = { ...globalProvider, companyCareerPage: 'https://job-boards.eu.greenhouse.io/gocardless' }
  const eu = await createPublishingGapAtsScraper(euProvider).run({
    fetchJson: async () => ({ jobs: records, meta: { total: records.length } }),
  })
  assert.equal(readInventoryEvidence(eu).listingComplete, true)
  assert.equal(readInventoryEvidence(eu).indiaFacetCount, 0)
})

test('a reference from another native board cannot establish an office country', async () => {
  const records = [fixtures()[0], role(7699256, 'Riga, Latvia', [riga(), lisbon()]),
    { ...fixtures()[1], absolute_url: 'https://job-boards.greenhouse.io/foreign/jobs/8210486' }]
  await assert.rejects(createPublishingGapAtsScraper({ source: 'gocardless', companyName: 'GoCardless',
    atsPlatform: 'greenhouse', boardToken: 'gocardless' }).run({
    fetchJson: async () => ({ jobs: records, meta: { total: records.length } }),
  }), /\[gocardless\] Invalid greenhouse inventory: foreign native posting account/)
})

test('proven additional India offices retain the referenced employer location and complete criteria', async () => {
  for (const city of ['Bengaluru', 'Kochi']) {
    const india = () => office(1234, city)
    const records = [role(1, `${city}, India`, [india()]), role(2, 'London, United Kingdom', [india()])]
    const { jobs, evidence } = await execute(records)
    assert.equal(jobs.length, 2, city)
    assert.ok(jobs.every(job => job.country === 'India' && job.location === `${city}, India`), city)
    assert.ok(jobs.every(job => /maintain reliable customer services/.test(job.jobDescription)), city)
    assert.equal(evidence.listingComplete, true, city)
    assert.equal(evidence.indiaFacetCount, 2, city)
  }
})

test('missing and inactive reference identities cannot become office authority', async () => {
  for (const changed of [{ ...fixtures()[0], id: null }, { ...fixtures()[0], isListed: false },
    { ...fixtures()[0], absolute_url: 'https://job-boards.eu.greenhouse.io/gocardless/jobs/8242496' }]) {
    const records = [changed, role(7699256, 'Riga, Latvia', [riga(), lisbon()]), fixtures()[1]]
    try {
      const { evidence } = await execute(records)
      assert.equal(evidence.listingComplete, false)
      assert.equal(evidence.indiaFacetCount, null)
    } catch (error) {
      assert.match(error.message, /identity|inventory|listing|record|role|vacancy|URL/i)
    }
  }
})

test('the employer handoff and additional hiring channels remain part of source verification', async () => {
  await assert.rejects(execute(fixtures(), { html: '<h1>Careers</h1>' }), /binding|handoff/i)
  const { evidence } = await execute(fixtures(), { html: '<a href="https://boards.greenhouse.io/gocardless">Search Jobs</a>'
    + '<a href="https://jobs.ashbyhq.com/another-employer">Other open roles</a>' })
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
})
