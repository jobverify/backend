import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const JOBS_LIST_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Capestart | Careers</title>
    <meta name="description" content="Capestart Careers" />
    <base href="/capestart/" />
  </head>
  <body>
    <iframe src="https://webhooks.naukri.com/zwayam?conversation=capestart_root"></iframe>
    <script src="main.92b6035ee93eb0a2.js" type="module"></script>
  </body>
</html>
`

const TENANT_PAYLOAD = {
  responseStatus: 'SUCCESS',
  responseCode: 200,
  reponseObject: {
    name: 'CapeStart Software Private Limited',
    tenantGroupId: 'G1',
  },
}

const SEARCH_PAYLOAD = {
  code: 200,
  data: {
    totalCount: 36,
    hasMoreData: true,
    facetedSearchConfig: {
      paginationHowMuch: '10',
    },
    data: [
      {
        _source: {
          jobTitle: 'Junior Frontend Developer',
          jobUrl: 'junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
          jobCode: 10493,
          referenceNumber: '10493',
          location: 'Nagercoil, Tamil Nadu, India',
          departmentName: 'Technology Services',
          shortDescription: '<p>We are looking for a motivated Junior Front End Developer.</p>',
          createDate: '2026-07-02T00:00:00.000Z',
        },
      },
    ],
  },
}

const DETAIL_PAYLOAD = {
  jobCode: 10493,
  referenceNumber: '10493',
  jobUrl: 'junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
  jobTitle: 'Junior Frontend Developer',
  location: 'Nagercoil, Tamil Nadu, India',
  companyId: 15371,
  createDate: '02-Jul-2026',
  departmentName: 'Technology Services',
  skillSet: 'HTML5, CSS3, JavaScript, React.js, Soft Skills',
  desiredSkill: 'Angular',
  eduqualification: "Bachelor's degree in Computer Science, Software Engineering, Information Technology",
  longDescription:
    '<p>We are looking for a motivated Junior Front End Developer to join our engineering team.</p>',
  role:
    '<ul><li><b>UI Development:</b> Translate wireframes and designs into reusable React components.</li></ul>',
}

const loadModule = async () => {
  try {
    return await import('../../scraper/capestart/script.js')
  } catch {
    assert.fail('Expected CapeStart scraper module at ../../scraper/capestart/script.js')
  }
}

test('CapeStart helpers stay pinned to the verified first-party shell, tenant lookup, and public Zwayam APIs', async () => {
  const capestart = await loadModule()

  assert.equal(capestart.SOURCE, 'capestart')
  assert.equal(capestart.COMPANY, 'CapeStart')
  assert.equal(capestart.OFFICIAL_BRAND_NAME, 'CapeStart')
  assert.equal(capestart.VERIFIED_ON, '2026-07-18')
  assert.equal(capestart.JOBS_LIST_URL, 'https://careers.capestart.com/capestart/jobslist')
  assert.equal(
    capestart.TENANT_LOOKUP_URL,
    'https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.capestart.com',
  )
  assert.equal(capestart.TENANT_GROUP_ID, 'G1')
  assert.equal(capestart.SEARCH_COMPANY_ID, 'MTUzNzE=')
  assert.equal(capestart.DETAIL_COMPANY_ID, '15371')
  assert.equal(capestart.SEARCH_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(capestart.DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(capestart.DEFAULT_PAGE_SIZE, 10)
  assert.equal(capestart.hasOfficialJobsListSignal(JOBS_LIST_HTML), true)
  assert.equal(capestart.hasOfficialJobsListSignal('<html><body>Other</body></html>'), false)
  assert.equal(capestart.hasVerifiedTenantPayload(TENANT_PAYLOAD), true)
  assert.equal(
    capestart.hasVerifiedTenantPayload({
      ...TENANT_PAYLOAD,
      reponseObject: {
        ...TENANT_PAYLOAD.reponseObject,
        name: 'Other Company',
      },
    }),
    false,
  )

  assert.deepEqual(capestart.buildSearchPayload({ page: 2, keywords: 'frontend' }), {
    filterCri: JSON.stringify({
      paginationStartNo: 10,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: 'frontend',
    }),
    domain: 'careers.capestart.com',
    companyId: 'MTUzNzE=',
  })

  assert.deepEqual(capestart.buildDetailPayload('junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783'), {
    jobUrl: 'junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
    externalSource: 'CareerSite',
    campusURL: 'empty',
    companyId: '15371',
  })

  const listings = capestart.extractSearchResults(SEARCH_PAYLOAD)
  assert.deepEqual(listings, [
    {
      title: 'Junior Frontend Developer',
      company: 'CapeStart',
      department: 'Technology Services',
      location: 'Nagercoil, Tamil Nadu, India',
      city: 'Nagercoil',
      country: 'India',
      jobId: '10493',
      requisitionId: '10493',
      sourceUrl:
        'https://careers.capestart.com/capestart/jobview/junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
      applyUrl:
        'https://careers.capestart.com/capestart/jobview/junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-02',
      closingDate: null,
      jobDescription: 'We are looking for a motivated Junior Front End Developer.',
    },
  ])

  assert.deepEqual(capestart.extractPaginationSummary(SEARCH_PAYLOAD), {
    hasNext: true,
    pageSize: 10,
    totalCount: 36,
  })

  assert.deepEqual(capestart.extractJobDetail(DETAIL_PAYLOAD, listings[0]), {
    title: 'Junior Frontend Developer',
    company: 'CapeStart',
    department: 'Technology Services',
    location: 'Nagercoil, Tamil Nadu, India',
    city: 'Nagercoil',
    country: 'India',
    jobId: '10493',
    requisitionId: '10493',
    sourceUrl:
      'https://careers.capestart.com/capestart/jobview/junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
    applyUrl:
      'https://careers.capestart.com/capestart/jobview/junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: "Bachelor's degree in Computer Science, Software Engineering, Information Technology",
    preferredQualification: 'Angular',
    requiredSkills: ['HTML5', 'CSS3', 'JavaScript', 'React.js', 'Soft Skills'],
    postingDate: '2026-07-02',
    closingDate: null,
    jobDescription:
      'We are looking for a motivated Junior Front End Developer to join our engineering team. UI Development: Translate wireframes and designs into reusable React components.',
  })
})

test('CapeStart run validates the first-party jobs shell, tenant lookup, search API, and detail API before returning jobs', async () => {
  const capestart = await loadModule()
  const requestedTextUrls = []
  const requestedJson = []

  const jobs = await capestart.createCapeStartScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === capestart.JOBS_LIST_URL) return JOBS_LIST_HTML
      throw new Error(`Unexpected CapeStart text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, options })
      if (url === capestart.TENANT_LOOKUP_URL) return TENANT_PAYLOAD
      if (url === capestart.SEARCH_API_URL) {
        assert.equal(options.method, 'POST')
        assert.equal(options.headers.TenantGroupId, 'G1')
        assert.equal(options.body.get('domain'), 'careers.capestart.com')
        assert.equal(options.body.get('companyId'), 'MTUzNzE=')
        return SEARCH_PAYLOAD
      }
      if (url === capestart.DETAIL_API_URL) {
        assert.equal(options.method, 'POST')
        assert.equal(options.headers.TenantGroupId, 'G1')
        assert.deepEqual(JSON.parse(options.body), {
          jobUrl: 'junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
          externalSource: 'CareerSite',
          campusURL: 'empty',
          companyId: '15371',
        })
        return DETAIL_PAYLOAD
      }
      throw new Error(`Unexpected CapeStart JSON URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedTextUrls, [capestart.JOBS_LIST_URL])
  assert.deepEqual(
    requestedJson.map((entry) => entry.url),
    [capestart.TENANT_LOOKUP_URL, capestart.SEARCH_API_URL, capestart.DETAIL_API_URL],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'capestart')
  assert.equal(jobs[0].company, 'CapeStart')
  assert.equal(
    jobs[0].link,
    'https://careers.capestart.com/capestart/jobview/junior-frontend-developer-nagercoil-tamil-nadu-india-2026070616014783',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('CapeStart fails closed when the first-party shell, tenant lookup, or detail payload drift materially', async () => {
  const capestart = await loadModule()

  await assert.rejects(
    capestart.createCapeStartScraper().run({
      fetchText: async () => '<html><body>Unexpected shell</body></html>',
      fetchJson: async () => TENANT_PAYLOAD,
    }),
    /verified CapeStart jobs shell/i,
  )

  await assert.rejects(
    capestart.createCapeStartScraper().run({
      fetchText: async () => JOBS_LIST_HTML,
      fetchJson: async (url) => {
        if (url === capestart.TENANT_LOOKUP_URL) {
          return {
            ...TENANT_PAYLOAD,
            reponseObject: {
              ...TENANT_PAYLOAD.reponseObject,
              name: 'Other Company',
            },
          }
        }
        throw new Error(`Unexpected CapeStart JSON URL: ${url}`)
      },
    }),
    /verified Zwayam tenant payload/i,
  )

  await assert.rejects(
    capestart.createCapeStartScraper({ maxJobs: 1 }).run({
      fetchText: async () => JOBS_LIST_HTML,
      fetchJson: async (url) => {
        if (url === capestart.TENANT_LOOKUP_URL) return TENANT_PAYLOAD
        if (url === capestart.SEARCH_API_URL) return SEARCH_PAYLOAD
        if (url === capestart.DETAIL_API_URL) return { jobTitle: null }
        throw new Error(`Unexpected CapeStart JSON URL: ${url}`)
      },
    }),
    /verified CapeStart detail payload/i,
  )
})
