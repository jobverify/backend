import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work at Oxyzo - Shape the Future of Fintech</title>
  </head>
  <body>
    <main>
      <h1>Careers @ Oxyzo</h1>
      <p>Explore Roles</p>
      <a href="https://www.oxyzocareers.in/categories">Explore Roles</a>
      <p>career@oxyzo.in</p>
    </main>
  </body>
</html>
`

const LISTING_PAGE_1_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h3>Area Sales Manager - SME Lending</h3>
    <p>Business Development</p>
    <p>Full-Time</p>
    <p>3-8 Yrs</p>
    <p>Gurugram</p>
    <p>Posting:</p>
    <p>11 Jun 2026</p>
    <a href="https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending">View Details</a>

    <h3>Business Development Manager</h3>
    <p>Business Development</p>
    <p>Full-Time</p>
    <p>1-4</p>
    <p>Mumbai</p>
    <p>Posting:</p>
    <p>8 May 2026</p>
    <a href="https://www.oxyzocareers.in/jobs/business-development-manager">View Details</a>
  </body>
</html>
`

const LISTING_PAGE_2_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h3>Sales Manager - MSME LAP</h3>
    <p>Business Development</p>
    <p>Full-Time</p>
    <p>2-6</p>
    <p>Hyderabad</p>
    <p>Posting:</p>
    <p>16 Jul 2025</p>
    <a href="https://www.oxyzocareers.in/jobs/sales-manager---msme-lap">View Details</a>
  </body>
</html>
`

const EMPTY_LISTING_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Didn't find a role that suits you?</h4>
    <p>For Experienced: career@oxyzo.in</p>
  </body>
</html>
`

const AREA_SALES_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Area Sales Manager - SME Lending</h2>
    <h2>Business Development</h2>
    <p>Full-Time</p>
    <p>3-8 Yrs</p>
    <p>Gurugram</p>
    <h6>Job ID:</h6>
    <h6>AS1213</h6>
    <h2>About the Business</h2>
    <p>OXYZO Financial Services Ltd. is a Leading Fintech NBFC headquartered in Gurugram.</p>
    <h2>What you will do.</h2>
    <p>Actively sourcing and acquiring SME and Mid Corporate clients.</p>
    <h2>What we are looking for.</h2>
    <p>Strong interest in working with SMEs & Emerging Corporates.</p>
    <h2>What we are offering.</h2>
    <p>Competitive Pay & Benefits.</p>
    <h5>Application Form</h5>
  </body>
</html>
`

const BDM_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Business Development Manager</h2>
    <h2>Business Development</h2>
    <p>Full-Time</p>
    <p>1-4</p>
    <p>Mumbai</p>
    <h6>Job ID:</h6>
    <h6>BDM2201</h6>
    <h2>About the Business</h2>
    <p>OXYZO Financial Services Ltd. serves SMEs and emerging corporates.</p>
    <h2>What you will do.</h2>
    <p>Generate new business opportunities in the assigned market.</p>
    <h2>What we are looking for.</h2>
    <p>Relationship-building and sales discipline.</p>
    <h5>Application Form</h5>
  </body>
</html>
`

const MSME_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Sales Manager - MSME LAP</h2>
    <h2>Business Development</h2>
    <p>Full-Time</p>
    <p>2-6</p>
    <p>Hyderabad</p>
    <h6>Job ID:</h6>
    <h6>SML3304</h6>
    <h2>About the Business</h2>
    <p>We build secured lending solutions for MSMEs.</p>
    <h2>What you will do.</h2>
    <p>Drive MSME LAP growth in Hyderabad.</p>
    <h2>What we are offering.</h2>
    <p>Meritocratic and rewarding environment.</p>
    <h5>Application Form</h5>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/oxyzo/script.js')
  } catch {
    assert.fail('Expected Oxyzo scraper module at ../../scraper/oxyzo/script.js')
  }
}

test('Oxyzo pins the verified official homepage, page builder, and job-detail URL patterns', async () => {
  const oxyzo = await loadModule()

  assert.equal(oxyzo.HOMEPAGE_URL, 'https://www.oxyzocareers.in/')
  assert.equal(oxyzo.CAREERS_PAGE_URL, 'https://www.oxyzocareers.in/categories')
  assert.equal(oxyzo.JOB_PAGE_PREFIX, 'https://www.oxyzocareers.in/jobs/')
  assert.equal(oxyzo.PAGINATION_QUERY_PARAM, 'comp-lyh6vd88_page')
  assert.equal(oxyzo.buildCategoriesPageUrl(1), 'https://www.oxyzocareers.in/categories')
  assert.equal(
    oxyzo.buildCategoriesPageUrl(2),
    'https://www.oxyzocareers.in/categories?comp-lyh6vd88_page=2',
  )
  assert.equal(oxyzo.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.deepEqual(
    oxyzo.extractJobDetailUrls(LISTING_PAGE_1_HTML),
    [
      'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
      'https://www.oxyzocareers.in/jobs/business-development-manager',
    ],
  )
})

test('Oxyzo extracts a structured job from a verified first-party detail page', async () => {
  const oxyzo = await loadModule()

  const job = oxyzo.extractJobFromDetailPage(
    AREA_SALES_DETAIL_HTML,
    'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
  )

  assert.deepEqual(job, {
    title: 'Area Sales Manager - SME Lending',
    company: 'Oxyzo',
    department: 'Business Development',
    location: 'Gurugram',
    city: 'Gurugram',
    country: 'India',
    jobId: 'AS1213',
    requisitionId: 'AS1213',
    sourceUrl: 'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
    applyUrl: 'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
    employmentType: 'Full-Time',
    experienceRequired: '3-8 Yrs',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About the Business',
      'OXYZO Financial Services Ltd. is a Leading Fintech NBFC headquartered in Gurugram.',
      'What you will do.',
      'Actively sourcing and acquiring SME and Mid Corporate clients.',
      'What we are looking for.',
      'Strong interest in working with SMEs & Emerging Corporates.',
      'What we are offering.',
      'Competitive Pay & Benefits.',
    ].join('\n'),
  })
})

