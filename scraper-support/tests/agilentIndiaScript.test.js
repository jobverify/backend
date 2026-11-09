import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T00:00:00.000Z'

const loadAgilentIndiaModule = async () => {
  try {
    return await import('../../scraper/agilentindia.workday/script.js')
  } catch {
    return null
  }
}

const careersHomeHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Agilent Careers Home</title>
  </head>
  <body>
    <h1>Careers Home</h1>
    <p>Find the right opportunity for you at Agilent.</p>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Careers">Search Experienced Jobs</a>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers">Search Grad &amp; Student Jobs</a>
    <a href="/locations/asia-pacific/india/">India</a>
  </body>
</html>
`

const currentCareersHomeHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Agilent Careers</title>
  </head>
  <body>
    <h1>Careers Home</h1>
    <p>Join a truly global team, united by a singular passion.</p>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers">Search Grad &amp; Student Jobs</a>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Careers">Search Experienced Jobs</a>
  </body>
</html>
`

const indiaLocationHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Agilent Careers India</title>
  </head>
  <body>
    <h1>India</h1>
    <p>With over 1,500 employees spread over nine locations, Agilent India is one of Agilent's largest global centers of excellence.</p>
    <p>Our Indian business offers roles across engineering, manufacturing, software, sales, and business operations.</p>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Careers">Search Experienced Jobs</a>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers">Search Grad &amp; Student Jobs</a>
  </body>
</html>
`

const currentIndiaLocationHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Agilent Careers | India</title>
  </head>
  <body>
    <h1>Agilent Careers India</h1>
    <p>With over 1,500 employees, spread across nine locations, our India team supports Agilent's global operations across different business areas.</p>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Careers?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e">Search Experienced Jobs</a>
    <a href="https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e">Search Grad &amp; Student Jobs</a>
  </body>
</html>
`

const workdayMaintenanceHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Workday is currently unavailable.</title>
  </head>
  <body>
    <main>
      <h1>Workday is currently unavailable.</h1>
      <p>Workday is performing planned maintenance during the following period:</p>
      <p>We apologize for the inconvenience.</p>
      <p>If you are a Workday customer and require additional assistance please contact the Workday Administrator within your organization.</p>
    </main>
  </body>
