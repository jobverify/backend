import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const officialCareersHtml = `
  <html>
    <head>
      <title>Careers at Pixxel | Build the Future of Earth Observation</title>
    </head>
    <body>
      <h1>Careers</h1>
      <p>Pixxel exists to push the boundaries of space and put its power to work for the planet.</p>
      <p>What started as a team of five in 2019 is now a 200+ strong global company.</p>
      <a href="https://pixxel.darwinbox.in/ms/candidate/careers">view current openings</a>
      <a href="https://pixxel.darwinbox.in/ms/candidate/careers">explore opportunities</a>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'pixxel-001',
      title: 'Calibration Engineer',
      department_name: 'Space Systems',
      locations: 'Bengaluru, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 6 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Build calibration workflows for hyperspectral systems.</p>',
    },
    {
      id: 'pixxel-us-001',
      title: 'AI Scientist - Geospatial & Multimodal Intelligence',
      department_name: 'AI Research',
      locations: 'Los Angeles, California, United States of America',
      country: 'United States of America',
      emp_type_name: 'Full Time',
      experience: '5 - 8 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadPixxelModule = async () => {
  try {
    return await import('../../scraper/pixxel/script.js')
  } catch {
    assert.fail('Expected Pixxel scraper module at ../../scraper/pixxel/script.js')
  }
}

const replaceOfficialHandoffUrl = (html, replacement) =>
  html.replace(/https:\/\/pixxel\.darwinbox\.in\/ms\/candidate\/careers/g, replacement)

test('Pixxel scraper keeps the verified official Darwinbox handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createPixxelScraper,
    extractOfficialDarwinboxUrl,
    hasOfficialPixxelCareersSignals,
  } = await loadPixxelModule()

  assert.equal(COMPANY_NAME, 'Pixxel')
  assert.equal(SOURCE, 'pixxel')
  assert.equal(DARWINBOX_COMPANY_ID, 'main')
  assert.equal(DARWINBOX_ORIGIN, 'https://pixxel.darwinbox.in')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.pixxel.space/careers')
  assert.equal(OFFICIAL_CAREERS_HANDOFF_URL, 'https://pixxel.darwinbox.in/ms/candidate/careers')
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://pixxel.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(extractOfficialDarwinboxUrl(officialCareersHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(hasOfficialPixxelCareersSignals(officialCareersHtml), true)
  assert.equal(
    hasOfficialPixxelCareersSignals(
      replaceOfficialHandoffUrl(officialCareersHtml, 'https://example.com/jobs'),
    ),
    false,
  )

  const scraper = createPixxelScraper({
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

test('run maps verified Pixxel Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createPixxelScraper } = await loadPixxelModule()
  const scraper = createPixxelScraper({
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
      title: 'Calibration Engineer',
      company: 'Pixxel',
      department: 'Space Systems',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      jobId: 'pixxel-001',
      requisitionId: null,
      sourceUrl: 'https://pixxel.darwinbox.in/ms/candidatev2/main/careers/jobDetails/pixxel-001',
      applyUrl: 'https://pixxel.darwinbox.in/ms/candidatev2/main/careers/jobDetails/pixxel-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 6 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '17-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build calibration workflows for hyperspectral systems.</p>',
      source: 'pixxel',
      link: 'https://pixxel.darwinbox.in/ms/candidatev2/main/careers/jobDetails/pixxel-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
