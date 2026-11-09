import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  CAREERS_URL,
  SEARCH_URL,
  createAirIndiaScraper,
  extractAirIndiaOpeningLinks,
} from '../../scraper/airindia.workday/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { getScraperCatalog } from '../providers/index.js'

const readFixture = (name) => readFile(
  new URL(`./fixtures/airindia/${name}`, import.meta.url),
  'utf8',
)

test('Air India retains its complete declared listing while missing native details leave country scope unknown', async () => {
  const landingHtml = await readFixture('current-openings.html')
  const searchHtml = await readFixture('search-results.html')
  const requested = []
  const jobs = await createAirIndiaScraper({
    fetchHtml: async (url) => {
      requested.push(url)
      if (url === CAREERS_URL) return landingHtml
      if (url === SEARCH_URL) return searchHtml
      throw new Error(`Unexpected Air India URL: ${url}`)
    },
    now: () => '2026-09-13T00:00:00.000Z',
  }).run()

  assert.deepEqual(requested, [CAREERS_URL, SEARCH_URL, 'https://careers.airindia.com/job/Bengaluru-Licensed-Engineer-MRO-Bengaluru/54998844/', 'https://careers.airindia.com/job/Gurugram-Airport-Systems-Tech-Lead/55247144/'])
  assert.deepEqual(extractAirIndiaOpeningLinks(landingHtml), [SEARCH_URL])
  assert.equal(jobs.length, 2)
  assert.ok(jobs.some(({ title, location }) => /Engineer/.test(title) && /Bengaluru/.test(location)))
  assert.ok(jobs.every(({ company, country, applyUrl }) => (
    company === 'Air India'
    && country === null
    && /^https:\/\/careers\.airindia\.com\/job\//.test(applyUrl)
  )))
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.sourceCountryComplete === false && job.lifecycleCleanupAllowed === false))
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'coverage-gap',
    surface: SEARCH_URL,
    firstParty: false,
    listingComplete: false,
    pagesFetched: 1,
    reportedTotal: 2,
    indiaFacetCount: null,
    verifiedAt: '2026-09-13T00:00:00.000Z',
    reason: 'complete-air-india-declared-listing;company-inventory-scope-unresolved;native-country-or-employer-scope-unresolved',
  })
})

test('Air India fails closed when the official current-openings contract disappears', async () => {
  await assert.rejects(
    createAirIndiaScraper({ fetchHtml: async () => '<html></html>' }).run(),
    /changed materially/i,
  )
})

test('active catalog routes Air India through the live official parser', () => {
  const provider = getScraperCatalog().find(({ source }) => source === 'airindia')

  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
})

test('Air India refuses a partial or unsafe listing page', async () => {
  const landingHtml = await readFixture('current-openings.html')
  const partialHtml = `
    <title>Air India Careers Jobs</title>
    <span id="tile-search-results-label">Showing 1 to 1 of 2 Jobs</span>
    <ul id="job-tile-list" data-record-returned="1">
      <li class="job-tile"><a class="jobTitle-link" href="https://evil.example/jobs/1">Engineer</a></li>
    </ul>`

  await assert.rejects(
    createAirIndiaScraper({
      fetchHtml: async (url) => url === CAREERS_URL ? landingHtml : partialHtml,
    }).run(),
    /changed materially|unsafe|incomplete/i,
  )
})
