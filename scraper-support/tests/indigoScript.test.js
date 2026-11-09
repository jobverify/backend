import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IndiGo Careers</title>
    <link rel="canonical" href="https://www.goindigo.in/careers.html">
  </head>
  <body>
    <p>Hello there,</p>
    <p>Log in for getting posted on new career opportunities with IndiGo!</p>
    <a href="https://career44.sapsf.com/career?career_ns=subscribe&company=interglobe&navBarLevel=MY_PROFILE">
      Careers Login
    </a>
    <h1>We are driven by the purpose</h1>
    <p>Find your next job at IndiGo</p>
    <a href="/careers/job-search.html">View all jobs</a>
    <p>Airport Operations &amp; Customer Services</p>
    <p>Engineering</p>
    <p>CarGo</p>
    <a
      href="https://career-in10.hr.cloud.sap/careers?company=interglobe&amp;career_ns=job_application&amp;career_job_req_id=9735"
    >
      Register Now
    </a>
  </body>
</html>
`

const jobSearchShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Search</title>
    <link rel="canonical" href="https://www.goindigo.in/careers/job-search.html">
  </head>
  <body>
    <nav>
      <span>Careers</span>
      <span>All Jobs</span>
    </nav>
    <p>Please enter valid email address.</p>
    <div data-component="mf-job-search" aria-label="Careers Job Search"></div>
    <script>
      window._env_career_job_search = {
        CAREER_JOB_SEARCH_RESULT_LIST: 'https://ms-careers-prod.goindigo.in/career-job-list',
        CAREER_JOB_SEARCH_DROPDOWN_DATA: 'https://ms-careers-prod.goindigo.in/career-department-list',
        CAREER_JOB_SEARCH_LOCATION_DROPDOWN_DATA: 'https://ms-careers-prod.goindigo.in/career-location-list',
        CAREER_APPLY_NOW_URL: 'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=',
        CAREER_MS: '03ba3c0795ce04ed48e7fe3854155a1f'
      };
    </script>
    <script src="https://mf-careers-prod.goindigo.in/job-search/remoteEntry.js"></script>
  </body>
</html>
`

const indigoJobsPayload = {
  result: [
    {
      jobReqId: '8841',
      deleted: 'Not Deleted',
      numberOpenings: '30',
      division_obj: {
        name: 'Flight Operations',
      },
      legalEntity_obj: {
        name: 'InterGlobe Aviation limited',
      },
      location_obj: {
        results: [
          {
            externalCode: 'Pan-India',
            name: 'Pan-India',
          },
        ],
      },
      jobReqLocale: {
        results: [
          {
            externalTitle: 'A320 Captain - Non Type Rated',
            externalJobDescription: '<p>Qualifying Criteria: Valid DGCA issued ATPL.</p>',
          },
        ],
      },
      jobReqPostings: {
        results: [
          {
            jobReqId: '8841',
            postingStatus: 'Updated',
            boardId: '_private_external',
            postStartDate: '/Date(1782000000000)/',
            postEndDate: '/Date(1785000000000)/',
          },
          {
            jobReqId: '8841',
            postingStatus: 'Updated',
            boardId: '_external',
            postStartDate: '/Date(1782864000000)/',
            postEndDate: '/Date(1785542400000)/',
          },
        ],
      },
      department_obj: {
        name: 'Flight Operations',
        description: 'Cockpit Crew',
      },
      status: {
        results: [
          {
            externalCode: 'Open',
            status: 'ACTIVE',
          },
        ],
      },
    },
    {
      jobReqId: '9000',
      deleted: 'Deleted',
      jobReqLocale: {
        results: [
          {
            externalTitle: 'Closed Role',
          },
        ],
      },
    },
  ],
}

const createHtmlResponse = (url, html) => ({
  ok: true,
  status: 200,
  url,
  headers: {
    get: (name) => (/content-type/i.test(String(name)) ? 'text/html; charset=utf-8' : null),
  },
  text: async () => html,
})

const createJsonResponse = (url, body) => ({
  ok: true,
  status: 200,
  url,
  headers: {
    get: (name) => (/content-type/i.test(String(name)) ? 'application/json; charset=utf-8' : null),
  },
  json: async () => body,
})

const createSocketClosedError = () => {
  const error = new TypeError('fetch failed')
  error.cause = { code: 'UND_ERR_SOCKET' }
  return error
}

const loadModule = async () => {
  try {
    return await import('../../scraper/indigo/script.js')
  } catch {
    assert.fail('Expected Indigo scraper module at ../../scraper/indigo/script.js')
  }
}