test('Oxyzo run validates the official homepage, paginates until the first empty page, and returns first-party jobs', async () => {
  const oxyzo = await loadModule()
  const requestedUrls = []

  const jobs = await oxyzo.createOxyzoScraper({
    now: () => FIXED_SCRAPED_AT,
    maxPages: 10,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === oxyzo.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === oxyzo.buildCategoriesPageUrl(1)) return LISTING_PAGE_1_HTML
      if (url === oxyzo.buildCategoriesPageUrl(2)) return LISTING_PAGE_2_HTML
      if (url === oxyzo.buildCategoriesPageUrl(3)) return EMPTY_LISTING_PAGE_HTML
      if (url === 'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending') return AREA_SALES_DETAIL_HTML
      if (url === 'https://www.oxyzocareers.in/jobs/business-development-manager') return BDM_DETAIL_HTML
      if (url === 'https://www.oxyzocareers.in/jobs/sales-manager---msme-lap') return MSME_DETAIL_HTML

      throw new Error(`Unexpected Oxyzo URL: ${url}`)
    },
    wait: async () => {},
  })

  assert.deepEqual(requestedUrls, [
    oxyzo.HOMEPAGE_URL,
    oxyzo.buildCategoriesPageUrl(1),
    oxyzo.buildCategoriesPageUrl(2),
    oxyzo.buildCategoriesPageUrl(3),
    'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
    'https://www.oxyzocareers.in/jobs/business-development-manager',
    'https://www.oxyzocareers.in/jobs/sales-manager---msme-lap',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      city: job.city,
      jobId: job.jobId,
      link: job.link,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Area Sales Manager - SME Lending',
        city: 'Gurugram',
        jobId: 'AS1213',
        link: 'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending',
        source: 'oxyzo',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Business Development Manager',
        city: 'Mumbai',
        jobId: 'BDM2201',
        link: 'https://www.oxyzocareers.in/jobs/business-development-manager',
        source: 'oxyzo',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Sales Manager - MSME LAP',
        city: 'Hyderabad',
        jobId: 'SML3304',
        link: 'https://www.oxyzocareers.in/jobs/sales-manager---msme-lap',
        source: 'oxyzo',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Oxyzo fails closed when the verified homepage, listing surface, or detail pages drift materially', async () => {
  const oxyzo = await loadModule()

  await assert.rejects(
    oxyzo.createOxyzoScraper().run({
      fetchText: async (url) => {
        if (url === oxyzo.HOMEPAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        throw new Error(`Unexpected Oxyzo URL: ${url}`)
      },
      wait: async () => {},
    }),
    /verified official oxyzo homepage/i,
  )

  await assert.rejects(
    oxyzo.createOxyzoScraper().run({
      fetchText: async (url) => {
        if (url === oxyzo.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === oxyzo.buildCategoriesPageUrl(1)) return '<html><body><p>No roles</p></body></html>'
        throw new Error(`Unexpected Oxyzo URL: ${url}`)
      },
      wait: async () => {},
    }),
    /verified oxyzo careers listing surface/i,
  )

  await assert.rejects(
    oxyzo.createOxyzoScraper().run({
      fetchText: async (url) => {
        if (url === oxyzo.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === oxyzo.buildCategoriesPageUrl(1)) return LISTING_PAGE_1_HTML
        if (url === oxyzo.buildCategoriesPageUrl(2)) return EMPTY_LISTING_PAGE_HTML
        if (url === 'https://www.oxyzocareers.in/jobs/area-sales-manager---sme-lending') {
          return '<html><body><h2>Broken</h2></body></html>'
        }
        if (url === 'https://www.oxyzocareers.in/jobs/business-development-manager') return BDM_DETAIL_HTML
        throw new Error(`Unexpected Oxyzo URL: ${url}`)
      },
      wait: async () => {},
    }),
    /verified oxyzo job detail page/i,
  )
})
