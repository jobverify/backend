import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T12:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers in Logistics, Shipping and Technology - Shipyaari Jobs</title>
    <link rel="canonical" href="https://www.shipyaari.com/careers/">
  </head>
  <body>
    <h1>Why Join Shipyaari?</h1>
    <h2>Join The Crew, We're Hiring!</h2>
    <p>Please share your resume with us at careers@shipyaari.com</p>
    <article class="role-card">
      <h5>Sales Head - B2C & D2C</h5>
      <a href="/careers/sales-manager/"><span>Know More</span></a>
    </article>
    <article class="role-card">
      <h5>Customer Growth Manager</h5>
      <a href="https://www.shipyaari.com/careers/customer-growth-manager/"><span>Know More</span></a>
    </article>
    <article class="role-card">
      <h5>Logistics Operations Executive</h5>
      <a href="/careers/logistics-operations-executive-sr-executive/"><span>Know More</span></a>
    </article>
  </body>
</html>
`

const currentResumeOnlyCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers in Logistics, Shipping and Technology - Shipyaari Jobs</title>
    <link rel="canonical" href="https://www.shipyaari.com/careers/">
  </head>
  <body>
    <h1>Why Join Shipyaari?</h1>
    <h2>Join The Crew, We’re Hiring!</h2>
    <p>Please share your resume with us at <a href="mailto:careers@shipyaari.com">careers@shipyaari.com</a></p>
    <footer>© 2026 AVN BUSINESS SOLUTIONS PVT LTD. All Right Reserved.</footer>
  </body>
</html>
`

const salesManagerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sales Manager Job Description - Shipyaari Career</title>
  </head>
  <body>
    <h1>Shipyaari</h1>
    <p>Job Title: Sales Manager - E-commerce Platforms Specialist</p>
    <p>Position: Sales Associate - E-commerce Platforms Specialist</p>
    <p>Location: Mumbai (Goregaon West)</p>
    <p>Level: Mid-Level</p>
    <p>Preferred Joining: Immediate</p>
    <h2>Job Summary:</h2>
    <p>
      We are seeking a Sales professional with a passion for driving results and leading teams.
      In this role, you will take charge of achieving sales targets within your assigned territory.
    </p>
    <h2>Key Responsibilities and Accountabilities:</h2>
    <ul>
      <li>Possess strong sales skills and excellent communication skills.</li>
      <li>Acquire new sellers and drive their growth within the designated territory.</li>
    </ul>
    <h2>Ideal Profile:</h2>
    <ul>
      <li>Thrive in a target-driven environment.</li>
    </ul>
    <a href="mailto:careers@shipyaari.com">Apply Now</a>
  </body>
