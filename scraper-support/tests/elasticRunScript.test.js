import assert from 'node:assert/strict'
import test from 'node:test'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ElasticRun - India's Commerce Enabler</title>
    <script type="module" crossorigin src="/assets/index-B4NC3wpI.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://elastic.run/</loc>
  </url>
  <url>
    <loc>https://elastic.run/careers</loc>
  </url>
</urlset>
`

const bundleSnippet = `
function CareersPage(){
  return "<title>Careers at ElasticRun | Join India's Fastest Growing Company</title>"
    + "Turbo charge your career"
    + "Where passion meets purpose"
    + "Great Place to Work certified."
    + "View Open Roles"
    + "https://elasticruncareers.peoplestrong.com/job/joblist";
}
`

const portalShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Candidate Portal</title>
  </head>
  <body class="LtR candidate-portal">
    <app-root data-testid="src-index-app-root-page-1"></app-root>
    <script src="main-IQMZX3K4.js" type="module"></script>
  </body>
</html>
`

const samplePayload = {
  totalRecords: 1,
  response: [
    {
      jobTitle: 'Senior Manager - Supply Chain Analytics',
      jobCode: 'ER/REQ/1001',
      requisitionId: 'ER/REQ/1001',
      jobDetailUrl: 'https://elasticruncareers.peoplestrong.com/job/detail/ER_REQ_1001',
      locationHierarchy: 'Pune, Maharashtra, India',
      organizationUnit: 'Analytics',
      employmentTenureType: 'Full Time',
      expRange: '5-8 years',
      jobPostedDate: '2026-07-11',
      jobClosureDate: '2026-08-11',
      skills: {
        mustTohave: ['SQL', 'Python'],
        goodtohave: ['Supply chain'],
      },
      jobDescription: '<p>Build analytics for fulfilment operations.</p>',
    },
  ],
  messageCode: {
    code: 200,
    messages: 'success',
  },
  campusHiring: 0,
  solrSearch: true,
}

const emptyPayload = {
  totalRecords: 0,
  response: null,
  messageCode: {
    code: 200,
    messages: 'success',
  },
  campusHiring: 0,
  solrSearch: true,
}

const loadElasticRunModule = async () => {
  try {
    return await import('../../scraper/elasticrun/script.js')
  } catch {
    assert.fail('Expected ElasticRun scraper module at ../../scraper/elasticrun/script.js')
  }
}

test('ElasticRun helpers stay pinned to the verified first-party careers shell and PeopleStrong handoff', async () => {
  const elasticRun = await loadElasticRunModule()

  assert.equal(elasticRun.SOURCE, 'elasticrun')
  assert.equal(elasticRun.COMPANY, 'ElasticRun')
  assert.equal(elasticRun.OFFICIAL_BRAND_NAME, 'ElasticRun')
  assert.equal(elasticRun.VERIFIED_ON, '2026-07-15')
  assert.equal(elasticRun.HOMEPAGE_URL, 'https://www.elastic.run/')
  assert.equal(elasticRun.CAREERS_PAGE_URL, 'https://www.elastic.run/careers')
  assert.equal(elasticRun.SITEMAP_URL, 'https://www.elastic.run/sitemap.xml')
  assert.equal(elasticRun.PORTAL_ORIGIN, 'https://elasticruncareers.peoplestrong.com')
  assert.equal(
    elasticRun.JOB_LISTINGS_URL,
    'https://elasticruncareers.peoplestrong.com/job/joblist',
  )
  assert.equal(elasticRun.DEFAULT_PAGE_SIZE, 20)
  assert.equal(
    elasticRun.buildApiUrl(),
    'https://elasticruncareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(
    elasticRun.buildApiUrl({ offset: 20, limit: 10 }),
    'https://elasticruncareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=20&limit=10',
  )
  assert.equal(
    elasticRun.buildJobDetailUrl('ER/REQ/1001'),
    'https://elasticruncareers.peoplestrong.com/job/detail/ER%2FREQ%2F1001',
  )
  assert.deepEqual(elasticRun.DEFAULT_SEARCH_BODY, {})
  assert.equal(elasticRun.buildPublicHeaders().Origin, 'https://elasticruncareers.peoplestrong.com')
  assert.equal(
    elasticRun.buildPublicHeaders().Referer,
    'https://elasticruncareers.peoplestrong.com/job/joblist',
  )
  assert.equal(elasticRun.hasOfficialCareersShell(careersShellHtml), true)
  assert.equal(
    elasticRun.extractClientBundleUrl(careersShellHtml),
    'https://www.elastic.run/assets/index-B4NC3wpI.js',
  )
  assert.equal(elasticRun.sitemapHasCareersRoute(sitemapXml), true)
  assert.equal(elasticRun.hasVerifiedCareersBundleHandoff(bundleSnippet), true)
  assert.equal(elasticRun.hasPublicPortalShell(portalShellHtml), true)
})

