import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T06:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jade Global Careers | Find Job Opportunities</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Reboot Your Career</p>
    <p>Life at Jade</p>
    <a href="https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers">Explore Open Positions</a>
  </body>
</html>
`

const jobsPayload = {
  total: 2,
  jobPostings: [
    {
      title: 'Workday Absence & Time Tracking Consultant',
      externalPath: '/job/Bengaluru-Karnataka/Workday-Absence---Time-Tracking-Consultant_R-104548',
      locationsText: 'Bengaluru, Karnataka',
      postedOn: 'Posted 30+ Days Ago',
      bulletFields: ['R-104548'],
      timeType: 'Full time',
    },
    {
      title: 'Oracle EPM Consultant',
      externalPath: '/job/Pune-Maharashtra/Oracle-EPM-Consultant_R-105799',
      locationsText: 'Pune, Maharashtra',
      postedOn: 'Posted 10 Days Ago',
      bulletFields: ['R-105799'],
      timeType: 'Full time',
    },
  ],
}

const detailHtmlByUrl = {
  'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Bengaluru-Karnataka/Workday-Absence---Time-Tracking-Consultant_R-104548': `
<!doctype html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Workday Absence & Time Tracking Consultant",
        "datePosted": "2026-05-18",
        "identifier": { "value": "R-104548" },
        "description": "Job Description We are seeking a Workday specialist to configure absence plans and time tracking. Qualifications Must have 4 years of hands-on configuration experience in Workday Core HCM, Absence and Time Tracking."
      }
    </script>
  </head>
  <body></body>
</html>
`,
  'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers/job/Pune-Maharashtra/Oracle-EPM-Consultant_R-105799': `
<!doctype html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Oracle EPM Consultant",
        "datePosted": "2026-07-20",
        "identifier": { "value": "R-105799" },
        "description": "Job Description Support Oracle EPM implementations and reporting workflows. Responsibilities Collaborate with finance stakeholders on planning and close processes."
      }
    </script>
  </head>
  <body></body>
</html>
`,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/jadeglobal.workday/script.js')
  } catch {
    assert.fail('Expected Jade Global Workday scraper module at ../../scraper/jadeglobal.workday/script.js')
  }
}

test('Jade Global Workday helpers stay pinned to the verified first-party careers page and jobs API', async () => {
  const jade = await loadModule()

  assert.equal(jade.SOURCE, 'jadeglobal')
  assert.equal(jade.COMPANY_NAME, 'Jade Global')
  assert.equal(jade.CAREERS_URL, 'https://www.jadeglobal.com/careers')
  assert.equal(jade.WORKDAY_BOARD_URL, 'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers')
  assert.equal(
    jade.JOBS_API_URL,
    'https://jadeglobal.wd5.myworkdayjobs.com/wday/cxs/jadeglobal/Jade_Careers/jobs',
  )
  assert.equal(jade.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    jade.extractWorkdayBoardUrl(careersHtml),
    'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers',
  )
  assert.equal(
    jade.buildJobsApiUrl(jade.WORKDAY_BOARD_URL),
    jade.JOBS_API_URL,
  )
})

test('Jade Global Workday run enriches listings with public Workday detail pages', async () => {
  const jade = await loadModule()
  const requestedTexts = []
  const requestedJsonBodies = []

  const jobs = await jade.createJadeGlobalScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === jade.CAREERS_URL) return careersHtml
      if (detailHtmlByUrl[url]) return detailHtmlByUrl[url]
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      assert.equal(url, jade.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(options.body))
      return jobsPayload
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(requestedTexts[0], jade.CAREERS_URL)
  assert.deepEqual(
    requestedTexts.slice(1).sort(),
    Object.keys(detailHtmlByUrl).sort(),
  )
  assert.deepEqual(requestedJsonBodies, [
    {
      appliedFacets: {},
      limit: 20,
      offset: 0,
      searchText: '',
    },
  ])
  assert.equal(jobs[0].experienceRequired, '4 years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].postingDate, '2026-05-18')
  assert.match(jobs[0].jobDescription || '', /configure absence plans/i)
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[1].postingDate, '2026-07-20')
  assert.match(jobs[1].jobDescription || '', /Oracle EPM implementations/i)
})
