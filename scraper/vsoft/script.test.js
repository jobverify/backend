import assert from 'node:assert/strict'
import test from 'node:test'

import {
    buildJobDivaDetailUrl,
    buildJobDivaJobUrl,
    buildJobDivaListAllUrl,
    CAREER_PORTAL_URL,
    CAREERS_PAGE_URL,
    COMPANY,
    createVsoftScraper,
    DEFAULT_PAGE_SIZE,
    extractJobDivaIframeUrl,
    extractJobDivaPortalParams,
    extractJobs,
    getRunnerMetadata,
    hasCareerPortalPageSignal,
    hasCareersPageSignal,
    hasJobDivaPortalShellSignal,
    isIndiaSummaryRecord,
    JOBDIVA_AUTH_URL,
    JOBDIVA_DETAIL_URL_PREFIX,
    JOBDIVA_LIST_ALL_URL,
    JOBDIVA_PORTAL_URL,
    SOURCE,
    VERIFIED_ON,
} from './script.js'

const careersHtml = `
<!doctype html>
<html lang="en-US">
<head>
  <title>Careers - V-Soft Consulting | Enterprise AI &amp; Digital Transformation</title>
</head>
<body>
  <main>
    <a href="https://www.vsoftconsulting.com/career-portal/">View jobs</a>
  </main>
</body>
</html>
`

const careerPortalHtml = `
<!doctype html>
<html lang="en-US">
<head>
  <title>V-Soft Consulting Careers and IT Opportunities</title>
</head>
<body class="page-career-portal">
  <section class="jobdiva-careers py-5">
    <iframe
      title="V-Soft Consulting Careers"
      data-rocket-lazyload="fitvidscompatible"
      data-lazy-src="https://www1.jobdiva.com/portal/?a=ehjdnwnz6myv05mxjimlmwguleo14c0be149kcy238wtxsp4ozlqyjqehdl6g0y1&#038;compid=-1">
    </iframe>
    <noscript>
      <iframe
        src="https://www1.jobdiva.com/portal/?a=ehjdnwnz6myv05mxjimlmwguleo14c0be149kcy238wtxsp4ozlqyjqehdl6g0y1&#038;compid=-1">
      </iframe>
    </noscript>
  </section>
</body>
</html>
`

const jobDivaPortalHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>Candidate Portal</title>
</head>
<body>
  <div id="jobdivaheader"></div>
  <noscript>You need to enable JavaScript to run this app.</noscript>
  <script src="/scripts/pako.min.js"></script>
  <script>
    var JobPortalEnv = "PRODUCTION";
    var jsFilePath1 = "/portal/index_bundle.js.gz?v=20260803_01";
    var jsFilePath2 = "/portal/1.index_bundle.js.gz?v=20260803_01";
  </script>
