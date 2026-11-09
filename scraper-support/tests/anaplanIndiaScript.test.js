import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Anaplan</title>
    <link rel="canonical" href="https://www.anaplan.com/careers/" />
  </head>
  <body>
    <section class="cmp-pagehero hero hero--careers-hero hero--themedark">
      <h1>Join our team of innovators</h1>
      <form class="hero__content__search" action="/careers/job-listing/" method="get" role="search" name="Search form">
        <button type="submit">See All Jobs</button>
      </form>
      <a href="https://www.anaplan.com/careers/job-listing/?country=Australia%2CIndia%2CIndonesia%2CJapan%2CPhilippines%2CSingapore">APAC</a>
    </section>
  </body>
</html>
`

const jobListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | Anaplan Careers</title>
  </head>
  <body>
    <div
      class="cmp-greenhousejobfilter greenhousejobfilter"
      data-edit-mode="false"
      data-component-name="Greenhouse Job Filter"
      data-job-listing-url="/careers/job-listing/"
      data-job-details-url="/careers/jobs/"
      data-result-type="job-list"
    >
      <header>
        <h1 id="job-title">Job listing</h1>
        <p id="job-location">We are transforming businesses across the globe and having fun doing it.</p>
      </header>
      <section id="search-results" class="wrapper greenhousejobfilter__job-filter">
        <aside class="greenhousejobfilter__job-filter__filters">
          <div class="item-list-title"><h3>Category</h3></div>
          <div id="category" class="item-list"></div>
          <div class="item-list-title"><h3>Country</h3></div>
          <div id="country" class="item-list"></div>
          <div class="item-list-title"><h3>City</h3></div>
          <div id="city" class="item-list"></div>
        </aside>
        <article class="greenhousejobfilter__job-filter__results">
          <div id="job-attach" class="job-list-container"></div>
          <div id="job-list-total" class="job-list-row--total">
            <p>Displaying <strong>all</strong> entries</p>
          </div>
        </article>
      </section>
    </div>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8585145002,
      title: 'Alliances Director - Managed Services Partnerships',
      location: { name: 'Mumbai, India' },
      absolute_url: 'https://job-boards.greenhouse.io/anaplan/jobs/8585145002',
      requisition_id: '103408-10000',
      company_name: 'Anaplan',
      updated_at: '2026-07-07T17:17:05-04:00',
      first_published: '2026-06-29T02:11:56-04:00',
      content: '&lt;p&gt;At Anaplan, we are a team of innovators focused on optimizing business decision-making.&lt;/p&gt;',
      departments: [{ name: 'GTM' }],
      offices: [{ location: 'India' }],
      metadata: [{ name: 'Country', value: 'India' }],
    },
    {
      id: 8388068002,
      title: 'Anaplan Model Builder',
      location: { name: 'Gurugram, India' },
      absolute_url: 'https://job-boards.greenhouse.io/anaplan/jobs/8388068002',
      requisition_id: '102201-10000',
      company_name: 'Anaplan',
      updated_at: '2026-07-09T17:17:05-04:00',
      first_published: '2026-06-30T02:11:56-04:00',
      content: '&lt;p&gt;Build and optimize enterprise planning models.&lt;/p&gt;',
      departments: [{ name: 'Business Operations' }],
      offices: [{ location: 'Gurugram, India' }],
      metadata: [{ name: 'Country', value: 'India' }],
    },
    {
      id: 7000000001,
      title: 'Accounting Analyst',
      location: { name: 'Manila, Philippines' },
      absolute_url: 'https://job-boards.greenhouse.io/anaplan/jobs/7000000001',
      requisition_id: '100000-10000',
      company_name: 'Anaplan',
      updated_at: '2026-07-08T17:17:05-04:00',
      first_published: '2026-06-28T02:11:56-04:00',
      content: '&lt;p&gt;Philippines role only.&lt;/p&gt;',
      departments: [{ name: 'Finance' }],
      offices: [{ location: 'Manila, Philippines' }],
      metadata: [{ name: 'Country', value: 'Philippines' }],
    },
  ],
}

const loadAnaplanIndiaModule = async () => {
  try {
    return await import('../../scraper/anaplanindia/script.js')
  } catch {
    assert.fail('Expected Anaplan India scraper module at ../../scraper/anaplanindia/script.js')
  }
}

test('Anaplan India verifies the official careers landing page, job-listing shell, and Greenhouse jobs API constants', async () => {
  const anaplanIndia = await loadAnaplanIndiaModule()

  assert.equal(anaplanIndia.CAREERS_URL, 'https://www.anaplan.com/careers/')
  assert.equal(anaplanIndia.JOB_LISTING_URL, 'https://www.anaplan.com/careers/job-listing/')
  assert.equal(anaplanIndia.JOB_DETAILS_BASE_URL, 'https://www.anaplan.com/careers/jobs/')
  assert.equal(
    anaplanIndia.buildGreenhouseJobsApiUrl(),
    'https://boards-api.greenhouse.io/v1/boards/anaplan/jobs?content=true',
  )
  assert.equal(anaplanIndia.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(anaplanIndia.hasVerifiedJobListingSignal(jobListingHtml), true)
  assert.equal(
    anaplanIndia.normalizeGreenhouseJobUrl(
      'https://job-boards.greenhouse.io/anaplan/jobs/8585145002',
      8585145002,
    ),
    'https://www.anaplan.com/careers/jobs/?id=8585145002',
  )
})

test('Anaplan India extracts India jobs from the verified Greenhouse payload and canonicalizes them to first-party job detail URLs', async () => {
  const anaplanIndia = await loadAnaplanIndiaModule()

  const jobs = anaplanIndia.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      link: job.link,
      applyUrl: job.applyUrl,
      department: job.department,
    })),
    [
      {
        title: 'Alliances Director - Managed Services Partnerships',
        location: 'Mumbai, India',
        city: 'Mumbai',
        country: 'India',
        link: 'https://www.anaplan.com/careers/jobs/?id=8585145002',
        applyUrl: 'https://job-boards.greenhouse.io/anaplan/jobs/8585145002#application',
        department: 'GTM',
      },
      {
        title: 'Anaplan Model Builder',
        location: 'Gurugram, India',
        city: 'Gurgaon',
        country: 'India',
        link: 'https://www.anaplan.com/careers/jobs/?id=8388068002',
        applyUrl: 'https://job-boards.greenhouse.io/anaplan/jobs/8388068002#application',
        department: 'Business Operations',
      },
    ],
  )
  assert.equal(jobs[0].source, 'anaplanindia')
  assert.match(jobs[0].jobDescription, /team of innovators/i)
})

test('run validates the official careers pages before fetching the Greenhouse jobs API', async () => {
  const anaplanIndia = await loadAnaplanIndiaModule()
  const requested = []

  const jobs = await anaplanIndia.createAnaplanIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === anaplanIndia.CAREERS_URL) return officialCareersHtml
      if (url === anaplanIndia.JOB_LISTING_URL) return jobListingHtml
      throw new Error(`Unexpected Anaplan India fixture URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return greenhousePayload
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'text', url: anaplanIndia.CAREERS_URL },
    { type: 'text', url: anaplanIndia.JOB_LISTING_URL },
    {
      type: 'json',
      url: 'https://boards-api.greenhouse.io/v1/boards/anaplan/jobs?content=true',
      options: { method: 'GET' },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'anaplanindia')
  assert.equal(jobs[0].link, 'https://www.anaplan.com/careers/jobs/?id=8585145002')
})

test('run fails closed when the verified Anaplan careers or job-listing surface drifts materially', async () => {
  const anaplanIndia = await loadAnaplanIndiaModule()

  await assert.rejects(
    anaplanIndia.createAnaplanIndiaScraper().run({
      fetchText: async (url) => {
        if (url === anaplanIndia.CAREERS_URL) {
          return officialCareersHtml.replace('See All Jobs', 'Browse Roles')
        }
        throw new Error(`Unexpected Anaplan India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Anaplan careers landing page/i,
  )

  await assert.rejects(
    anaplanIndia.createAnaplanIndiaScraper().run({
      fetchText: async (url) => {
        if (url === anaplanIndia.CAREERS_URL) return officialCareersHtml
        if (url === anaplanIndia.JOB_LISTING_URL) {
          return jobListingHtml.replace('data-job-details-url="/careers/jobs/"', 'data-job-details-url="/careers/job/"')
        }
        throw new Error(`Unexpected Anaplan India fixture URL: ${url}`)
      },
      fetchJson: async () => greenhousePayload,
    }),
    /verified Anaplan job-listing page/i,
  )
})
