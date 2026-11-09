import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - tbo.com</title>
  </head>
  <body>
    <a href="/">Home</a>
    <a href="/careers">Careers</a>
    <h1>Where travel meets technology, you’ll find us.</h1>
    <p>Be part of a dynamic team driven by passion, innovation, and a commitment to transforming the travel industry.</p>
    <a href="https://tbo.darwinbox.in/ms/candidate/careers">Apply Now</a>
    <h2>Employees Speak</h2>
    <h3>Tarun Narula</h3>
    <p>India</p>
  </body>
</html>
`

const TERMS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Terms and Conditions - tbo.com</title>
  </head>
  <body>
    <h1>Terms and Conditions</h1>
    <p>The Terms "TBO.com", "We", "Us", "Our" refer to TBO Tek Ltd, TBO Cargo Private Limited, Tek Travels DMCC ('TBO Dubai') and their affiliates.</p>
  </body>
</html>
`

const LISTING_PAYLOAD = {
  job_counts: 2,
  data: [
    {
      id: 'tbo-001',
      title: 'Senior Data Analyst',
      department_name: 'Analytics',
      locations: 'Gurugram, Haryana, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '3 - 5 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Build analytics for travel growth.</p>',
    },
    {
      id: 'tbo-nonindia-001',
      title: 'Regional Operations Manager',
      department_name: 'Operations',
      locations: 'Dubai, United Arab Emirates',
      country: 'United Arab Emirates',
      emp_type_name: 'Full Time',
      experience: '4 - 7 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/tbotek/script.js')
  } catch {
    assert.fail('Expected TBO Tek scraper module at ../../scraper/tbotek/script.js')
  }
}

test('TBO Tek pins the verified first-party careers handoff and exact-name legal page before Darwinbox scraping begins', async () => {
  const tboTek = await loadModule()

  assert.equal(tboTek.SOURCE, 'tbotek')
  assert.equal(tboTek.COMPANY_NAME, 'TBO Tek')
  assert.equal(tboTek.OFFICIAL_BRAND_NAME, 'TBO.COM')
  assert.equal(tboTek.COMPANY_LEGAL_NAME, 'TBO Tek Ltd.')
  assert.equal(tboTek.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(tboTek.DARWINBOX_ORIGIN, 'https://tbo.darwinbox.in')
  assert.equal(tboTek.OFFICIAL_CAREERS_URL, 'https://www.tbo.com/careers')
  assert.equal(tboTek.EXACT_NAME_EVIDENCE_URL, 'https://www.tbo.com/terms-and-conditions')
  assert.equal(
    tboTek.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://tbo.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    tboTek.PUBLIC_PORTAL_URL,
    'https://tbo.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    tboTek.extractOfficialDarwinboxUrl(OFFICIAL_CAREERS_HTML),
    tboTek.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(tboTek.hasOfficialTboCareersSignals(OFFICIAL_CAREERS_HTML), true)
  assert.equal(tboTek.hasExactNameLegalSignals(TERMS_HTML), true)
  assert.equal(
    tboTek.hasOfficialTboCareersSignals(
      OFFICIAL_CAREERS_HTML.replace(
        'https://tbo.darwinbox.in/ms/candidate/careers',
        'https://example.com/jobs',
      ),
    ),
    false,
  )
})

test('TBO Tek run validates the official careers handoff and exact-name legal page before mapping India Darwinbox jobs', async () => {
  const { createTboTekScraper } = await loadModule()
  const requestedPages = []
  const scraper = createTboTekScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedPages.push(url)

      if (url === 'https://www.tbo.com/careers') return OFFICIAL_CAREERS_HTML
      if (url === 'https://www.tbo.com/terms-and-conditions') return TERMS_HTML
      throw new Error(`Unexpected TBO Tek URL: ${url}`)
    },
    fetchListingPage: async ({ page }) => {
      assert.equal(page, 1)
      return LISTING_PAYLOAD
    },
  })

  assert.deepEqual(requestedPages, [
    'https://www.tbo.com/careers',
    'https://www.tbo.com/terms-and-conditions',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Data Analyst',
      company: 'TBO Tek',
      department: 'Analytics',
      location: 'Gurugram, Haryana, India',
      city: 'Gurugram',
      jobId: 'tbo-001',
      requisitionId: null,
      sourceUrl: 'https://tbo.darwinbox.in/ms/candidatev2/main/careers/jobDetails/tbo-001',
      applyUrl: 'https://tbo.darwinbox.in/ms/candidatev2/main/careers/jobDetails/tbo-001',
      employmentType: 'Full Time',
      experienceRequired: '3 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '17-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build analytics for travel growth.</p>',
      source: 'tbotek',
      link: 'https://tbo.darwinbox.in/ms/candidatev2/main/careers/jobDetails/tbo-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('TBO Tek fails closed when the verified careers handoff or exact-name legal page drifts', async () => {
  const { createTboTekScraper } = await loadModule()
  const scraper = createTboTekScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === 'https://www.tbo.com/careers') {
          return OFFICIAL_CAREERS_HTML.replace(
            'https://tbo.darwinbox.in/ms/candidate/careers',
            'https://example.com/jobs',
          )
        }

        if (url === 'https://www.tbo.com/terms-and-conditions') {
          return TERMS_HTML
        }

        throw new Error(`Unexpected TBO Tek URL: ${url}`)
      },
      fetchListingPage: async () => LISTING_PAYLOAD,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === 'https://www.tbo.com/careers') return OFFICIAL_CAREERS_HTML
        if (url === 'https://www.tbo.com/terms-and-conditions') {
          return TERMS_HTML.replace('TBO Tek Ltd', 'Example Travel Ltd')
        }
        throw new Error(`Unexpected TBO Tek URL: ${url}`)
      },
      fetchListingPage: async () => LISTING_PAYLOAD,
    }),
    /exact-name legal page/i,
  )
})