test('extractSearchResults maps public ElasticRun PeopleStrong listing fields', async () => {
  const elasticRun = await loadElasticRunModule()
  const jobs = elasticRun.extractSearchResults(samplePayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Manager - Supply Chain Analytics',
    company: 'ElasticRun',
    department: 'Analytics',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    jobId: 'ER/REQ/1001',
    requisitionId: 'ER/REQ/1001',
    sourceUrl: 'https://elasticruncareers.peoplestrong.com/job/detail/ER_REQ_1001',
    applyUrl: 'https://elasticruncareers.peoplestrong.com/job/detail/ER_REQ_1001',
    employmentType: 'Full Time',
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['SQL', 'Python', 'Supply chain'],
    postingDate: '2026-07-11',
    closingDate: '2026-08-11',
    jobDescription: 'Build analytics for fulfilment operations.',
  })
})

test('run verifies ElasticRun first-party careers publication and replays the live empty PeopleStrong jobs API', async () => {
  const elasticRun = await loadElasticRunModule()
  const pageRequests = []
  const textRequests = []
  const apiRequests = []

  const jobs = await elasticRun.createElasticRunScraper().run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === elasticRun.CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersShellHtml }
      }

      if (url === elasticRun.JOB_LISTINGS_URL) {
        return { status: 404, url, html: portalShellHtml }
      }

      throw new Error(`Unexpected ElasticRun page URL: ${url}`)
    },
    fetchText: async (url) => {
      textRequests.push(url)

      if (url === elasticRun.SITEMAP_URL) {
        return sitemapXml
      }

      if (url === 'https://www.elastic.run/assets/index-B4NC3wpI.js') {
        return bundleSnippet
      }

      throw new Error(`Unexpected ElasticRun text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })
      return emptyPayload
    },
  })

  assert.deepEqual(pageRequests, [
    elasticRun.CAREERS_PAGE_URL,
    elasticRun.JOB_LISTINGS_URL,
  ])
  assert.deepEqual(textRequests, [
    elasticRun.SITEMAP_URL,
    'https://www.elastic.run/assets/index-B4NC3wpI.js',
  ])
  assert.equal(apiRequests.length, 1)
  assert.equal(apiRequests[0].url, elasticRun.buildApiUrl())
  assert.equal(apiRequests[0].options.method, 'POST')
  assert.equal(apiRequests[0].options.body, JSON.stringify(elasticRun.DEFAULT_SEARCH_BODY))
  assert.equal(apiRequests[0].options.headers.Origin, 'https://elasticruncareers.peoplestrong.com')
  assert.equal(
    apiRequests[0].options.headers.Referer,
    'https://elasticruncareers.peoplestrong.com/job/joblist',
  )
  assert.deepEqual(jobs, [])
})

test('ElasticRun fails closed when the published careers route or PeopleStrong handoff drifts', async () => {
  const elasticRun = await loadElasticRunModule()

  await assert.rejects(
    elasticRun.createElasticRunScraper().run({
      fetchPage: async (url) => {
        if (url === elasticRun.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersShellHtml }
        }

        throw new Error(`Unexpected ElasticRun page URL: ${url}`)
      },
      fetchText: async (url) => {
        if (url === elasticRun.SITEMAP_URL) {
          return '<?xml version="1.0"?><urlset></urlset>'
        }

        throw new Error(`Unexpected ElasticRun text URL: ${url}`)
      },
    }),
    /sitemap no longer publishes the known careers route/i,
  )

  await assert.rejects(
    elasticRun.createElasticRunScraper().run({
      fetchPage: async (url) => {
        if (url === elasticRun.CAREERS_PAGE_URL) {
          return { status: 200, url, html: careersShellHtml }
        }

        throw new Error(`Unexpected ElasticRun page URL: ${url}`)
      },
      fetchText: async (url) => {
        if (url === elasticRun.SITEMAP_URL) {
          return sitemapXml
        }

        if (url === 'https://www.elastic.run/assets/index-B4NC3wpI.js') {
          return bundleSnippet.replace(
            'https://elasticruncareers.peoplestrong.com/job/joblist',
            'https://example.com/jobs',
          )
        }

        throw new Error(`Unexpected ElasticRun text URL: ${url}`)
      },
    }),
    /known PeopleStrong handoff/i,
  )
})
