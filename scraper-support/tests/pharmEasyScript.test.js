import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const officialCareersHtml = `
  <html>
    <head>
      <title>Careers</title>
      <meta name="title" content="PharmEasy Careers">
    </head>
    <body>
      <h1>Come work with us</h1>
      <p>And together we will revolutionize the Indian healthcare industry.</p>
      <a href="https://myhr.darwinbox.in/ms/candidate/careers" target="_blank" class="header-apply-now">
        Apply now
      </a>
      <a href="https://myhr.darwinbox.in/ms/candidate/careers" target="_blank">
        <span>Start Applying</span>
      </a>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 3,
  data: [
    {
      id: 'a6a39234c7fe21',
      title: 'Executive',
      department_name: 'Information Technology (THY-IT)',
      locations: 'D3, Turbhe, Maharashtra , India',
      country: 'India',
      emp_type_name: 'Full Time - Permanent',
      experience: '1 - 3 Years',
      posted_on: '22-Jun-2026',
      jd: '<p>Provide warehouse IT support.</p>',
    },
    {
      id: 'a6a1442cbb8238',
      title: 'Assistant Manager',
      department_name: 'Procurement (TSP-Proc)',
      locations: 'Turbhe, Navi Mumbai, Maharashtra , India',
      country: 'India',
      emp_type_name: 'Full Time - Permanent',
      experience: '3 - 5 Years',
      posted_on: '25-May-2026',
      jd: '<p>Lead manufacturer onboarding.</p>',
    },
    {
      id: 'us-001',
      title: 'US Operations Lead',
      department_name: 'Operations',
      locations: 'Austin, Texas, United States',
      country: 'United States',
      emp_type_name: 'Full Time - Permanent',
      experience: '5 - 8 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadPharmEasyModule = async () => {
  try {
    return await import('../../scraper/pharmeasy/script.js')
  } catch {
    assert.fail('Expected PharmEasy scraper module at ../../scraper/pharmeasy/script.js')
  }
}

const replaceOfficialHandoffUrl = (html, replacement) =>
  html.replace(/https:\/\/myhr\.darwinbox\.in\/ms\/candidate\/careers/g, replacement)

test('PharmEasy scraper keeps the verified official Darwinbox handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createPharmEasyScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialPharmEasyCareersSignals,
  } = await loadPharmEasyModule()

  assert.equal(COMPANY_NAME, 'PharmEasy')
  assert.equal(SOURCE, 'pharmeasy')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://myhr.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://pharmeasy.in/careers/')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://myhr.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://myhr.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(extractOfficialDarwinboxUrl(officialCareersHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasOfficialPharmEasyCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialPharmEasyCareersSignals(
      replaceOfficialHandoffUrl(officialCareersHtml, 'https://example.com/jobs'),
    ),
    false,
  )

  const scraper = createPharmEasyScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () =>
        replaceOfficialHandoffUrl(officialCareersHtml, 'https://example.com/jobs'),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified PharmEasy Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createPharmEasyScraper } = await loadPharmEasyModule()
  const scraper = createPharmEasyScraper({
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
      title: 'Executive',
      company: 'PharmEasy',
      department: 'Information Technology (THY-IT)',
      location: 'D3, Turbhe, Maharashtra , India',
      city: 'Turbhe',
      jobId: 'a6a39234c7fe21',
      requisitionId: null,
      sourceUrl: 'https://myhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a39234c7fe21',
      applyUrl: 'https://myhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a39234c7fe21',
      employmentType: 'Full Time - Permanent',
      experienceRequired: '1 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '22-Jun-2026',
      closingDate: null,
      jobDescription: '<p>Provide warehouse IT support.</p>',
      source: 'pharmeasy',
      link: 'https://myhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a39234c7fe21',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Assistant Manager',
      company: 'PharmEasy',
      department: 'Procurement (TSP-Proc)',
      location: 'Turbhe, Navi Mumbai, Maharashtra , India',
      city: 'Turbhe',
      jobId: 'a6a1442cbb8238',
      requisitionId: null,
      sourceUrl: 'https://myhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a1442cbb8238',
      applyUrl: 'https://myhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a1442cbb8238',
      employmentType: 'Full Time - Permanent',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '25-May-2026',
      closingDate: null,
      jobDescription: '<p>Lead manufacturer onboarding.</p>',
      source: 'pharmeasy',
      link: 'https://myhr.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a6a1442cbb8238',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