</body>
</html>
`

const jobDivaAuthPayload = {
  token: 'test-jobdiva-token',
  a: 'ehjdnwnz6myv05mxjimlmwguleo14c0be149kcy238wtxsp4ozlqyjqehdl6g0y1',
  portalID: 3041,
  compid: -1,
  region_code: 'en_US',
  date_format: 'MM/DD/YYYY',
  timezone: 'America/New_York',
  env_type: 'PRODUCTION',
  portal_lang: 'en_US',
}

const jobListPayload = {
  total: 4,
  data: [
    {
      id: 32573567,
      title: 'Java developer',
      refNo: '26-00003',
      company: 'Confidential',
      postDate: Date.parse('2026-07-10T00:00:00.000Z'),
      location: 'hyderabad, Telangana',
      otherLocations: [],
      jobDescription: 'Primary location: Hyderabad',
    },
    {
      id: 32531908,
      title: 'C/S P/A(S), VB, CROSS PLATFORMS',
      refNo: '26-00002',
      company: 'VSoft',
      postDate: Date.parse('2026-07-01T00:00:00.000Z'),
      location: 'Hyderabad',
      otherLocations: [],
      jobDescription: 'Job Description',
    },
    {
      id: 32794669,
      title: 'Sr. Java Developer',
      refNo: '26-01000',
      company: 'Confidential',
      postDate: Date.parse('2026-07-15T00:00:00.000Z'),
      location: 'Remote, OR',
      otherLocations: [],
      jobDescription: 'Partnering with the Indianapolis platform team.',
    },
    {
      id: 32846651,
      title: 'Tester',
      refNo: '26-05127',
      company: 'Confidential',
      postDate: Date.parse('2026-08-13T00:00:00.000Z'),
      location: 'Hartford, CT',
      otherLocations: [],
      jobDescription: 'Primary location: Hartford, CT',
    },
  ],
}

const indiaJobDetailPayloads = {
  32573567: {
    hasApplied: false,
    job: {
      id: 32573567,
      title: 'Java developer',
      refNo: '26-00003',
      company: null,
      jobSector: '1',
      postDate: Date.parse('2026-07-10T00:00:00.000Z'),
      positionType: 'Contract',
      mainLocation: {
        country: 'India',
        state: 'Telangana',
        city: 'hyderabad',
        zip: '500081',
      },
      otherLocations: [],
      jobDescription: '<div><p>Build services.</p><ul><li>Java</li><li>Spring</li></ul></div>',
    },
  },
  32531908: {
    hasApplied: false,
    job: {
      id: 32531908,
      title: 'C/S P/A(S), VB, CROSS PLATFORMS',
      refNo: '26-00002',
      company: 'VSoft',
      jobSector: 'Engineering',
      postDate: Date.parse('2026-07-01T00:00:00.000Z'),
      positionType: null,
      mainLocation: {
        country: 'India',
        state: 'Telangana',
        city: 'hyderabad',
        zip: '500081',
      },
      otherLocations: [],
      jobDescription: '<p>Job Description</p>',
    },
  },
}

test('pins the verified VSoft first-party careers handoff and embedded JobDiva shell', () => {
  assert.equal(SOURCE, 'vsoft')
  assert.equal(COMPANY, 'VSoft')
  assert.equal(VERIFIED_ON, '2026-10-03')
  assert.equal(CAREERS_PAGE_URL, 'https://www.vsoftconsulting.com/careers/')
  assert.equal(CAREER_PORTAL_URL, 'https://www.vsoftconsulting.com/career-portal/')
  assert.equal(
    JOBDIVA_PORTAL_URL,
    'https://www1.jobdiva.com/portal/?a=ehjdnwnz6myv05mxjimlmwguleo14c0be149kcy238wtxsp4ozlqyjqehdl6g0y1&compid=-1',
  )
  assert.equal(hasCareersPageSignal(careersHtml), true)
  assert.equal(hasCareersPageSignal(careersHtml.replace(
    'Careers - V-Soft Consulting | Enterprise AI &amp; Digital Transformation',
    'Careers | V-Soft Consulting',
  )), true)
  assert.equal(hasCareerPortalPageSignal(careerPortalHtml), true)
  assert.equal(extractJobDivaIframeUrl(careerPortalHtml), JOBDIVA_PORTAL_URL)
  assert.equal(hasJobDivaPortalShellSignal(jobDivaPortalHtml), true)
  assert.deepEqual(extractJobDivaPortalParams(JOBDIVA_PORTAL_URL), {
    a: 'ehjdnwnz6myv05mxjimlmwguleo14c0be149kcy238wtxsp4ozlqyjqehdl6g0y1',
    compid: '-1',
  })
  assert.equal(buildJobDivaListAllUrl(DEFAULT_PAGE_SIZE), `${JOBDIVA_LIST_ALL_URL}?portaltype=1&count=200`)
  assert.equal(buildJobDivaDetailUrl(32573567), `${JOBDIVA_DETAIL_URL_PREFIX}32573567?compid=-1`)
})

test('filters India summaries without false positives and maps JobDiva detail payloads into Jobverify jobs', () => {
  assert.equal(isIndiaSummaryRecord(jobListPayload.data[0]), true)
  assert.equal(isIndiaSummaryRecord(jobListPayload.data[1]), true)
  assert.equal(isIndiaSummaryRecord(jobListPayload.data[2]), false)
  assert.equal(isIndiaSummaryRecord(jobListPayload.data[3]), false)

  assert.deepEqual(extractJobs([
    indiaJobDetailPayloads[32573567],
    indiaJobDetailPayloads[32531908],
  ]), [
    {
      title: 'Java developer',
      company: 'VSoft',
      department: null,
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '32573567',
      requisitionId: '26-00003',
      sourceUrl: buildJobDivaJobUrl('32573567'),
      applyUrl: buildJobDivaJobUrl('32573567'),
      employmentType: 'Contract',
      postingDate: '2026-07-10T00:00:00.000Z',
      jobDescription: 'Build services. Java Spring',
      requiredSkills: ['Java', 'Spring'],
    },
    {
      title: 'C/S P/A(S), VB, CROSS PLATFORMS',
      company: 'VSoft',
      department: 'Engineering',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      jobId: '32531908',
      requisitionId: '26-00002',
      sourceUrl: buildJobDivaJobUrl('32531908'),
      applyUrl: buildJobDivaJobUrl('32531908'),
      employmentType: null,
      postingDate: '2026-07-01T00:00:00.000Z',
      jobDescription: 'Job Description',
      requiredSkills: [],
    },
  ])
})

test('returns the live India jobs from the verified VSoft JobDiva board and skips non-India detail fetches', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await createVsoftScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === CAREERS_PAGE_URL) return careersHtml
      if (url === CAREER_PORTAL_URL) return careerPortalHtml
      if (url === JOBDIVA_PORTAL_URL) return jobDivaPortalHtml

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)

      if (url === JOBDIVA_AUTH_URL) return jobDivaAuthPayload
      if (url === buildJobDivaListAllUrl(DEFAULT_PAGE_SIZE)) return jobListPayload
      if (url === buildJobDivaDetailUrl(32573567)) return indiaJobDetailPayloads[32573567]
      if (url === buildJobDivaDetailUrl(32531908)) return indiaJobDetailPayloads[32531908]

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    CAREERS_PAGE_URL,
    CAREER_PORTAL_URL,
    JOBDIVA_PORTAL_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    JOBDIVA_AUTH_URL,
    buildJobDivaListAllUrl(DEFAULT_PAGE_SIZE),
    buildJobDivaDetailUrl(32573567),
    buildJobDivaDetailUrl(32531908),
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      source: job.source,
      link: job.link,
    })),
    [
      {
        title: 'Java developer',
        location: 'Hyderabad, Telangana, India',
        jobId: '32573567',
        sourceUrl: buildJobDivaJobUrl('32573567'),
        applyUrl: buildJobDivaJobUrl('32573567'),
        source: SOURCE,
        link: buildJobDivaJobUrl('32573567'),
      },
      {
        title: 'C/S P/A(S), VB, CROSS PLATFORMS',
        location: 'Hyderabad, Telangana, India',
        jobId: '32531908',
        sourceUrl: buildJobDivaJobUrl('32531908'),
        applyUrl: buildJobDivaJobUrl('32531908'),
        source: SOURCE,
        link: buildJobDivaJobUrl('32531908'),
      },
    ],
  )
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})

test('returns no jobs when the verified VSoft JobDiva board has no India openings', async () => {
  const jobs = await createVsoftScraper().run({
    fetchText: async (url) => {
      if (url === CAREERS_PAGE_URL) return careersHtml
      if (url === CAREER_PORTAL_URL) return careerPortalHtml
      if (url === JOBDIVA_PORTAL_URL) return jobDivaPortalHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      if (url === JOBDIVA_AUTH_URL) return jobDivaAuthPayload
      if (url === buildJobDivaListAllUrl(DEFAULT_PAGE_SIZE)) {
        return {
          total: 1,
          data: [jobListPayload.data[3]],
        }
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('returns runner metadata for the verified VSoft JobDiva handoff', () => {
  assert.deepEqual(getRunnerMetadata(), {
    name: SOURCE,
    dryRunFile: 'jobs.json',
    provider: {
      source: SOURCE,
      companyName: COMPANY,
      companyCareerPage: CAREERS_PAGE_URL,
      jobBoardUrl: CAREER_PORTAL_URL,
      jobBoardApi: buildJobDivaListAllUrl(DEFAULT_PAGE_SIZE),
      adapter: 'script',
      atsPlatform: 'jobdiva-candidate-portal',
      countryFilter: 'India',
    },
  })
})

test('fails closed when the careers page, career-portal iframe, or JobDiva shell drifts', async () => {
  await assert.rejects(
    createVsoftScraper().run({
      fetchText: async () => '<html><body>unexpected</body></html>',
      fetchJson: async () => {
        throw new Error('fetchJson should not run when the careers page signal is missing')
      },
    }),
    /verified VSoft careers surface/i,
  )

  await assert.rejects(
    createVsoftScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_PAGE_URL) return careersHtml
        if (url === CAREER_PORTAL_URL) {
          return careerPortalHtml.replace(
            'ehjdnwnz6myv05mxjimlmwguleo14c0be149kcy238wtxsp4ozlqyjqehdl6g0y1',
            'other',
          )
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => {
        throw new Error('fetchJson should not run when the iframe handoff is wrong')
      },
    }),
    /career portal handoff/i,
  )

  await assert.rejects(
    createVsoftScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_PAGE_URL) return careersHtml
        if (url === CAREER_PORTAL_URL) return careerPortalHtml
        if (url === JOBDIVA_PORTAL_URL) return '<html><body>Missing portal shell</body></html>'

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => {
        throw new Error('fetchJson should not run when the JobDiva shell is missing')
      },
    }),
    /public JobDiva portal/i,
  )
})
