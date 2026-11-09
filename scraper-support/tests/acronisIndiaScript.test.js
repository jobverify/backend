import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T00:00:00.000Z'

const loadAcronisIndiaModule = async () => {
  try {
    return await import('../../scraper/acronisindia.workday/script.js')
  } catch {
    return null
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Acronis</title>
  </head>
  <body>
    <main>
      <h1>Careers at Acronis</h1>
      <p>In a phase of rapid-growth, there's a variety of exciting and challenging career opportunities. Explore open jobs worldwide.</p>
      <a href="/en/careers/jobs/" title="Explore Jobs">Explore Jobs</a>
      <a href="/en/careers/culture/" title="Our Culture">Our Culture</a>
    </main>
  </body>
</html>
`

const indiaRole = {
  originalId: 'R-101075',
  normalizedId: 'r-101075',
  id: '218c8822144210020fa287b068f50000',
  title: 'Go-To-Market Program Enablement Analyst',
  jobDescription:
    "Acronis is a global leader in cyber protection.<ul><li>Partner with field teams across India.</li><li>Coordinate enablement programs.</li></ul><p>Experience in program management or enablement for 5+ years is preferred.</p>",
  timeType: { descriptor: 'Full time' },
  primaryLocation: {
    descriptor: 'India - Remote',
    country: {
      descriptor: 'India',
      alpha3Code: 'IND',
    },
  },
  additionalLocations: [],
  categories: [
    { descriptor: 'Business Systems' },
  ],
  startDate: '2026-04-17',
  url: 'https://acronis.wd502.myworkdayjobs.com/acronis_careers/job/India---Remote/Go-To-Market-Program-Enablement-Analyst_R-101075',
  spotlightJob: false,
}

const singaporeRole = {
  originalId: 'R-100986-1',
  normalizedId: 'r-100986-1',
  id: 'd4df52c8c30710026a3428fcabb00000',
  title: 'Machine Learning Intern',
  jobDescription: '<p>Work on applied research projects.</p>',
  timeType: { descriptor: 'Internship' },
  primaryLocation: {
    descriptor: 'Singapore',
    country: {
      descriptor: 'Singapore',
      alpha3Code: 'SGP',
    },
  },
  additionalLocations: [],
  categories: [
    { descriptor: 'Machine Learning' },
  ],
  startDate: '2026-06-30',
  url: 'https://acronis.wd502.myworkdayjobs.com/acronis_careers/job/Singapore/Machine-Learning-Intern_R-100986-1',
  spotlightJob: false,
}

const buildJobsHtml = (items) => `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Jobs - Careers at Acronis</title>
  </head>
  <body>
    <script type="text/json" id="pocket-public_context">
      {"env":{"HEAD_SITE_MAIN_PUBLIC_BASE_URL_WORKDAY":"https://services1.wd502.myworkday.com"}}
    </script>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting"}
    </script>
    <script>
      window.__ACRONIS_PAGE__ = {"workday":{"items":${JSON.stringify(items)}}}
    </script>
    <main>
      <h1>Explore Jobs</h1>
      <p>Acronis open roles worldwide.</p>
    </main>
  </body>
</html>
`

const emptyJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Jobs – Careers at Acronis</title>
  </head>
  <body>
    <script type="text/json" id="pocket-public_context">
      {"env":{"HEAD_SITE_MAIN_PUBLIC_BASE_URL_WORKDAY":"https://services1.wd502.myworkday.com"}}
    </script>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting"}
    </script>
    <script>
      window.__ACRONIS_PAGE__ = {"workday":{"items":[]}}
    </script>
    <main>
      <h1>Explore Jobs</h1>
      <p>Acronis open roles worldwide.</p>
    </main>
  </body>
</html>
`

test('Acronis India validates the verified Acronis careers pages and extracts India jobs from embedded Workday items', async () => {
  const acronis = await loadAcronisIndiaModule()

  assert.ok(
    acronis,
    'Expected Acronis India scraper module at ../../scraper/acronisindia.workday/script.js',
  )

  const jobsHtml = buildJobsHtml([indiaRole, singaporeRole])

  assert.equal(acronis.SOURCE, 'acronisindia')
  assert.equal(acronis.COMPANY, 'Acronis India')
  assert.equal(acronis.OFFICIAL_BRAND_NAME, 'Acronis')
  assert.equal(acronis.VERIFIED_AT, '2026-07-14')
  assert.equal(acronis.CAREERS_URL, 'https://www.acronis.com/en/careers/')
  assert.equal(acronis.JOBS_URL, 'https://www.acronis.com/en/careers/jobs/')
  assert.equal(
    acronis.WORKDAY_DETAIL_BASE_URL,
    'https://acronis.wd502.myworkdayjobs.com/acronis_careers/',
  )
  assert.equal(acronis.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(acronis.hasOfficialJobsPageSignal(jobsHtml), true)

  const items = acronis.extractEmbeddedWorkdayItems(jobsHtml)
  assert.equal(items.length, 2)

  assert.deepEqual(acronis.extractIndiaJobsFromWorkdayItems(items), [
    {
      title: 'Go-To-Market Program Enablement Analyst',
      company: 'Acronis India',
      department: 'Business Systems',
      location: 'India - Remote',
      city: 'Remote',
      country: 'India',
      sourceUrl:
        'https://acronis.wd502.myworkdayjobs.com/acronis_careers/job/India---Remote/Go-To-Market-Program-Enablement-Analyst_R-101075',
      applyUrl:
        'https://acronis.wd502.myworkdayjobs.com/acronis_careers/job/India---Remote/Go-To-Market-Program-Enablement-Analyst_R-101075/apply',
      jobId: 'R-101075',
      requisitionId: 'R-101075',
      employmentType: 'Full time',
      experienceRequired: '5+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Partner with field teams across India.',
        'Coordinate enablement programs.',
      ],
      postingDate: '2026-04-17',
      closingDate: null,
      jobDescription:
        'Acronis is a global leader in cyber protection. Partner with field teams across India. Coordinate enablement programs. Experience in program management or enablement for 5+ years is preferred.',
    },
  ])
})

test('Acronis India run validates the verified first-party pages and returns only India jobs', async () => {
  const acronis = await loadAcronisIndiaModule()
  assert.ok(acronis)

  const jobsHtml = buildJobsHtml([indiaRole, singaporeRole])
  const requestedUrls = []
  const jobs = await acronis.createAcronisIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === acronis.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === acronis.JOBS_URL) {
        return { status: 200, url, html: jobsHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    acronis.CAREERS_URL,
    acronis.JOBS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.source, job.link, job.scrapedAt]),
    [[
      'Go-To-Market Program Enablement Analyst',
      'acronisindia',
      'https://acronis.wd502.myworkdayjobs.com/acronis_careers/job/India---Remote/Go-To-Market-Program-Enablement-Analyst_R-101075',
      FIXED_SCRAPED_AT,
    ]],
  )
})

