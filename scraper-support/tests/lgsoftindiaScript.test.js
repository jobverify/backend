import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
  <html>
    <head>
      <title>Home - LG Soft India</title>
    </head>
    <body>
      <a href="https://lgsihrms.darwinbox.in/ms/candidatev2/a6914476a29263/careers/home">Careers</a>
      <h3>WE BRING HAPPINESS TO</h3>
      <h1>OUR CUSTOMER'S LIFE</h1>
      <p>LG Soft India, the largest global R&amp;D center of LG Electronics.</p>
    </body>
  </html>
`

const CAREERS_HTML = `
  <html>
    <head>
      <title></title>
      <base href="/ms/candidatev2/">
    </head>
    <body>
      <app-root></app-root>
      <script type="module" src="/ms/dboxuilibrary/assets/dboxuilib_dist/www/build/db-components.esm.js"></script>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/lgsoftindia/script.js')
  } catch {
    assert.fail('Expected LG Soft India scraper module at ../../scraper/lgsoftindia/script.js')
  }
}

test('LG Soft India scraper pins the verified homepage and Darwinbox careers handoff', async () => {
  const lgsi = await loadModule()

  assert.equal(lgsi.SOURCE, 'lgsoftindia')
  assert.equal(lgsi.COMPANY, 'LG Soft India')
  assert.equal(lgsi.COMPANY_DOMAIN, 'lgsoftindia.com')
  assert.equal(lgsi.HOMEPAGE_URL, 'https://lgsoftindia.com/')
  assert.equal(lgsi.DARWINBOX_ORIGIN, 'https://lgsihrms.darwinbox.in')
  assert.equal(lgsi.DARWINBOX_COMPANY_ID, 'a6914476a29263')
  assert.equal(
    lgsi.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://lgsihrms.darwinbox.in/ms/candidatev2/a6914476a29263/careers/home',
  )
  assert.equal(lgsi.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(lgsi.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('LG Soft India scraper returns India jobs from Darwinbox and preserves hosted job detail URLs', async () => {
  const lgsi = await loadModule()
  const requestedPages = []

  const jobs = await lgsi.createLgSoftIndiaScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === lgsi.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === lgsi.OFFICIAL_CAREERS_HANDOFF_URL) return CAREERS_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchListingPage: async ({ page, pageSize, companyId }) => {
      requestedPages.push({ page, pageSize, companyId })

      return {
        status: 'success',
        data: [
          {
            id: 'lg-001',
            title: 'Senior Software Engineer',
            department_name: 'Engineering',
            locations: 'Bengaluru, Karnataka, India',
            country: 'India',
            emp_type_name: 'Full Time',
            experience: '4 - 8 Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Build product experiences for LG software platforms.</p>',
          },
          {
            id: 'lg-us-001',
            title: 'Product Manager',
            department_name: 'Product',
            locations: 'San Jose, California, United States',
            country: 'United States',
            emp_type_name: 'Full Time',
            experience: '8 - 12 Years',
            posted_on: '10-Jul-2026',
            jd: '<p>Shape product strategy for the US market.</p>',
          },
        ],
        job_counts: 2,
      }
    },
  })

  assert.deepEqual(requestedPages, [{ page: 1, pageSize: 10, companyId: 'a6914476a29263' }])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'LG Soft India',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: 'lg-001',
    requisitionId: null,
    sourceUrl: 'https://lgsihrms.darwinbox.in/ms/candidatev2/a6914476a29263/careers/jobDetails/lg-001',
    applyUrl: 'https://lgsihrms.darwinbox.in/ms/candidatev2/a6914476a29263/careers/jobDetails/lg-001',
    employmentType: 'Full Time',
    experienceRequired: '4 - 8 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '10-Jul-2026',
    closingDate: null,
    jobDescription: '<p>Build product experiences for LG software platforms.</p>',
    source: 'lgsoftindia',
    link: 'https://lgsihrms.darwinbox.in/ms/candidatev2/a6914476a29263/careers/jobDetails/lg-001',
    scrapedAt: '2026-07-11T00:00:00.000Z',
  })
})