test('Indigo scraper exports the verified first-party careers page and public job-search API contract', async () => {
  const indigo = await loadModule()

  assert.equal(indigo.COMPANY, 'Indigo')
  assert.equal(indigo.OFFICIAL_BRAND_NAME, 'IndiGo')
  assert.equal(indigo.VERIFIED_ON, '2026-07-19')
  assert.equal(indigo.HOMEPAGE_URL, 'https://www.goindigo.in/')
  assert.equal(indigo.CAREERS_PAGE_URL, 'https://www.goindigo.in/careers.html')
  assert.equal(indigo.JOB_SEARCH_URL, 'https://www.goindigo.in/careers/job-search.html')
  assert.equal(indigo.JOB_SEARCH_API_URL, 'https://ms-careers-prod.goindigo.in/career-job-list')
  assert.equal(indigo.CAREER_MS_USER_KEY, '03ba3c0795ce04ed48e7fe3854155a1f')
  assert.equal(
    indigo.SUCCESSFACTORS_APPLY_URL_PREFIX,
    'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=',
  )
  assert.equal(indigo.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(indigo.hasJobSearchShellSignal(jobSearchShellHtml), true)
  assert.deepEqual(indigo.extractJobSearchApiConfig(jobSearchShellHtml), {
    jobListApiUrl: 'https://ms-careers-prod.goindigo.in/career-job-list',
    applyUrlPrefix:
      'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=',
    userKey: '03ba3c0795ce04ed48e7fe3854155a1f',
  })
  assert.equal(indigo.hasPublicJobSearchApiSignal(jobSearchShellHtml), true)
})

test('Indigo maps public SuccessFactors API jobs into shared scraper fields', async () => {
  const indigo = await loadModule()

  const jobs = indigo.extractJobsFromApiPayload(indigoJobsPayload, {
    applyUrlPrefix: indigo.SUCCESSFACTORS_APPLY_URL_PREFIX,
    scrapedAt: '2026-07-19T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'A320 Captain - Non Type Rated',
      company: 'Indigo',
      department: 'Flight Operations',
      location: 'Pan-India, India',
      city: 'Pan-India',
      country: 'India',
      link:
        'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=8841',
      applyUrl:
        'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=8841',
      sourceUrl:
        'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=8841',
      source: 'indigo',
      jobId: '8841',
      requisitionId: '8841',
      numberOpenings: 30,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-01T00:00:00.000Z',
      closingDate: '2026-08-01T00:00:00.000Z',
      jobDescription: 'Qualifying Criteria: Valid DGCA issued ATPL.',
      publicExperienceChecked: true,
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-19T00:00:00.000Z',
    },
  ])
})

test('Indigo run validates the first-party shell and fetches the public API with the page-provided user key', async () => {
  const indigo = await loadModule()
  const requested = []

  const jobs = await indigo.createIndigoScraper().run({
    fetchPage: async (url) => {
      requested.push({ type: 'page', url })

      if (url === indigo.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersLandingHtml }
      }

      if (url === indigo.JOB_SEARCH_URL) {
        return { status: 200, url, html: jobSearchShellHtml }
      }

      throw new Error(`Unexpected Indigo page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, headers: options.headers })
      assert.equal(url, indigo.JOB_SEARCH_API_URL)
      assert.equal(options.headers.user_key, indigo.CAREER_MS_USER_KEY)
      return indigoJobsPayload
    },
    now: () => '2026-07-19T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    { type: 'page', url: indigo.CAREERS_PAGE_URL },
    { type: 'page', url: indigo.JOB_SEARCH_URL },
    { type: 'json', url: indigo.JOB_SEARCH_API_URL, headers: { user_key: indigo.CAREER_MS_USER_KEY } },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'A320 Captain - Non Type Rated')
  assert.equal(jobs[0].source, 'indigo')
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('Indigo default fetchers retry transient socket closures on the public pages and jobs API', async () => {
  const indigo = await loadModule()
  const originalFetch = globalThis.fetch
  const attempts = new Map()

  globalThis.fetch = async (url, options = {}) => {
    const urlString = String(url)
    const nextAttempt = (attempts.get(urlString) || 0) + 1
    attempts.set(urlString, nextAttempt)

    if (urlString === indigo.CAREERS_PAGE_URL) {
      if (nextAttempt === 1) throw createSocketClosedError()
      return createHtmlResponse(urlString, careersLandingHtml)
    }

    if (urlString === indigo.JOB_SEARCH_URL) {
      if (nextAttempt === 1) throw createSocketClosedError()
      return createHtmlResponse(urlString, jobSearchShellHtml)
    }

    if (urlString === indigo.JOB_SEARCH_API_URL) {
      assert.equal(options.headers.user_key, indigo.CAREER_MS_USER_KEY)
      if (nextAttempt === 1) throw createSocketClosedError()
      return createJsonResponse(urlString, indigoJobsPayload)
    }

    throw new Error(`Unexpected Indigo fetch URL: ${urlString}`)
  }

  try {
    const jobs = await indigo.createIndigoScraper().run({
      now: () => '2026-07-19T00:00:00.000Z',
    })

    assert.equal(jobs.length, 1)
    assert.equal(attempts.get(indigo.CAREERS_PAGE_URL), 2)
    assert.equal(attempts.get(indigo.JOB_SEARCH_URL), 2)
    assert.equal(attempts.get(indigo.JOB_SEARCH_API_URL), 2)
    assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Indigo fails closed when the verified page, API config, or public jobs payload drifts', async () => {
  const indigo = await loadModule()

  await assert.rejects(
    indigo.createIndigoScraper().run({
      fetchPage: async (url) => {
        if (url === indigo.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        throw new Error(`Unexpected Indigo URL: ${url}`)
      },
      fetchJson: async () => indigoJobsPayload,
    }),
    /verified careers landing page/i,
  )

  await assert.rejects(
    indigo.createIndigoScraper().run({
      fetchPage: async (url) => {
        if (url === indigo.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === indigo.JOB_SEARCH_URL) {
          return {
            status: 200,
            url,
            html: jobSearchShellHtml.replace(indigo.CAREER_MS_USER_KEY, 'changed-key'),
          }
        }

        throw new Error(`Unexpected Indigo URL: ${url}`)
      },
      fetchJson: async () => indigoJobsPayload,
    }),
    /job-search API contract/i,
  )

  await assert.rejects(
    indigo.createIndigoScraper().run({
      fetchPage: async (url) => {
        if (url === indigo.CAREERS_PAGE_URL) return { status: 200, url, html: careersLandingHtml }
        if (url === indigo.JOB_SEARCH_URL) return { status: 200, url, html: jobSearchShellHtml }
        throw new Error(`Unexpected Indigo URL: ${url}`)
      },
      fetchJson: async () => ({ result: [] }),
    }),
    /no public India jobs/i,
  )
})
