import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T00:00:00.000Z'

const officialCareersHtml = `
  <html>
    <head>
      <title>Careers at Cleartax</title>
      <link rel="canonical" href="https://www.clear.in/s/careers">
    </head>
    <body>
      <h1>Careers at Cleartax</h1>
      <a href="https://clear.darwinbox.in/ms/candidate/careers">View Current Openings</a>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'ct-001',
      title: 'Tax Operations Analyst',
      department_name: 'Operations',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '2 - 4 Years',
      posted_on: '14-Jul-2026',
      jd: '<p>Scale tax operations automation.</p>',
    },
    {
      id: 'ct-us-001',
      title: 'US Role',
      department_name: 'Operations',
      locations: 'Austin, Texas, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '2 - 4 Years',
      posted_on: '14-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadClearTaxModule = async () => {
  try {
    return await import('../../scraper/cleartax/script.js')
  } catch {
    assert.fail('Expected ClearTax scraper module at ../../scraper/cleartax/script.js')
  }
}

test('ClearTax scraper keeps the verified official careers handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createClearTaxScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialClearTaxCareersSignals,
  } = await loadClearTaxModule()

  assert.equal(COMPANY_NAME, 'ClearTax')
  assert.equal(SOURCE, 'cleartax')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://clear.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.clear.in/s/careers')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://clear.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://clear.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(extractOfficialDarwinboxUrl(officialCareersHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasOfficialClearTaxCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialClearTaxCareersSignals(
      officialCareersHtml.replace(OFFICIAL_CAREERS_HANDOFF_URL, 'https://example.com/jobs'),
    ),
    false,
  )

  const scraper = createClearTaxScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml.replace(OFFICIAL_CAREERS_HANDOFF_URL, 'https://example.com/jobs'),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified ClearTax Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createClearTaxScraper } = await loadClearTaxModule()
  const scraper = createClearTaxScraper({
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
      title: 'Tax Operations Analyst',
      company: 'ClearTax',
      department: 'Operations',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'ct-001',
      requisitionId: null,
      sourceUrl: 'https://clear.darwinbox.in/ms/candidatev2/main/careers/jobDetails/ct-001',
      applyUrl: 'https://clear.darwinbox.in/ms/candidatev2/main/careers/jobDetails/ct-001',
      employmentType: 'Full Time',
      experienceRequired: '2 - 4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '14-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Scale tax operations automation.</p>',
      source: 'cleartax',
      link: 'https://clear.darwinbox.in/ms/candidatev2/main/careers/jobDetails/ct-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
