import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const officialAboutHtml = `
  <html lang="en">
    <head>
      <title>axio - Revolutionizing Finance Through Technology and Innovation</title>
      <meta
        name="description"
        content="Discover how axio is transforming the financial landscape with innovative solutions, data-driven insights, and a commitment to making finance smarter and more accessible for everyone."
      >
    </head>
    <body>
      <section>
        <p>Our Vision</p>
        <h1>A tech-first financial platform for the next 100 million Indian customers</h1>
        <a href="https://axiofinance.darwinbox.in/ms/candidate/careers">Join our team</a>
      </section>
      <section>
        <h2>Backed by the best</h2>
      </section>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'axio-001',
      title: 'Software Development Engineer',
      department_name: 'Engineering',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '15-Jul-2026',
      jd: '<p>Build lending and finance platform experiences.</p>',
    },
    {
      id: 'axio-us-001',
      title: 'US Role',
      department_name: 'Engineering',
      locations: 'Seattle, Washington, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '15-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadAxioModule = async () => {
  try {
    return await import('../../scraper/axio/script.js')
  } catch {
    assert.fail('Expected Axio scraper module at ../../scraper/axio/script.js')
  }
}

const replaceOfficialHandoffUrl = (html, replacement) =>
  html.replace(/https:\/\/axiofinance\.darwinbox\.in\/ms\/candidate\/careers/g, replacement)

test('Axio scraper keeps the verified first-party Darwinbox handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createAxioScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialAxioCareersSignals,
  } = await loadAxioModule()

  assert.equal(COMPANY_NAME, 'Axio')
  assert.equal(SOURCE, 'axio')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://axiofinance.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.axio.co.in/about-us')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://axiofinance.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://axiofinance.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(extractOfficialDarwinboxUrl(officialAboutHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasOfficialAxioCareersSignals(officialAboutHtml), true)
  assert.equal(
    hasOfficialAxioCareersSignals(
      replaceOfficialHandoffUrl(
        officialAboutHtml,
        'https://example.com/ms/candidate/careers',
      ),
    ),
    false,
  )

  const scraper = createAxioScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => replaceOfficialHandoffUrl(
        officialAboutHtml,
        'https://example.com/ms/candidate/careers',
      ),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified Axio Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createAxioScraper } = await loadAxioModule()
  const scraper = createAxioScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []

  const jobs = await scraper.run({
    fetchText: async () => officialAboutHtml,
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      return listingPayload
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Software Development Engineer',
      company: 'Axio',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'axio-001',
      requisitionId: null,
      sourceUrl: 'https://axiofinance.darwinbox.in/ms/candidatev2/main/careers/jobDetails/axio-001',
      applyUrl: 'https://axiofinance.darwinbox.in/ms/candidatev2/main/careers/jobDetails/axio-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '15-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build lending and finance platform experiences.</p>',
      source: 'axio',
      link: 'https://axiofinance.darwinbox.in/ms/candidatev2/main/careers/jobDetails/axio-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
