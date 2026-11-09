import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jade Global Careers | Find Job Opportunities</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <a href="https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers">Explore Open Positions</a>
      <section>
        <h2>Reboot Your Career</h2>
        <p>Open the door to innumerable career paths and learning opportunities.</p>
      </section>
      <section>
        <h2>Life at Jade</h2>
        <p>Today, we are at the inflection point of big breakthroughs.</p>
      </section>
    </main>
  </body>
</html>
`

const driftedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jade Global</title>
  </head>
  <body>
    <h1>About Jade Global</h1>
  </body>
</html>
`

const loadJadeGlobalModule = async () => {
  try {
    return await import('../../scraper/jadeglobal.workday/script.js')
  } catch {
    assert.fail('Expected Jade Global scraper module at ../../scraper/jadeglobal.workday/script.js')
  }
}

test('Jade Global pins the verified first-party careers page and Workday jobs API contract', async () => {
  const jadeGlobal = await loadJadeGlobalModule()

  assert.equal(jadeGlobal.SOURCE, 'jadeglobal')
  assert.equal(jadeGlobal.COMPANY_NAME, 'Jade Global')
  assert.equal(jadeGlobal.OFFICIAL_BRAND_NAME, 'Jade Global')
  assert.equal(jadeGlobal.CAREERS_URL, 'https://www.jadeglobal.com/careers')
  assert.equal(
    jadeGlobal.WORKDAY_BOARD_URL,
    'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers',
  )
  assert.equal(
    jadeGlobal.JOBS_API_URL,
    'https://jadeglobal.wd5.myworkdayjobs.com/wday/cxs/jadeglobal/Jade_Careers/jobs',
  )
  assert.equal(jadeGlobal.VERIFIED_PUBLIC_JOB_COUNT, 261)
  assert.equal(jadeGlobal.VERIFIED_ON, '2026-07-16')
  assert.equal(jadeGlobal.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(jadeGlobal.hasOfficialCareersPageSignal(driftedCareersHtml), false)
  assert.equal(
    jadeGlobal.extractWorkdayBoardUrl(officialCareersHtml),
    jadeGlobal.WORKDAY_BOARD_URL,
  )
  assert.equal(
    jadeGlobal.buildJobsApiUrl(jadeGlobal.WORKDAY_BOARD_URL),
    jadeGlobal.JOBS_API_URL,
  )
  assert.equal(
    jadeGlobal.buildJobsApiUrl('https://jadeglobal.wd5.myworkdayjobs.com/en-US/Jade_Careers'),
    jadeGlobal.JOBS_API_URL,
  )
  assert.deepEqual(jadeGlobal.buildJobsApiRequest(20, 10), {
    appliedFacets: {},
    limit: 10,
    offset: 20,
    searchText: '',
  })
})

test('Jade Global run validates the official careers page and returns normalized public Workday jobs', async () => {
  const jadeGlobal = await loadJadeGlobalModule()
  const requests = {
    pages: [],
    jobsApi: [],
  }

  const jobs = await jadeGlobal.createJadeGlobalScraper({
    now: () => FIXED_SCRAPED_AT,
    pageSize: 2,
  }).run({
    fetchText: async (url) => {
      requests.pages.push(url)
      if (url === jadeGlobal.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected Jade Global page URL: ${url}`)
    },
    fetchJson: async (url, options) => {
      requests.jobsApi.push({
        url,
        method: options.method,
        body: JSON.parse(options.body),
      })

      if (url !== jadeGlobal.JOBS_API_URL) {
        throw new Error(`Unexpected Jade Global jobs API URL: ${url}`)
      }

      const body = JSON.parse(options.body)
      if (body.offset === 0) {
        return {
          total: 3,
          jobPostings: [
            {
              title: 'Lead ServiceNow Developer',
              externalPath: '/job/San-Jose-CA/Lead-ServiceNow-Developer_R-105505',
              locationsText: 'San Jose, CA',
              bulletFields: ['R-105505'],
              timeType: 'Full time',
              postedOn: 'Posted Today',
            },
            {
              title: 'Oracle SCM Functional (Oracle Cloud SCM Expert)',
              externalPath:
                '/job/Pune-Maharashtra/Oracle-SCM-Functional--Oracle-Cloud-SCM-Expert-_R-105727',
              locationsText: '2 Locations',
              bulletFields: ['R-105727'],
              timeType: 'Full time',
              postedOn: 'Posted Yesterday',
            },
          ],
        }
      }

      if (body.offset === 2) {
        return {
          total: 3,
          jobPostings: [
            {
              title: 'Workday Extend Developer',
              externalPath: '/job/Pune-Maharashtra/Workday-Extend-Developer_R-104429',
              locationsText: 'Pune, Maharashtra',
              bulletFields: ['R-104429'],
              timeType: 'Full time',
              postedOn: 'Posted 30+ Days Ago',
            },
          ],
        }
      }

      throw new Error(`Unexpected Jade Global jobs API offset: ${body.offset}`)
    },
  })

  assert.deepEqual(requests.pages, [
    jadeGlobal.CAREERS_URL,
    'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/San-Jose-CA/Lead-ServiceNow-Developer_R-105505',
    'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Oracle-SCM-Functional--Oracle-Cloud-SCM-Expert-_R-105727',
    'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Workday-Extend-Developer_R-104429',
  ])
  assert.deepEqual(requests.jobsApi, [
    {
      url: jadeGlobal.JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {},
        limit: 2,
        offset: 0,
        searchText: '',
      },
    },
    {
      url: jadeGlobal.JOBS_API_URL,
      method: 'POST',
      body: {
        appliedFacets: {},
        limit: 2,
        offset: 2,
        searchText: '',
      },
    },
  ])

  assert.equal(jobs.length, 3)
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
      postingDate: job.postingDate,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Lead ServiceNow Developer',
        company: 'Jade Global',
        location: 'San Jose, CA',
        city: 'San Jose',
        country: 'United States',
        jobId: 'R-105505',
        requisitionId: 'R-105505',
        employmentType: 'Full time',
        postingDate: 'Posted Today',
        sourceUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/San-Jose-CA/Lead-ServiceNow-Developer_R-105505',
        applyUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/San-Jose-CA/Lead-ServiceNow-Developer_R-105505/apply',
        source: 'jadeglobal',
        link: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/San-Jose-CA/Lead-ServiceNow-Developer_R-105505/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Oracle SCM Functional (Oracle Cloud SCM Expert)',
        company: 'Jade Global',
        location: 'Pune, Maharashtra',
        city: 'Pune',
        country: 'India',
        jobId: 'R-105727',
        requisitionId: 'R-105727',
        employmentType: 'Full time',
        postingDate: 'Posted Yesterday',
        sourceUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Oracle-SCM-Functional--Oracle-Cloud-SCM-Expert-_R-105727',
        applyUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Oracle-SCM-Functional--Oracle-Cloud-SCM-Expert-_R-105727/apply',
        source: 'jadeglobal',
        link: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Oracle-SCM-Functional--Oracle-Cloud-SCM-Expert-_R-105727/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Workday Extend Developer',
        company: 'Jade Global',
        location: 'Pune, Maharashtra',
        city: 'Pune',
        country: 'India',
        jobId: 'R-104429',
        requisitionId: 'R-104429',
        employmentType: 'Full time',
        postingDate: 'Posted 30+ Days Ago',
        sourceUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Workday-Extend-Developer_R-104429',
        applyUrl: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Workday-Extend-Developer_R-104429/apply',
        source: 'jadeglobal',
        link: 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Workday-Extend-Developer_R-104429/apply',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Jade Global fails closed when the verified careers page drifts or the Workday payload breaks', async () => {
  const jadeGlobal = await loadJadeGlobalModule()

  await assert.rejects(
    jadeGlobal.createJadeGlobalScraper().run({
      fetchText: async () => driftedCareersHtml,
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    jadeGlobal.createJadeGlobalScraper().run({
      fetchText: async () => officialCareersHtml,
      fetchJson: async () => ({ total: 1, jobPostings: null }),
    }),
    /jobs api response no longer matches/i,
  )
})
