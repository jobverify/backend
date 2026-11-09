import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const loadAryakaModule = async () => {
  try {
    return await import('../../scraper/aryaka/script.js')
  } catch {
    assert.fail('Expected Aryaka scraper module at ../../scraper/aryaka/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aryaka Unified SASE: Secure Network Access With Agility And Performance</title>
  </head>
  <body>
    <nav>
      <a href="https://www.aryaka.com/company/about-us/">About Us</a>
      <a href="https://jobs.jobvite.com/aryaka">Careers</a>
      <a href="https://www.aryaka.com/contact-us/">Contact Us</a>
    </nav>
    <main>
      <h1>Aryaka is built to win in the age of AI</h1>
      <p>Unified SASE as a Service</p>
      <p>We are the only solution that delivers performance, agility, simplicity, and security without tradeoffs.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Check out our current openings!</h1>
      <p>Join our journey to simplify networking and security.</p>
      <a href="#joblist">View Open Positions</a>
      <p>Powered by Jobvite</p>
    </main>
  </body>
</html>
`

const listingsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Check out our current openings!</h1>
      <h2>Featured Jobs</h2>
      <section class="category">
        <h3>410-Engineering</h3>
        <ul class="jv-job-list">
          <li>
            <a class="flex-row" href="/aryaka/job/oData123">
              <div class="jv-job-list-name">Data Engineer</div>
              <div class="jv-job-list-location">Bengaluru, Karnataka</div>
            </a>
          </li>
          <li>
            <a class="flex-row" href="/aryaka/job/oPlat456">
              <div class="jv-job-list-name">Platform Engineer</div>
              <div class="jv-job-list-location">Bengaluru, Karnataka</div>
            </a>
          </li>
          <li>
            <a class="flex-row" href="/aryaka/job/oIgnore999">
              <div class="jv-job-list-name">Senior Product Manager</div>
              <div class="jv-job-list-location">San Mateo, California</div>
            </a>
          </li>
        </ul>
      </section>
      <p>Powered by Jobvite</p>
      <p>Join us on our journey and contribute to our amazing mission to change how enterprises consume network and security services.</p>
    </main>
  </body>
</html>
`

const dataEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Data Engineer</h2>
      <p class="job-meta">410-Engineering Bengaluru, Karnataka</p>
      <a href="/aryaka/job/oData123/apply">Apply</a>
      <h3>Description</h3>
      <p>Build and maintain analytics pipelines for enterprise networking data.</p>
      <p>3-5 years of experience with Python, SQL, and distributed systems is preferred.</p>
      <ul>
        <li>Design resilient ETL workflows.</li>
        <li>Own warehouse modeling and data quality checks.</li>
      </ul>
      <p>Powered by Jobvite</p>
    </main>
  </body>
</html>
`

const platformEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Platform Engineer</h2>
      <p class="job-meta">410-Engineering Bengaluru, Karnataka</p>
      <a href="/aryaka/job/oPlat456/apply">Apply</a>
      <h3>Description</h3>
      <p>Help scale the internal platform used across Aryaka engineering teams.</p>
      <p>5+ years building cloud infrastructure and CI/CD systems is preferred.</p>
      <ul>
        <li>Automate Kubernetes platform operations.</li>
        <li>Improve developer release workflows and observability.</li>
      </ul>
      <p>Powered by Jobvite</p>
    </main>
  </body>
</html>
`

test('Aryaka pins the verified first-party homepage, careers page, and Jobvite listings board contract', async () => {
  const aryaka = await loadAryakaModule()

  assert.equal(aryaka.SOURCE, 'aryaka')
  assert.equal(aryaka.COMPANY, 'Aryaka')
  assert.equal(aryaka.HOMEPAGE_URL, 'https://www.aryaka.com/')
  assert.equal(aryaka.CAREERS_URL, 'https://www.aryaka.com/careers/')
  assert.equal(aryaka.JOBVITE_HOME_URL, 'https://jobs.jobvite.com/aryaka')
  assert.equal(aryaka.JOB_LISTINGS_URL, 'https://jobs.jobvite.com/aryaka/jobs/viewall')
  assert.equal(aryaka.DETAIL_URL_PATTERN, 'https://jobs.jobvite.com/aryaka/job/{jobvite_id}')
  assert.equal(aryaka.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aryaka.extractJobviteHomeUrl(homepageHtml), aryaka.JOBVITE_HOME_URL)
  assert.equal(aryaka.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(aryaka.extractJobListingsUrl(careersHtml), aryaka.JOB_LISTINGS_URL)
  assert.equal(aryaka.hasOfficialJobListingsSignal(listingsHtml), true)
  assert.deepEqual(aryaka.extractJobListings(listingsHtml), [
    {
      title: 'Data Engineer',
      department: '410-Engineering',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      detailUrl: 'https://jobs.jobvite.com/aryaka/job/oData123',
      jobId: 'oData123',
      requisitionId: 'oData123',
    },
    {
      title: 'Platform Engineer',
      department: '410-Engineering',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      detailUrl: 'https://jobs.jobvite.com/aryaka/job/oPlat456',
      jobId: 'oPlat456',
      requisitionId: 'oPlat456',
    },
  ])
})

test('Aryaka extracts Jobvite detail pages into the shared job shape', async () => {
  const aryaka = await loadAryakaModule()
  const listing = aryaka.extractJobListings(listingsHtml)[0]
  const detail = aryaka.extractJobDetail(dataEngineerDetailHtml, listing)

  assert.deepEqual(detail, {
    title: 'Data Engineer',
    company: 'Aryaka',
    department: '410-Engineering',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'oData123',
    requisitionId: 'oData123',
    sourceUrl: 'https://jobs.jobvite.com/aryaka/job/oData123',
    applyUrl: 'https://jobs.jobvite.com/aryaka/job/oData123',
    employmentType: null,
    experienceRequired: '3-5 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Design resilient ETL workflows.',
      'Own warehouse modeling and data quality checks.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Build and maintain analytics pipelines for enterprise networking data. 3-5 years of experience with Python, SQL, and distributed systems is preferred. Design resilient ETL workflows. Own warehouse modeling and data quality checks.',
  })
})

test('Aryaka run validates the verified handoff and returns only India Jobvite roles', async () => {
  const aryaka = await loadAryakaModule()
  const requestedUrls = []

  const jobs = await aryaka.createAryakaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === aryaka.HOMEPAGE_URL) return homepageHtml
      if (url === aryaka.CAREERS_URL) return careersHtml
      if (url === aryaka.JOB_LISTINGS_URL) return listingsHtml
      if (url === 'https://jobs.jobvite.com/aryaka/job/oData123') return dataEngineerDetailHtml
      if (url === 'https://jobs.jobvite.com/aryaka/job/oPlat456') return platformEngineerDetailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aryaka.HOMEPAGE_URL,
    aryaka.CAREERS_URL,
    aryaka.JOB_LISTINGS_URL,
    'https://jobs.jobvite.com/aryaka/job/oData123',
    'https://jobs.jobvite.com/aryaka/job/oPlat456',
  ])

  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.city, job.source, job.link, job.scrapedAt]),
    [
      [
        'Data Engineer',
        '410-Engineering',
        'Bangalore',
        'aryaka',
        'https://jobs.jobvite.com/aryaka/job/oData123',
        FIXED_SCRAPED_AT,
      ],
      [
        'Platform Engineer',
        '410-Engineering',
        'Bangalore',
        'aryaka',
        'https://jobs.jobvite.com/aryaka/job/oPlat456',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.equal(jobs[0].experienceRequired, '3-5 years')
  assert.equal(jobs[1].experienceRequired, '5+ years')
})

test('Aryaka fails closed when the homepage, careers page, or Jobvite listings surface drifts', async () => {
  const aryaka = await loadAryakaModule()

  await assert.rejects(
    aryaka.createAryakaScraper().run({
      fetchText: async () => '<html><body><h1>Aryaka</h1></body></html>',
    }),
    /official homepage/i,
  )

  await assert.rejects(
    aryaka.createAryakaScraper().run({
      fetchText: async (url) => {
        if (url === aryaka.HOMEPAGE_URL) return homepageHtml
        if (url === aryaka.CAREERS_URL) {
          return careersHtml
            .replace('https://jobs.jobvite.com/aryaka/jobs/viewall', 'https://example.com/jobs')
            .replace('View Open Positions', 'Explore Teams')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    aryaka.createAryakaScraper().run({
      fetchText: async (url) => {
        if (url === aryaka.HOMEPAGE_URL) return homepageHtml
        if (url === aryaka.CAREERS_URL) return careersHtml
        if (url === aryaka.JOB_LISTINGS_URL) return '<html><body><h1>Jobs</h1></body></html>'

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Jobvite listings board/i,
  )
})
