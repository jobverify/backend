import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FIXED_SCRAPED_AT = '2026-07-10T00:00:00.000Z'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(currentDir, '../../scraper/gmmco/fixtures')

const officialCareersHtml = readFileSync(
  path.join(fixtureDir, 'official-careers.html'),
  'utf8',
)

const listingPayload = JSON.parse(
  readFileSync(path.join(fixtureDir, 'alljobs-page-1.json'), 'utf8'),
)

const loadGmmcoModule = async () => {
  try {
    return await import('../../scraper/gmmco/script.js')
  } catch {
    assert.fail('Expected GMMCO scraper module at ../../scraper/gmmco/script.js')
  }
}

test('GMMCO scraper keeps the verified official careers handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createGmmcoScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialGmmcoCareersSignals,
  } = await loadGmmcoModule()

  assert.equal(COMPANY_NAME, 'GMMCO')
  assert.equal(SOURCE, 'gmmco')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://gmmco.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.gmmco.in/about/careers')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://gmmco.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://gmmco.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    extractOfficialDarwinboxUrl(officialCareersHtml),
    OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(hasOfficialGmmcoCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialGmmcoCareersSignals(
      officialCareersHtml.replace(
        'https://gmmco.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
    ),
    false,
  )

  const scraper = createGmmcoScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () =>
        officialCareersHtml.replace(
          'https://gmmco.darwinbox.in/ms/candidate/careers',
          'https://example.com/jobs',
        ),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createGmmcoScraper } = await loadGmmcoModule()
  const scraper = createGmmcoScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []

  const jobs = await scraper.run({
    fetchText: async () => officialCareersHtml,
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      return listingPayload
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Service Engineer',
      company: 'GMMCO',
      department: 'Aftermarket',
      location: 'Nagpur, Maharashtra, India',
      city: 'Nagpur',
      jobId: 'gmmco-001',
      requisitionId: null,
      sourceUrl: 'https://gmmco.darwinbox.in/ms/candidatev2/main/careers/jobDetails/gmmco-001',
      applyUrl: 'https://gmmco.darwinbox.in/ms/candidatev2/main/careers/jobDetails/gmmco-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '09-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Support field maintenance and customer uptime.</p>',
      source: 'gmmco',
      link: 'https://gmmco.darwinbox.in/ms/candidatev2/main/careers/jobDetails/gmmco-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Data Analyst',
      company: 'GMMCO',
      department: 'Digital',
      location: 'Remote, India',
      city: 'Remote',
      jobId: 'gmmco-remote-001',
      requisitionId: null,
      sourceUrl: 'https://gmmco.darwinbox.in/ms/candidatev2/main/careers/jobDetails/gmmco-remote-001',
      applyUrl: 'https://gmmco.darwinbox.in/ms/candidatev2/main/careers/jobDetails/gmmco-remote-001',
      employmentType: 'Full Time',
      experienceRequired: '2 - 4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '08-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build analytics for service operations.</p>',
      source: 'gmmco',
      link: 'https://gmmco.darwinbox.in/ms/candidatev2/main/careers/jobDetails/gmmco-remote-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
