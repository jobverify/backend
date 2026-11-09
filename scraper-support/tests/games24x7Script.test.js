import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
  <html>
    <head>
      <title>Games24x7: Where the Science of Gaming Meets AI & Data</title>
    </head>
    <body>
      <h1>Entertaining 120 million+ players using The Science of Gaming</h1>
      <a href="https://www.games24x7.com/life">Life at Games24x7</a>
      <a href="https://www.games24x7.com/life">Join Us</a>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html>
    <head>
      <title>Games24x7: Where the Science of Gaming Meets AI &amp; Data</title>
    </head>
    <body>
      <h1>Entertaining 120 million + players using The Science of Gaming</h1>
      <a href="/life">Life at Games24x7</a>
      <a href="/life">Join Us</a>
    </body>
  </html>
`

const lifeHtml = `
  <html>
    <head>
      <title>Bold Ideas, Bright Futures - Life At Games24x7</title>
    </head>
    <body>
      <div>LIFE AT GAMES24x7</div>
      <h1>Bold ideas, bright futures</h1>
      <h2>Level Up Your Career with Us</h2>
      <a href="https://games24x7.darwinbox.in/ms/candidate/a6150564417204/careers">View all jobs</a>
    </body>
  </html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'g247-001',
      title: 'Senior Product Analyst',
      department_name: 'Analytics',
      locations: 'Mumbai, Maharashtra, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 6 Years',
      posted_on: '15-Jul-2026',
      jd: '<p>Analyze gameplay and product signals.</p>',
    },
    {
      id: 'g247-us-001',
      title: 'US Role',
      department_name: 'Engineering',
      locations: 'New York, United States',
      country: 'United States',
      emp_type_name: 'Full Time',
      experience: '4 - 7 Years',
      posted_on: '15-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadGames24x7Module = async () => {
  try {
    return await import('../../scraper/games24x7/script.js')
  } catch {
    assert.fail('Expected Games24x7 scraper module at ../../scraper/games24x7/script.js')
  }
}

const replaceOfficialHandoffUrl = (html, replacement) =>
  html.replace(
    /https:\/\/games24x7\.darwinbox\.in\/ms\/candidate\/a6150564417204\/careers/g,
    replacement,
  )

test('Games24x7 scraper keeps the verified official Darwinbox handoff explicit and fails closed on drift', async () => {
  const {
    COMPANY_NAME,
    DARWINBOX_COMPANY_ID,
    DARWINBOX_ORIGIN,
    OFFICIAL_CAREERS_HANDOFF_URL,
    HOMEPAGE_URL,
    OFFICIAL_CAREERS_URL,
    PUBLIC_PORTAL_URL,
    SOURCE,
    createGames24x7Scraper,
    extractOfficialDarwinboxUrl,
    hasOfficialGames24x7HomepageSignals,
    hasOfficialGames24x7LifeSignals,
  } = await loadGames24x7Module()

  assert.equal(COMPANY_NAME, 'Games24x7')
  assert.equal(SOURCE, 'games24x7')
  assert.equal(DARWINBOX_COMPANY_ID, 'a6150564417204')
  assert.equal(DARWINBOX_ORIGIN, 'https://games24x7.darwinbox.in')
  assert.equal(HOMEPAGE_URL, 'https://www.games24x7.com/')
  assert.equal(OFFICIAL_CAREERS_URL, 'https://www.games24x7.com/life')
  assert.equal(
    OFFICIAL_CAREERS_HANDOFF_URL,
    'https://games24x7.darwinbox.in/ms/candidate/a6150564417204/careers',
  )
  assert.equal(
    PUBLIC_PORTAL_URL,
    'https://games24x7.darwinbox.in/ms/candidatev2/a6150564417204/careers/allJobs',
  )
  assert.equal(hasOfficialGames24x7HomepageSignals(homepageHtml), true)
  assert.equal(hasOfficialGames24x7HomepageSignals(currentHomepageHtml), true)
  assert.equal(hasOfficialGames24x7LifeSignals(lifeHtml), true)
  assert.equal(extractOfficialDarwinboxUrl(lifeHtml), OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(
    hasOfficialGames24x7LifeSignals(
      replaceOfficialHandoffUrl(lifeHtml, 'https://example.com/jobs'),
    ),
    false,
  )

  const scraper = createGames24x7Scraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => (url === HOMEPAGE_URL ? homepageHtml : replaceOfficialHandoffUrl(lifeHtml, 'https://example.com/jobs')),
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified Games24x7 Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createGames24x7Scraper } = await loadGames24x7Module()
  const scraper = createGames24x7Scraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []
  const requestedTexts = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (/\/life$/i.test(url)) return lifeHtml
      return homepageHtml
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      return listingPayload
    },
  })

  assert.deepEqual(requestedTexts, [
    'https://www.games24x7.com/',
    'https://www.games24x7.com/life',
  ])
  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Product Analyst',
      company: 'Games24x7',
      department: 'Analytics',
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      jobId: 'g247-001',
      requisitionId: null,
      sourceUrl: 'https://games24x7.darwinbox.in/ms/candidatev2/a6150564417204/careers/jobDetails/g247-001',
      applyUrl: 'https://games24x7.darwinbox.in/ms/candidatev2/a6150564417204/careers/jobDetails/g247-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 6 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '15-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Analyze gameplay and product signals.</p>',
      source: 'games24x7',
      link: 'https://games24x7.darwinbox.in/ms/candidatev2/a6150564417204/careers/jobDetails/g247-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})