test('Acronis India returns [] when the verified public jobs surface has no current India openings', async () => {
  const acronis = await loadAcronisIndiaModule()
  assert.ok(acronis)

  const jobs = await acronis.createAcronisIndiaScraper().run({
    fetchPage: async (url) => {
      if (url === acronis.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === acronis.JOBS_URL) {
        return { status: 200, url, html: buildJobsHtml([singaporeRole]) }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Acronis India accepts the current official jobs page when Workday exposes an explicit empty items array', async () => {
  const acronis = await loadAcronisIndiaModule()
  assert.ok(acronis)

  assert.equal(acronis.hasOfficialJobsPageSignal(emptyJobsHtml), true)

  const jobs = await acronis.createAcronisIndiaScraper().run({
    fetchPage: async (url) => {
      if (url === acronis.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === acronis.JOBS_URL) {
        return { status: 200, url, html: emptyJobsHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Acronis India fails closed when the verified careers landing or first-party jobs page drifts', async () => {
  const acronis = await loadAcronisIndiaModule()
  assert.ok(acronis)

  await assert.rejects(
    acronis.createAcronisIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === acronis.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Acronis</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers landing/i,
  )

  await assert.rejects(
    acronis.createAcronisIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === acronis.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === acronis.JOBS_URL) {
          return { status: 200, url, html: '<html><body><h1>Jobs</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party jobs page/i,
  )
})
