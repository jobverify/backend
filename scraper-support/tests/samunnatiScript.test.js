import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home - Samunnati - India's Largest Agri Enterprise</title>
  </head>
  <body>
    <nav>
      <a href="https://samunnati.darwinbox.in/ms/candidate/careers">Careers</a>
    </nav>
    <main>
      <p>India's Agri Enterprise</p>
      <p>Work with us.</p>
      <p>Write to us at careers@samunnati.com</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Samunnati - India's Largest Agri Enterprise</title>
  </head>
  <body>
    <nav>
      <a href="https://samunnati.darwinbox.in/ms/candidate/careers">Careers</a>
    </nav>
    <main>
      <p>Samunnati 2.0</p>
      <p>Join the Movement: Empowering Growth with Samunnati</p>
      <p>Write to us at careers@samunnati.com</p>
    </main>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home - Samunnati - India’s Largest Agri Enterprise</title>
  </head>
  <body>
    <nav>
      <a href="https://samunnati.darwinbox.in/ms/candidate/careers">Careers</a>
    </nav>
    <main>
      <p>Work with us.</p>
      <p>Write to us at careers@samunnati.com</p>
    </main>
  </body>
</html>
`

const currentAboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Samunnati - India’s Largest Agri Enterprise</title>
  </head>
  <body>
    <nav>
      <a href="https://samunnati.darwinbox.in/ms/candidate/careers">Careers</a>
    </nav>
    <main>
      <p>Samunnati 2.0</p>
      <p>Join the Movement: Empowering Growth with Samunnati</p>
      <p>Write to us at careers@samunnati.com</p>
    </main>
  </body>
</html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'sam-001',
      title: 'Assistant Manager - Product',
      department_name: 'Product',
      locations: 'Bangalore, Karnataka, India',
      country: 'India',
      emp_type_name: 'Full Time',
      experience: '4 - 7 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Build digital products for the agri value chain.</p>',
    },
    {
      id: 'sam-sg-001',
      title: 'Regional Partnerships Lead',
      department_name: 'Partnerships',
      locations: 'Singapore',
      country: 'Singapore',
      emp_type_name: 'Full Time',
      experience: '8 - 10 Years',
      posted_on: '17-Jul-2026',
      jd: '<p>Ignore non-India role.</p>',
    },
  ],
}

const loadSamunnatiModule = async () => {
  try {
    return await import('../../scraper/samunnati/script.js')
  } catch {
    assert.fail('Expected Samunnati scraper module at ../../scraper/samunnati/script.js')
  }
}

test('Samunnati scraper keeps the verified first-party Darwinbox handoff explicit and only decorates India jobs', async () => {
  const samunnati = await loadSamunnatiModule()

  assert.equal(samunnati.COMPANY_NAME, 'Samunnati')
  assert.equal(samunnati.SOURCE, 'samunnati')
  assert.equal(samunnati.DARWINBOX_COMPANY_ID, 'main')
  assert.equal(samunnati.DARWINBOX_ORIGIN, 'https://samunnati.darwinbox.in')
  assert.equal(samunnati.OFFICIAL_SITE_URL, 'https://samunnati.com/')
  assert.equal(samunnati.OFFICIAL_ABOUT_URL, 'https://samunnati.com/about-us-sam/')
  assert.equal(
    samunnati.OFFICIAL_CAREERS_HANDOFF_URL,
    'https://samunnati.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(
    samunnati.PUBLIC_PORTAL_URL,
    'https://samunnati.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    samunnati.extractOfficialDarwinboxUrl(homepageHtml),
    samunnati.OFFICIAL_CAREERS_HANDOFF_URL,
  )
  assert.equal(samunnati.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(samunnati.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(samunnati.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(samunnati.hasOfficialAboutSignal(currentAboutHtml), true)

  const scraper = samunnati.createSamunnatiScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(
    scraper.buildCareersPageUrl(),
    'https://samunnati.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    scraper.buildListingApiUrl(),
    'https://samunnati.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    scraper.buildJobDetailUrl('sam-001'),
    'https://samunnati.darwinbox.in/ms/candidatev2/main/careers/jobDetails/sam-001',
  )
})

test('run maps verified Samunnati Darwinbox listings into Jobverify jobs and keeps only India roles', async () => {
  const { createSamunnatiScraper } = await loadSamunnatiModule()
  const scraper = createSamunnatiScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedPages = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === 'https://samunnati.com/') return homepageHtml
      if (url === 'https://samunnati.com/about-us-sam/') return aboutHtml
      throw new Error(`Unexpected Samunnati text URL: ${url}`)
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)
      return listingPayload
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.deepEqual(jobs, [
    {
      title: 'Assistant Manager - Product',
      company: 'Samunnati',
      department: 'Product',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      jobId: 'sam-001',
      requisitionId: null,
      sourceUrl: 'https://samunnati.darwinbox.in/ms/candidatev2/main/careers/jobDetails/sam-001',
      applyUrl: 'https://samunnati.darwinbox.in/ms/candidatev2/main/careers/jobDetails/sam-001',
      employmentType: 'Full Time',
      experienceRequired: '4 - 7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '17-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Build digital products for the agri value chain.</p>',
      source: 'samunnati',
      link: 'https://samunnati.darwinbox.in/ms/candidatev2/main/careers/jobDetails/sam-001',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Samunnati fails closed when the verified homepage or about-page handoff drifts', async () => {
  const { createSamunnatiScraper } = await loadSamunnatiModule()
  const scraper = createSamunnatiScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === 'https://samunnati.com/') return '<html><body>broken</body></html>'
        if (url === 'https://samunnati.com/about-us-sam/') return aboutHtml
        throw new Error(`Unexpected Samunnati text URL: ${url}`)
      },
      fetchListingPage: async () => listingPayload,
    }),
    /homepage/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === 'https://samunnati.com/') return homepageHtml
        if (url === 'https://samunnati.com/about-us-sam/') {
          return aboutHtml.replace(
            'https://samunnati.darwinbox.in/ms/candidate/careers',
            'https://example.com/jobs',
          )
        }
        throw new Error(`Unexpected Samunnati text URL: ${url}`)
      },
      fetchListingPage: async () => listingPayload,
    }),
    /about page/i,
  )
})
