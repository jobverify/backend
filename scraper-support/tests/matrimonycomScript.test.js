import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Matrimony.com | Matrimony.com | Matrimony.com</title>
  </head>
  <body>
    <h1>Stability of an established company</h1>
    <h2>Explore Opportunities</h2>
    <a href="https://matrimonycareers.peoplestrong.com/">Apply Now</a>
    <a href="https://matrimonycareers.peoplestrong.com/">Begin here!</a>
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
    <script src="main-IQMZX3K4.js" type="module"></script>
  </body>
</html>
`

const samplePayload = {
  totalRecords: 1,
  response: [
    {
      organizationUnitComplete: 'Matrimony.Com>Group Functions-Common>Product Engineering>Product Engineering',
      jobPostedDate: '2026-04-13',
      locationHierarchyComplete: 'India>Tamil Nadu>Tamil Nadu>Chennai>Beliciaa Towers',
      jobDetailUrl: null,
      designation: null,
      requisitionId: null,
      jobTitle: 'Associate General Manager - NI',
      jobCode: 'MCL/AGM-N/1720028',
      organizationUnit: 'Product Engineering',
      jobClosureDate: '2026-08-12',
      locationHierarchy: 'Tamil Nadu',
      expRange: '10-15 years',
      skills: {
        mustTohave: [],
        goodtohave: [],
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

const loadMatrimonycomModule = async () => {
  try {
    return await import('../../scraper/matrimonycom/script.js')
  } catch {
    assert.fail('Expected Matrimony.com scraper module at ../../scraper/matrimonycom/script.js')
  }
}

test('Matrimony.com scraper exports the verified first-party PeopleStrong handoff and API contract', async () => {
  const matrimonycom = await loadMatrimonycomModule()

  assert.equal(matrimonycom.SOURCE, 'matrimonycom')
  assert.equal(matrimonycom.COMPANY, 'Matrimony.com')
  assert.equal(matrimonycom.OFFICIAL_BRAND_NAME, 'Matrimony.com Limited')
  assert.equal(matrimonycom.VERIFIED_ON, '2026-07-16')
  assert.equal(matrimonycom.CAREERS_PAGE_URL, 'https://www.matrimony.com/careers')
  assert.equal(matrimonycom.PORTAL_ORIGIN, 'https://matrimonycareers.peoplestrong.com')
  assert.equal(matrimonycom.JOB_LISTINGS_URL, 'https://matrimonycareers.peoplestrong.com/')
  assert.equal(
    matrimonycom.buildApiUrl(),
    'https://matrimonycareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(
    matrimonycom.extractPeopleStrongHandoffUrl(careersPageHtml),
    'https://matrimonycareers.peoplestrong.com/',
  )
  assert.equal(matrimonycom.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(matrimonycom.hasPublicPortalShell(portalShellHtml), true)
  assert.equal(
    matrimonycom.buildJobDetailUrl('MCL/AGM-N/1720028'),
    'https://matrimonycareers.peoplestrong.com/job/detail/MCL%2FAGM-N%2F1720028',
  )
  assert.equal(matrimonycom.buildPublicHeaders().Origin, 'https://matrimonycareers.peoplestrong.com')
  assert.equal(matrimonycom.buildPublicHeaders().Referer, 'https://matrimonycareers.peoplestrong.com/')
})

test('extractSearchResults maps live Matrimony.com PeopleStrong fields into the shared shape', async () => {
  const matrimonycom = await loadMatrimonycomModule()
  const jobs = matrimonycom.extractSearchResults(samplePayload)

  assert.deepEqual(jobs, [
    {
      title: 'Associate General Manager - NI',
      company: 'Matrimony.com',
      department: 'Product Engineering',
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'MCL/AGM-N/1720028',
      requisitionId: 'MCL/AGM-N/1720028',
      sourceUrl: 'https://matrimonycareers.peoplestrong.com/job/detail/MCL%2FAGM-N%2F1720028',
      applyUrl: 'https://matrimonycareers.peoplestrong.com/job/detail/MCL%2FAGM-N%2F1720028',
      employmentType: null,
      experienceRequired: '10-15 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-04-13',
      closingDate: '2026-08-12',
      jobDescription: null,
    },
  ])
})

test('run verifies the official Matrimony.com careers page, PeopleStrong shell, and live jobs API', async () => {
  const matrimonycom = await loadMatrimonycomModule()
  const pageRequests = []
  const apiRequests = []

  const jobs = await matrimonycom.createMatrimonycomScraper().run({
    now: () => '2026-07-16T00:00:00.000Z',
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === matrimonycom.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      if (url === matrimonycom.JOB_LISTINGS_URL) {
        return { status: 200, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected Matrimony.com page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      return samplePayload
    },
  })

  assert.deepEqual(pageRequests, [
    matrimonycom.CAREERS_PAGE_URL,
    matrimonycom.JOB_LISTINGS_URL,
  ])
  assert.equal(apiRequests.length, 1)
  assert.equal(apiRequests[0].url, matrimonycom.buildApiUrl())
  assert.equal(apiRequests[0].options.method, 'POST')
  assert.deepEqual(apiRequests[0].options.headers, matrimonycom.buildPublicHeaders())
  assert.equal(apiRequests[0].options.body, JSON.stringify(matrimonycom.DEFAULT_SEARCH_BODY))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'MCL/AGM-N/1720028')
  assert.equal(jobs[0].company, 'Matrimony.com')
  assert.equal(jobs[0].location, 'Chennai, Tamil Nadu, India')
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('Matrimony.com fails closed when the verified handoff or public portal shell drifts', async () => {
  const matrimonycom = await loadMatrimonycomModule()

  await assert.rejects(
    matrimonycom.createMatrimonycomScraper().run({
      fetchPage: async (url) => {
        if (url === matrimonycom.CAREERS_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected Matrimony.com page URL: ${url}`)
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    matrimonycom.createMatrimonycomScraper().run({
      fetchPage: async (url) => {
        if (url === matrimonycom.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersPageHtml }
        }

        if (url === matrimonycom.JOB_LISTINGS_URL) {
          return { status: 200, url, html: '<html><head><title>Placeholder</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected Matrimony.com page URL: ${url}`)
      },
    }),
    /public PeopleStrong portal/i,
  )
})
