import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Welcome to Raymond</title>
    <script defer="defer" src="/static/js/main.99151cf2.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const bundleSnippet = `
  {question:"Apply Now",answer:"Begin your journey towards a fulfilling career with us.",cta:"https://raymondcareers.peoplestrong.com/",ctaName:"Apply Now"},
  {title:"Talent Acquisition"}
`

const portalShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
  </head>
  <body class="LtR candidate-portal">
    <app-root data-testid="src-index-app-root-page-1"></app-root>
    <script src="main-MWXE6F34.js" type="module"></script>
  </body>
</html>
`

const samplePayload = {
  totalRecords: 1,
  response: [
    {
      organizationUnitComplete: 'Realty>Realty Business>Realty Business>Raymond Realty Limited>PMO>PMO',
      jobPostedDate: '2026-07-09',
      locationHierarchyComplete: 'India>Maharashtra>Thane>Thane',
      jobDetailUrl: 'https://raymondcareers.peoplestrong.com/job/detail/RAY_L-CC_1696803',
      designation: 'Lead - Cost Controller',
      requisitionId: 1696803,
      jobTitle: 'Lead - Cost Controller',
      jobCode: 'RAY/L-CC/1696803',
      organizationUnit: 'Realty Business',
      jobClosureDate: '2026-08-10',
      locationHierarchy: 'Thane',
      expRange: '15-20 years',
      skills: {
        mustTohave: ['Enable the BD Budgeting and cost controlling process'],
        goodtohave: ['Cost governance'],
      },
      employmentTenureType: 'Full Time',
    },
  ],
  messageCode: {
    code: 200,
    messages: 'success',
  },
  campusHiring: 0,
  solrSearch: false,
}

const emptyPayload = {
  totalRecords: 0,
  response: [],
  messageCode: {
    code: 200,
    messages: 'success',
  },
  campusHiring: 0,
  solrSearch: false,
}

const loadRaymondModule = async () => {
  try {
    return await import('../../scraper/raymond/script.js')
  } catch {
    assert.fail('Expected Raymond scraper module at ../../scraper/raymond/script.js')
  }
}

test('Raymond scraper validates the official careers shell, published handoff, and PeopleStrong portal URLs', async () => {
  const raymond = await loadRaymondModule()

  assert.equal(raymond.CAREERS_PAGE_URL, 'https://www.raymond.in/career')
  assert.equal(raymond.PORTAL_ORIGIN, 'https://raymondcareers.peoplestrong.com')
  assert.equal(raymond.JOB_LISTINGS_URL, 'https://raymondcareers.peoplestrong.com/job/joblist')
  assert.equal(
    raymond.buildApiUrl(),
    'https://raymondcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(
    raymond.buildApiUrl({ offset: 20, limit: 10 }),
    'https://raymondcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=20&limit=10',
  )
  assert.equal(
    raymond.buildJobDetailUrl('RAY/L-CC/1696803'),
    'https://raymondcareers.peoplestrong.com/job/detail/RAY%2FL-CC%2F1696803',
  )
  assert.equal(raymond.hasOfficialCareersShell(careersShellHtml), true)
  assert.equal(
    raymond.extractClientBundleUrl(careersShellHtml),
    'https://www.raymond.in/static/js/main.99151cf2.js',
  )
  assert.equal(raymond.hasVerifiedApplyNowHandoff(bundleSnippet), true)
  assert.equal(raymond.hasPublicPortalShell(portalShellHtml), true)
  assert.equal(raymond.buildPublicHeaders().Origin, 'https://raymondcareers.peoplestrong.com')
  assert.equal(
    raymond.buildPublicHeaders().Referer,
    'https://raymondcareers.peoplestrong.com/job/joblist',
  )
})

test('extractSearchResults maps public Raymond PeopleStrong listing fields', async () => {
  const raymond = await loadRaymondModule()
  const jobs = raymond.extractSearchResults(samplePayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Lead - Cost Controller',
    company: 'Raymond',
    department: 'Realty Business',
    location: 'Thane, Maharashtra, India',
    city: 'Thane',
    country: 'India',
    jobId: 'RAY/L-CC/1696803',
    requisitionId: '1696803',
    sourceUrl: 'https://raymondcareers.peoplestrong.com/job/detail/RAY_L-CC_1696803',
    applyUrl: 'https://raymondcareers.peoplestrong.com/job/detail/RAY_L-CC_1696803',
    employmentType: 'Full Time',
    experienceRequired: '15-20 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Enable the BD Budgeting and cost controlling process',
      'Cost governance',
    ],
    postingDate: '2026-07-09',
    closingDate: '2026-08-10',
    jobDescription: null,
  })
})

test('run verifies the known Raymond handoff before replaying the public PeopleStrong API', async () => {
  const raymond = await loadRaymondModule()
  const pageRequests = []
  const bundleRequests = []
  const apiRequests = []

  const jobs = await raymond.createRaymondScraper().run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === raymond.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersShellHtml }
      }

      if (url === raymond.JOB_LISTINGS_URL) {
        return { status: 200, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected Raymond page URL: ${url}`)
    },
    fetchText: async (url) => {
      bundleRequests.push(url)
      assert.equal(url, 'https://www.raymond.in/static/js/main.99151cf2.js')
      return bundleSnippet
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      return emptyPayload
    },
  })

  assert.deepEqual(pageRequests, [
    raymond.CAREERS_PAGE_URL,
    raymond.JOB_LISTINGS_URL,
  ])
  assert.deepEqual(bundleRequests, ['https://www.raymond.in/static/js/main.99151cf2.js'])
  assert.equal(apiRequests.length, 1)
  assert.equal(apiRequests[0].url, raymond.buildApiUrl())
  assert.equal(apiRequests[0].options.method, 'POST')
  assert.equal(apiRequests[0].options.body, JSON.stringify(raymond.DEFAULT_SEARCH_BODY))
  assert.equal(apiRequests[0].options.headers.Origin, 'https://raymondcareers.peoplestrong.com')
  assert.deepEqual(jobs, [])
})

test('Raymond scraper fails closed when the verified Apply Now handoff disappears', async () => {
  const raymond = await loadRaymondModule()

  await assert.rejects(
    raymond.createRaymondScraper().run({
      fetchPage: async (url) => {
        if (url === raymond.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersShellHtml }
        }

        throw new Error(`Unexpected Raymond page URL: ${url}`)
      },
      fetchText: async () => bundleSnippet.replace('https://raymondcareers.peoplestrong.com/', 'https://example.com/jobs'),
    }),
    /known Apply Now handoff/i,
  )
})
