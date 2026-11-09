import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Livpure RO Water Purifier on Rent (Subscription) | Starts @ Rs 429/m</title>
  </head>
  <body>
    <div class="dropdown-content">
      <a href="https://www.livpuresmart.com/ro-subscription/how-it-works">How it Works</a>
      <a href="https://www.livpuresmart.com/faqs">FAQs</a>
      <a href="https://www.livpuresmart.com/blog" target="_blank">Blog</a>
      <a href="https://livpurerecruit-careers.peoplestrong.com/home" target="_blank">Careers</a>
    </div>
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

const samplePayload = {
  totalRecords: 1,
  response: [
    {
      jobPostedDate: '2026-07-12',
      jobTitle: 'Manager - Brand Partnerships',
      jobCode: 'LIVPURE/BRAND/1201',
      requisitionId: 'LIVPURE/BRAND/1201',
      jobClosureDate: '2026-08-12',
      locationHierarchy: 'Gurgaon',
      locationHierarchyComplete: 'India>Haryana>Gurgaon>Gurgaon',
      organizationUnit: 'Marketing',
      expRange: '6-10 years',
      employmentTenureType: 'Full Time',
      skills: {
        mustTohave: ['Brand Partnerships'],
        goodtohave: ['Consumer Marketing'],
      },
    },
  ],
}

const loadLivpureModule = async () => {
  try {
    return await import('../../scraper/livpure/script.js')
  } catch {
    assert.fail('Expected Livpure scraper module at ../../scraper/livpure/script.js')
  }
}

test('Livpure scraper exports the verified first-party homepage handoff and empty-board contract', async () => {
  const livpure = await loadLivpureModule()

  assert.equal(livpure.SOURCE, 'livpure')
  assert.equal(livpure.COMPANY, 'Livpure')
  assert.equal(livpure.OFFICIAL_BRAND_NAME, 'Livpure Smart Homes Pvt Ltd')
  assert.equal(livpure.VERIFIED_ON, '2026-07-16')
  assert.equal(livpure.HOMEPAGE_URL, 'https://www.livpuresmart.com/')
  assert.equal(livpure.PORTAL_ORIGIN, 'https://livpurerecruit-careers.peoplestrong.com')
  assert.equal(livpure.JOB_LISTINGS_URL, 'https://livpurerecruit-careers.peoplestrong.com/home')
  assert.equal(
    livpure.buildApiUrl(),
    'https://livpurerecruit-careers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(
    livpure.extractPeopleStrongHandoffUrl(homepageHtml),
    'https://livpurerecruit-careers.peoplestrong.com/home',
  )
  assert.equal(livpure.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(livpure.hasPublicPortalShell(portalShellHtml), true)
  assert.equal(
    livpure.buildJobDetailUrl('LIVPURE/BRAND/1201'),
    'https://livpurerecruit-careers.peoplestrong.com/job/detail/LIVPURE%2FBRAND%2F1201',
  )
  assert.equal(
    livpure.buildPublicHeaders().Referer,
    'https://livpurerecruit-careers.peoplestrong.com/home',
  )
})

test('Livpure extractSearchResults maps PeopleStrong jobs when the board has openings again', async () => {
  const livpure = await loadLivpureModule()
  const jobs = livpure.extractSearchResults(samplePayload)

  assert.deepEqual(jobs, [
    {
      title: 'Manager - Brand Partnerships',
      company: 'Livpure',
      department: 'Marketing',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'LIVPURE/BRAND/1201',
      requisitionId: 'LIVPURE/BRAND/1201',
      sourceUrl:
        'https://livpurerecruit-careers.peoplestrong.com/job/detail/LIVPURE%2FBRAND%2F1201',
      applyUrl:
        'https://livpurerecruit-careers.peoplestrong.com/job/detail/LIVPURE%2FBRAND%2F1201',
      employmentType: 'Full Time',
      experienceRequired: '6-10 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Brand Partnerships', 'Consumer Marketing'],
      postingDate: '2026-07-12',
      closingDate: '2026-08-12',
      jobDescription: null,
    },
  ])
})

test('Livpure returns [] while the verified homepage and PeopleStrong shell stay live but the public board is empty', async () => {
  const livpure = await loadLivpureModule()
  const requestedPages = []
  const apiRequests = []

  const jobs = await livpure.createLivpureScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === livpure.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === livpure.JOB_LISTINGS_URL) {
        return { status: 404, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected Livpure page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      return emptyPayload
    },
  })

  assert.deepEqual(requestedPages, [
    livpure.HOMEPAGE_URL,
    livpure.JOB_LISTINGS_URL,
  ])
  assert.equal(apiRequests.length, 1)
  assert.equal(apiRequests[0].url, livpure.buildApiUrl())
  assert.equal(apiRequests[0].options.method, 'POST')
  assert.deepEqual(apiRequests[0].options.headers, livpure.buildPublicHeaders())
  assert.equal(apiRequests[0].options.body, JSON.stringify(livpure.DEFAULT_SEARCH_BODY))
  assert.deepEqual(jobs, [])
})

test('Livpure fails closed when the verified homepage handoff or PeopleStrong shell drifts', async () => {
  const livpure = await loadLivpureModule()

  await assert.rejects(
    livpure.createLivpureScraper().run({
      fetchPage: async (url) => {
        if (url === livpure.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected Livpure page URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    livpure.createLivpureScraper().run({
      fetchPage: async (url) => {
        if (url === livpure.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === livpure.JOB_LISTINGS_URL) {
          return { status: 200, url, html: '<html><head><title>Placeholder</title></head><body>broken</body></html>' }
        }

        throw new Error(`Unexpected Livpure page URL: ${url}`)
      },
    }),
    /public peoplestrong portal/i,
  )
})