</html>
`

const customerGrowthHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Customer Growth Manager Job Description - Shipyaari Career</title>
  </head>
  <body>
    <h1>Shipyaari</h1>
    <p>Job Title: Customer Growth Manager</p>
    <p>Position: Customer Growth Manager</p>
    <p>Location: Mumbai (Goregaon West)</p>
    <p>Level: Mid-Level</p>
    <p>Preferred Joining: Immediate</p>
    <h2>Job Summary:</h2>
    <p>
      We are looking for a customer growth leader to own retention, funnel health, and marketplace expansion.
    </p>
    <h2>Key Responsibilities and Accountabilities:</h2>
    <ul>
      <li>Drive customer acquisition and retention programs.</li>
    </ul>
    <a href="mailto:careers@shipyaari.com">Apply Now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/shipyaari/script.js')
  } catch {
    assert.fail('Expected Shipyaari scraper module at ../../scraper/shipyaari/script.js')
  }
}

test('Shipyaari helpers stay pinned to the verified official careers page and role detail pages', async () => {
  const shipyaari = await loadModule()

  assert.equal(shipyaari.SOURCE, 'shipyaari')
  assert.equal(shipyaari.COMPANY_NAME, 'Shipyaari')
  assert.equal(shipyaari.OFFICIAL_BRAND_NAME, 'Shipyaari')
  assert.equal(shipyaari.VERIFIED_ON, '2026-07-17')
  assert.equal(shipyaari.HOMEPAGE_URL, 'https://www.shipyaari.com/')
  assert.equal(shipyaari.CAREERS_URL, 'https://www.shipyaari.com/careers/')
  assert.equal(shipyaari.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    shipyaari.hasOfficialCareersPageSignal(
      careersHtml
        .replace("We're Hiring!", 'We\u2019re Hiring!')
        .replace(
          'Please share your resume with us at careers@shipyaari.com',
          'Please share your resume with us at [email&#160;protected]',
        ),
    ),
    true,
  )
  assert.equal(shipyaari.hasOfficialCareersPageSignal('<html><body>Careers</body></html>'), false)
  assert.equal(shipyaari.hasOfficialRoleDetailSignal(salesManagerHtml), true)
  assert.equal(shipyaari.hasOfficialRoleDetailSignal('<html><body>Job Title only</body></html>'), false)
  assert.deepEqual(
    shipyaari.extractRoleCardsFromHtml(careersHtml),
    [
      {
        title: 'Sales Head - B2C & D2C',
        detailUrl: 'https://www.shipyaari.com/careers/sales-manager/',
      },
      {
        title: 'Customer Growth Manager',
        detailUrl: 'https://www.shipyaari.com/careers/customer-growth-manager/',
      },
      {
        title: 'Logistics Operations Executive',
        detailUrl: 'https://www.shipyaari.com/careers/logistics-operations-executive-sr-executive/',
      },
    ],
  )

  const parsed = shipyaari.extractJobFromRoleDetailHtml(
    salesManagerHtml,
    {
      title: 'Sales Head - B2C & D2C',
      detailUrl: 'https://www.shipyaari.com/careers/sales-manager/',
    },
    { scrapedAt: FIXED_SCRAPED_AT },
  )

  assert.deepEqual(parsed, {
    title: 'Sales Manager - E-commerce Platforms Specialist',
    company: 'Shipyaari',
    department: null,
    location: 'Mumbai (Goregaon West), India',
    city: 'Mumbai',
    state: null,
    country: 'India',
    jobId: 'sales-manager',
    requisitionId: 'sales-manager',
    sourceUrl: 'https://www.shipyaari.com/careers/sales-manager/',
    applyUrl: 'https://www.shipyaari.com/careers/sales-manager/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'We are seeking a Sales professional with a passion for driving results and leading teams. In this role, you will take charge of achieving sales targets within your assigned territory. Possess strong sales skills and excellent communication skills. Acquire new sellers and drive their growth within the designated territory. Thrive in a target-driven environment.',
    remoteStatus: 'On-site',
    source: 'shipyaari',
    link: 'https://www.shipyaari.com/careers/sales-manager/',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})

test('Shipyaari run validates the official careers page, follows first-party role links, and builds normalized jobs', async () => {
  const shipyaari = await loadModule()
  const requestedUrls = []

  const jobs = await shipyaari.createShipyaariScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === shipyaari.CAREERS_URL) return careersHtml
      if (url === 'https://www.shipyaari.com/careers/sales-manager/') return salesManagerHtml
      if (url === 'https://www.shipyaari.com/careers/customer-growth-manager/') return customerGrowthHtml
      if (url === 'https://www.shipyaari.com/careers/logistics-operations-executive-sr-executive/') {
        return `
          <!doctype html>
          <html>
            <body>
              <p>Job Title: Logistics Operations Executive</p>
              <p>Location: Mumbai (Goregaon West)</p>
              <p>Job Summary:</p>
              <p>Own daily shipment operations and partner coordination.</p>
              <a href="mailto:careers@shipyaari.com">Apply Now</a>
            </body>
          </html>
        `
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    shipyaari.CAREERS_URL,
    'https://www.shipyaari.com/careers/sales-manager/',
    'https://www.shipyaari.com/careers/customer-growth-manager/',
    'https://www.shipyaari.com/careers/logistics-operations-executive-sr-executive/',
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.city, job.source, job.link, job.scrapedAt]),
    [
      [
        'Sales Manager - E-commerce Platforms Specialist',
        'Mumbai',
        'shipyaari',
        'https://www.shipyaari.com/careers/sales-manager/',
        FIXED_SCRAPED_AT,
      ],
      [
        'Customer Growth Manager',
        'Mumbai',
        'shipyaari',
        'https://www.shipyaari.com/careers/customer-growth-manager/',
        FIXED_SCRAPED_AT,
      ],
      [
        'Logistics Operations Executive',
        'Mumbai',
        'shipyaari',
        'https://www.shipyaari.com/careers/logistics-operations-executive-sr-executive/',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.equal(jobs.length, 3)
})

test('Shipyaari returns no jobs for the current complete resume-only careers page', async () => {
  const shipyaari = await loadModule()

  assert.equal(shipyaari.hasOfficialCareersPageSignal(currentResumeOnlyCareersHtml), true)
  assert.equal(shipyaari.hasCurrentResumeOnlyCareersSignal(currentResumeOnlyCareersHtml), true)
  assert.deepEqual(shipyaari.extractRoleCardsFromHtml(currentResumeOnlyCareersHtml), [])

  const jobs = await shipyaari.run({
    fetchText: async (url) => {
      assert.equal(url, shipyaari.CAREERS_URL)
      return currentResumeOnlyCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Shipyaari fails closed when the verified careers surface drifts materially', async () => {
  const shipyaari = await loadModule()

  await assert.rejects(
    shipyaari.createShipyaariScraper().run({
      fetchText: async (url) => {
        if (url === shipyaari.CAREERS_URL) return '<html><body>Careers</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official Shipyaari careers page/i,
  )

  await assert.rejects(
    shipyaari.createShipyaariScraper().run({
      fetchText: async (url) => {
        if (url === shipyaari.CAREERS_URL) {
          return `
            <!doctype html>
            <html>
              <head>
                <title>Careers in Logistics, Shipping and Technology - Shipyaari Jobs</title>
              </head>
              <body>
                <h1>Why Join Shipyaari?</h1>
                <h2>Join The Crew, We're Hiring!</h2>
                <p>Please share your resume with us at careers@shipyaari.com</p>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public role links/i,
  )
})
