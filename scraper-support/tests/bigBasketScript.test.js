import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T00:00:00.000Z'

const officialCareersHtml = `
  <html>
    <head>
      <title>BB-Careers</title>
    </head>
    <body>
      <h1>Our Journey</h1>
      <h2>Life@bigbasket</h2>
      <a href="https://bigbasket.darwinbox.in/ms/candidate/careers">Explore Jobs</a>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'bb-001',
      title: 'Supply Chain Analyst',
      department_name: 'Operations',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '2 - 4 Years',
      posted_on: '13-Jul-2026',
      jd: '<p>Optimize fulfillment analytics.</p>',
    },
    {
      id: 'bb-us-001',
      title: 'US Role',
      department_name: 'Operations',
      locations: 'Austin, Texas, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '2 - 4 Years',
      posted_on: '13-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadBigBasketModule = async () => {
  try {
    return await import('../../scraper/bigbasket/script.js')
  } catch {
    assert.fail('Expected BigBasket scraper module at ../../scraper/bigbasket/script.js')
  }
}

test('BigBasket scraper keeps the verified official careers handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createBigBasketScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialBigBasketCareersSignals,
  } = await loadBigBasketModule()

  assert.equal(COMPANY_NAME, 'BigBasket')
  assert.equal(SOURCE, 'bigbasket')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://bigbasket.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://careers.bigbasket.com/')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://bigbasket.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://bigbasket.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(extractOfficialDarwinboxUrl(officialCareersHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasOfficialBigBasketCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialBigBasketCareersSignals(
      officialCareersHtml.replace(OFFICIAL_CAREERS_HANDOFF_URL, 'https://example.com/jobs'),
    ),
    false,
  )

  const scraper = createBigBasketScraper({
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

test('run maps verified BigBasket Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createBigBasketScraper } = await loadBigBasketModule()
  const scraper = createBigBasketScraper({
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
      title: 'Supply Chain Analyst',
      company: 'BigBasket',
      department: 'Operations',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'bb-001',
      requisitionId: null,
      sourceUrl: 'https://bigbasket.darwinbox.in/ms/candidatev2/main/careers/jobDetails/bb-001',
      applyUrl: 'https://bigbasket.darwinbox.in/ms/candidatev2/main/careers/jobDetails/bb-001',
      employmentType: 'Full Time',
      experienceRequired: '2 - 4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '13-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Optimize fulfillment analytics.</p>',
      source: 'bigbasket',
      link: 'https://bigbasket.darwinbox.in/ms/candidatev2/main/careers/jobDetails/bb-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
