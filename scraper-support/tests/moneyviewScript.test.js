import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Moneyview Careers - Join us &amp; grow with us!</title>
    <meta
      name="description"
      content="Open positions at Moneyview - For career-related information please write to career@moneyview.in with the CV and team will get back to you based on the openings available."
    >
    <meta property="og:url" content="https://moneyview.in/careers">
  </head>
  <body>
    <h1>Open positions at Moneyview</h1>
    <p>For career-related information please write to career@moneyview.in with the CV and team will get back to you based on the openings available.</p>
    <a
      target="_blank"
      rel="noopener noreferrer"
      href="https://moneyview.darwinbox.in/ms/candidate/careers"
    >
      View Openings
    </a>
  </body>
</html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'moneyview-001',
      title: 'Software Development Engineer II',
      department_name: 'Engineering',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '15-Jul-2026',
      jd: '<p>Build lending and payments platform features.</p>',
    },
    {
      id: 'moneyview-us-001',
      title: 'US Product Analyst',
      department_name: 'Analytics',
      locations: 'New York, New York, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '15-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadMoneyviewModule = async () => {
  try {
    return await import('../../scraper/moneyview/script.js')
  } catch {
    assert.fail('Expected Moneyview scraper module at ../../scraper/moneyview/script.js')
  }
}

const replaceOfficialHandoffUrl = (html, replacement) =>
  html.replace(/https:\/\/moneyview\.darwinbox\.in\/ms\/candidate\/careers/g, replacement)

test('Moneyview scraper keeps the verified official Darwinbox handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createMoneyviewScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialMoneyviewCareersSignals,
  } = await loadMoneyviewModule()

  assert.equal(COMPANY_NAME, 'Moneyview')
  assert.equal(SOURCE, 'moneyview')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://moneyview.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://moneyview.in/careers')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://moneyview.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://moneyview.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(extractOfficialDarwinboxUrl(officialCareersHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasOfficialMoneyviewCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialMoneyviewCareersSignals(
      replaceOfficialHandoffUrl(officialCareersHtml, 'https://example.com/jobs'),
    ),
    false,
  )

  const scraper = createMoneyviewScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => replaceOfficialHandoffUrl(officialCareersHtml, 'https://example.com/jobs'),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified Moneyview Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createMoneyviewScraper } = await loadMoneyviewModule()
  const scraper = createMoneyviewScraper({
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
      title: 'Software Development Engineer II',
      company: 'Moneyview',
      department: 'Engineering',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'moneyview-001',
      requisitionId: null,
      sourceUrl: 'https://moneyview.darwinbox.in/ms/candidatev2/main/careers/jobDetails/moneyview-001',
      applyUrl: 'https://moneyview.darwinbox.in/ms/candidatev2/main/careers/jobDetails/moneyview-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '15-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build lending and payments platform features.</p>',
      source: 'moneyview',
      link: 'https://moneyview.darwinbox.in/ms/candidatev2/main/careers/jobDetails/moneyview-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
