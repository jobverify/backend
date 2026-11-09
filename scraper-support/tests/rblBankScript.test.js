import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | RBL Bank</title>
  </head>
  <body>
    <p>Join us to build a career where you can make a difference!</p>
    <a href="https://rblcareers.peoplestrong.com/" id="career-life-job-opportunities">Job Opportunities</a>
    <h2>Find your Work Family</h2>
    <a href="https://rblcareers.peoplestrong.com/" id="career-work-family-job-opportunities">Job Opportunities</a>
  </body>
</html>
`

const portalShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
  </head>
  <body class="candidate-portal">
    <app-root data-testid="src-index-app-root-page-1"></app-root>
    <script src="main-ABCD1234.js" type="module"></script>
  </body>
</html>
`

const samplePayload = {
  totalRecords: 4,
  response: [
    {
      organizationUnitComplete: 'RBL Bank Limited>Branch Banking and Retail Liabilities>Retail Branch Banking>1302',
      jobPostedDate: '2025-09-11',
      locationHierarchyComplete: 'India>South>Karnataka>Bangalore>BANGALORE>A>Blr 2>Non-Branch>RPC Prestige Towers, Bangalore',
      jobDetailUrl: 'https://rblcareers.peoplestrong.com/job/detail/RBL_BM_1477475',
      designation: 'Branch Manager',
      requisitionId: 1477475,
      jobTitle: 'Branch Manager',
      jobCode: 'RBL/BM/1477475',
      organizationUnit: 'Retail Branch Banking',
      jobClosureDate: '2026-10-31',
      locationHierarchy: 'Bangalore',
      expRange: '10-15 years',
      skills: {
        mustTohave: [],
        goodtohave: ['Business Development', 'Relationship Management'],
      },
      employmentTenureType: null,
    },
  ],
  messageCode: {
    code: 200,
    messages: 'success',
  },
  campusHiring: 0,
  solrSearch: false,
}

const loadRblBankModule = async () => {
  try {
    return await import('../../scraper/rblbank/script.js')
  } catch {
    assert.fail('Expected RBL Bank scraper module at ../../scraper/rblbank/script.js')
  }
}

test('RBL Bank scraper exports the verified first-party PeopleStrong handoff and API contract', async () => {
  const rblbank = await loadRblBankModule()

  assert.equal(rblbank.SOURCE, 'rblbank')
  assert.equal(rblbank.COMPANY, 'RBL Bank')
  assert.equal(rblbank.OFFICIAL_BRAND_NAME, 'RBL Bank Limited')
  assert.equal(rblbank.VERIFIED_ON, '2026-07-17')
  assert.equal(rblbank.CAREERS_PAGE_URL, 'https://www.rbl.bank.in/careers')
  assert.equal(rblbank.PORTAL_ORIGIN, 'https://rblcareers.peoplestrong.com')
  assert.equal(rblbank.JOB_LISTINGS_URL, 'https://rblcareers.peoplestrong.com/')
  assert.equal(
    rblbank.buildApiUrl(),
    'https://rblcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(
    rblbank.extractPeopleStrongHandoffUrl(careersPageHtml),
    'https://rblcareers.peoplestrong.com/',
  )
  assert.equal(rblbank.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(rblbank.hasPublicPortalShell(portalShellHtml), true)
  assert.equal(
    rblbank.buildJobDetailUrl('RBL/BM/1477475'),
    'https://rblcareers.peoplestrong.com/job/detail/RBL%2FBM%2F1477475',
  )
  assert.equal(rblbank.buildPublicHeaders().Origin, 'https://rblcareers.peoplestrong.com')
  assert.equal(rblbank.buildPublicHeaders().Referer, 'https://rblcareers.peoplestrong.com/')
})

test('extractSearchResults maps live RBL Bank PeopleStrong fields into the shared shape', async () => {
  const rblbank = await loadRblBankModule()
  const jobs = rblbank.extractSearchResults(samplePayload)

  assert.deepEqual(jobs, [
    {
      title: 'Branch Manager',
      company: 'RBL Bank',
      department: 'Retail Branch Banking',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'RBL/BM/1477475',
      requisitionId: 1477475,
      sourceUrl: 'https://rblcareers.peoplestrong.com/job/detail/RBL_BM_1477475',
      applyUrl: 'https://rblcareers.peoplestrong.com/job/detail/RBL_BM_1477475',
      employmentType: null,
      experienceRequired: '10-15 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Business Development', 'Relationship Management'],
      postingDate: '2025-09-11',
      closingDate: '2026-10-31',
      jobDescription: null,
    },
  ])
})

test('run verifies the official RBL Bank careers page, PeopleStrong shell, and live jobs API contract', async () => {
  const rblbank = await loadRblBankModule()
  const pageRequests = []
  const apiRequests = []

  const jobs = await rblbank.createRblBankScraper().run({
    now: () => '2026-07-17T00:00:00.000Z',
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === rblbank.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === rblbank.JOB_LISTINGS_URL) {
        return { status: 200, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected RBL Bank page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      return samplePayload
    },
  })

  assert.deepEqual(pageRequests, [
    rblbank.CAREERS_PAGE_URL,
    rblbank.JOB_LISTINGS_URL,
  ])
  assert.equal(apiRequests.length, 1)
  assert.equal(apiRequests[0].url, rblbank.buildApiUrl())
  assert.equal(apiRequests[0].options.method, 'POST')
  assert.deepEqual(apiRequests[0].options.headers, rblbank.buildPublicHeaders())
  assert.equal(apiRequests[0].options.body, JSON.stringify(rblbank.DEFAULT_SEARCH_BODY))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'RBL/BM/1477475')
  assert.equal(jobs[0].company, 'RBL Bank')
  assert.equal(jobs[0].location, 'Bangalore, Karnataka, India')
  assert.equal(jobs[0].scrapedAt, '2026-07-17T00:00:00.000Z')
})

test('RBL Bank fails closed when the verified handoff or public portal shell drifts', async () => {
  const rblbank = await loadRblBankModule()

  await assert.rejects(
    rblbank.createRblBankScraper().run({
      fetchPage: async (url) => {
        if (url === rblbank.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected RBL Bank page URL: ${url}`)
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    rblbank.createRblBankScraper().run({
      fetchPage: async (url) => {
        if (url === rblbank.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === rblbank.JOB_LISTINGS_URL) {
          return { status: 200, url, html: '<html><head><title>Placeholder</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected RBL Bank page URL: ${url}`)
      },
    }),
    /public PeopleStrong portal/i,
  )
})