</html>
`

test('Agilent India validates the verified first-party careers pages and derives the dual Workday India APIs', async () => {
  const agilent = await loadAgilentIndiaModule()

  assert.ok(
    agilent,
    'Expected Agilent India scraper module at ../../scraper/agilentindia.workday/script.js',
  )

  assert.equal(agilent.SOURCE, 'agilentindia')
  assert.equal(agilent.COMPANY, 'Agilent India')
  assert.equal(agilent.OFFICIAL_BRAND_NAME, 'Agilent')
  assert.equal(agilent.VERIFIED_AT, '2026-08-15')
  assert.equal(agilent.CAREERS_HOME_URL, 'https://careers.agilent.com/')
  assert.equal(
    agilent.INDIA_LOCATION_URL,
    'https://careers.agilent.com/locations/asia-pacific/india/',
  )
  assert.equal(
    agilent.EXPERIENCED_WORKDAY_PAGE,
    'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers',
  )
  assert.equal(
    agilent.STUDENT_WORKDAY_PAGE,
    'https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers',
  )
  assert.equal(
    agilent.EXPERIENCED_JOBS_API_URL,
    'https://agilent.wd5.myworkdayjobs.com/wday/cxs/agilent/Agilent_Careers/jobs',
  )
  assert.equal(
    agilent.STUDENT_JOBS_API_URL,
    'https://agilent.wd5.myworkdayjobs.com/wday/cxs/agilent/Agilent_Student_Careers/jobs',
  )
  assert.equal(agilent.INDIA_COUNTRY_FACET_ID, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(agilent.hasOfficialCareersHomeSignal(careersHomeHtml), true)
  assert.equal(agilent.hasOfficialCareersHomeSignal(currentCareersHomeHtml), true)
  assert.equal(agilent.hasOfficialIndiaLocationSignal(indiaLocationHtml), true)
  assert.equal(agilent.hasOfficialIndiaLocationSignal(currentIndiaLocationHtml), true)
  assert.equal(agilent.hasWorkdayMaintenanceSignal(workdayMaintenanceHtml), true)
  assert.equal(
    agilent.extractExperiencedWorkdayUrl(careersHomeHtml),
    agilent.EXPERIENCED_WORKDAY_PAGE,
  )
  assert.equal(
    agilent.extractStudentWorkdayUrl(careersHomeHtml),
    agilent.STUDENT_WORKDAY_PAGE,
  )
  assert.equal(
    agilent.extractExperiencedWorkdayUrl(indiaLocationHtml),
    agilent.EXPERIENCED_WORKDAY_PAGE,
  )
  assert.equal(
    agilent.extractStudentWorkdayUrl(indiaLocationHtml),
    agilent.STUDENT_WORKDAY_PAGE,
  )
  assert.equal(
    agilent.buildJobsApiUrl(agilent.EXPERIENCED_WORKDAY_PAGE),
    agilent.EXPERIENCED_JOBS_API_URL,
  )
  assert.equal(
    agilent.buildJobsApiUrl(agilent.STUDENT_WORKDAY_PAGE),
    agilent.STUDENT_JOBS_API_URL,
  )
  assert.deepEqual(agilent.buildJobsApiRequest(20, 10), {
    appliedFacets: {
      locationCountry: ['c4f78be1a8f14da0ab49ce1162348a5e'],
    },
    limit: 10,
    offset: 20,
    searchText: '',
  })
})

test('Agilent India run validates the first-party pages and returns India jobs from both official Workday boards', async () => {
  const agilent = await loadAgilentIndiaModule()
  assert.ok(agilent)

  const requests = {
    pages: [],
    jobsApi: [],
  }

  const jobs = await agilent.createAgilentIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
    pageSize: 2,
  }).run({
    fetchPage: async (url) => {
      requests.pages.push(url)

      if (url === agilent.CAREERS_HOME_URL) {
        return { status: 200, url, html: careersHomeHtml }
      }

      if (url === agilent.INDIA_LOCATION_URL) {
        return { status: 200, url, html: indiaLocationHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options) => {
      requests.jobsApi.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      if (url === agilent.EXPERIENCED_JOBS_API_URL) {
        return {
          total: 2,
          jobPostings: [
            {
              title: 'Field Service Engineer',
              externalPath: '/job/Bangalore-India/Field-Service-Engineer_402847',
              locationsText: 'Bangalore, India',
              postedOn: 'Posted Today',
              bulletFields: ['402847'],
              timeType: 'Full time',
            },
            {
              title: 'Inside Sales Specialist',
              externalPath: '/job/Santa-Clara-United-States/Inside-Sales-Specialist_402848',
              locationsText: 'Santa Clara, United States',
              postedOn: 'Posted Today',
              bulletFields: ['402848'],
              timeType: 'Full time',
            },
          ],
        }
      }

      if (url === agilent.STUDENT_JOBS_API_URL) {
        return {
          total: 1,
          jobPostings: [
            {
              title: 'Manufacturing Intern',
              externalPath: '/job/Manesar-India/Manufacturing-Intern_402901',
              locationsText: 'Manesar, India',
              postedOn: 'Posted Yesterday',
              bulletFields: ['402901'],
              timeType: { descriptor: 'Internship' },
            },
          ],
        }
      }

      throw new Error(`Unexpected jobs API URL: ${url}`)
    },
  })

  assert.deepEqual(requests.pages, [
    agilent.CAREERS_HOME_URL,
    agilent.INDIA_LOCATION_URL,
  ])
  assert.deepEqual(requests.jobsApi, [
    {
      url: agilent.EXPERIENCED_JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: [agilent.INDIA_COUNTRY_FACET_ID],
        },
        limit: 2,
        offset: 0,
        searchText: '',
      },
    },
    {
      url: agilent.STUDENT_JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: [agilent.INDIA_COUNTRY_FACET_ID],
        },
        limit: 2,
        offset: 0,
        searchText: '',
      },
    },
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      employmentType: job.employmentType,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Field Service Engineer',
        company: 'Agilent India',
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '402847',
        requisitionId: '402847',
        employmentType: 'Full time',
        sourceUrl: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers/job/Bangalore-India/Field-Service-Engineer_402847',
        applyUrl: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers/job/Bangalore-India/Field-Service-Engineer_402847/apply',
        source: 'agilentindia',
        link: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Careers/job/Bangalore-India/Field-Service-Engineer_402847/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Manufacturing Intern',
        company: 'Agilent India',
        location: 'Manesar, India',
        city: 'Manesar',
        country: 'India',
        jobId: '402901',
        requisitionId: '402901',
        employmentType: 'Internship',
        sourceUrl: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers/job/Manesar-India/Manufacturing-Intern_402901',
        applyUrl: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers/job/Manesar-India/Manufacturing-Intern_402901/apply',
        source: 'agilentindia',
        link: 'https://agilent.wd5.myworkdayjobs.com/Agilent_Student_Careers/job/Manesar-India/Manufacturing-Intern_402901/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Agilent India returns [] while both official Workday boards are on the verified maintenance page', async () => {
  const agilent = await loadAgilentIndiaModule()
  assert.ok(agilent)

  const requests = {
    pages: [],
    jobsApi: [],
  }

  const jobs = await agilent.createAgilentIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requests.pages.push(url)

      if (url === agilent.CAREERS_HOME_URL) {
        return { status: 200, url, html: currentCareersHomeHtml }
      }

      if (url === agilent.INDIA_LOCATION_URL) {
        return { status: 200, url, html: currentIndiaLocationHtml }
      }

      if (url === agilent.EXPERIENCED_WORKDAY_PAGE || url === agilent.STUDENT_WORKDAY_PAGE) {
        return {
          status: 200,
          url: 'https://community.workday.com/maintenance-page?d=5&s=1&e=1&o=',
          html: workdayMaintenanceHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options) => {
      requests.jobsApi.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      throw new Error(`Expected JSON from ${url} but received HTML (Workday is currently unavailable.)`)
    },
  })

  assert.deepEqual(requests.pages, [
    agilent.CAREERS_HOME_URL,
    agilent.INDIA_LOCATION_URL,
    agilent.EXPERIENCED_WORKDAY_PAGE,
    agilent.STUDENT_WORKDAY_PAGE,
  ])
  assert.deepEqual(requests.jobsApi, [
    {
      url: agilent.EXPERIENCED_JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: [agilent.INDIA_COUNTRY_FACET_ID],
        },
        limit: 20,
        offset: 0,
        searchText: '',
      },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('Agilent India can preserve the verified Workday maintenance sentinel when the first-party Agilent careers pages are timeout-blocked', async () => {
  const agilent = await loadAgilentIndiaModule()
  assert.ok(agilent)

  const requests = {
    pages: [],
    jobsApi: [],
  }

  const jobs = await agilent.createAgilentIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requests.pages.push(url)

      if (url === agilent.CAREERS_HOME_URL || url === agilent.INDIA_LOCATION_URL) {
        throw new Error('fetch failed | Connect Timeout Error (attempted addresses: 99.84.152.9:443, timeout: 10000ms)')
      }

      if (url === agilent.EXPERIENCED_WORKDAY_PAGE || url === agilent.STUDENT_WORKDAY_PAGE) {
        return {
          status: 200,
          url: 'https://community.workday.com/maintenance-page?d=5&s=1&e=1&o=',
          html: workdayMaintenanceHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url, options) => {
      requests.jobsApi.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      throw new Error(`Expected JSON from ${url} but received HTML (Workday is currently unavailable.)`)
    },
  })

  assert.deepEqual(requests.pages, [
    agilent.CAREERS_HOME_URL,
    agilent.INDIA_LOCATION_URL,
    agilent.EXPERIENCED_WORKDAY_PAGE,
    agilent.STUDENT_WORKDAY_PAGE,
  ])
  assert.deepEqual(requests.jobsApi, [
    {
      url: agilent.EXPERIENCED_JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: [agilent.INDIA_COUNTRY_FACET_ID],
        },
        limit: 20,
        offset: 0,
        searchText: '',
      },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('Agilent India preserves the verified same-day maintenance sentinel when the Workday boards themselves also time out', async () => {
  const agilent = await loadAgilentIndiaModule()
  assert.ok(agilent)

  const requests = {
    pages: [],
    jobsApi: [],
  }

  const jobs = await agilent.createAgilentIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requests.pages.push(url)
      throw new Error('fetch failed | Connect Timeout Error (attempted address: agilent.wd5.myworkdayjobs.com:443, timeout: 10000ms)')
    },
    fetchJson: async (url, options) => {
      requests.jobsApi.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      throw new Error('fetch failed | Connect Timeout Error (attempted address: agilent.wd5.myworkdayjobs.com:443, timeout: 10000ms)')
    },
  })

  assert.deepEqual(requests.pages, [
    agilent.CAREERS_HOME_URL,
    agilent.INDIA_LOCATION_URL,
    agilent.EXPERIENCED_WORKDAY_PAGE,
    agilent.STUDENT_WORKDAY_PAGE,
  ])
  assert.deepEqual(requests.jobsApi, [
    {
      url: agilent.EXPERIENCED_JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {
          locationCountry: [agilent.INDIA_COUNTRY_FACET_ID],
        },
        limit: 20,
        offset: 0,
        searchText: '',
      },
    },
  ])
  assert.deepEqual(jobs, [])
})

test('Agilent India fails closed when the verified first-party careers pages drift', async () => {
  const agilent = await loadAgilentIndiaModule()
  assert.ok(agilent)

  await assert.rejects(
    agilent.createAgilentIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === agilent.CAREERS_HOME_URL) {
          return { status: 200, url, html: '<html><body><h1>Agilent</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /verified careers home/i,
  )

  await assert.rejects(
    agilent.createAgilentIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === agilent.CAREERS_HOME_URL) {
          return { status: 200, url, html: careersHomeHtml }
        }

        if (url === agilent.INDIA_LOCATION_URL) {
          return { status: 200, url, html: '<html><body><h1>India</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /verified India location page/i,
  )
})
