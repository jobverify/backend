import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Where passion for design meets technology</title>
  </head>
  <body>
    <h2>Let&#8217;s shape the future of home interiors, together</h2>
    <a href="https://careers.livspace.com/livspace/">VIEW OPEN POSITIONS</a>
  </body>
</html>
`

const boardShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Livspace</title>
    <base href="/livspace/">
  </head>
  <body>
    <app-root></app-root>
    <script src="main.3a21edc16c1873b1.js"></script>
  </body>
</html>
`

const firstListingRecord = {
  jobTitle: 'Cluster Manager - Retail Ops',
  jobUrl: 'cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
  jobCode: '13405',
  newJobCode: '13405',
  referenceNumber: '13405',
  location: 'Pune,Maharashtra',
  locAgg: 'Pune, Maharashtra, India',
  DepartmentName: 'Residential Interior IN',
  createDate: '08-May-2026',
  yrsOfExperience: '10 to 20 Years ',
  shortDescription: '<p>Lead end-to-end operations across experience centres.</p>',
  mandatorySkills: ['Retail Store Operations', 'Cluster Operations'],
  jobLocationRecord: [
    {
      formattedLocation: 'Pune, Maharashtra, India',
      country: 'India',
      city: 'Pune',
      state: 'Maharashtra',
    },
  ],
}

const secondListingRecord = {
  jobTitle: 'Senior Recruitment Specialist',
  jobUrl: 'senior-recruitment-specialist-ahmedabad-gujarat-2026022010201010',
  jobCode: '12509',
  newJobCode: '12509',
  referenceNumber: '12509',
  location: 'Ahmedabad,Gujarat',
  locAgg: 'Ahmedabad, Gujarat, India',
  DepartmentName: 'People Team',
  createDate: '20-Feb-2026',
  yrsOfExperience: '1 to 3 Years ',
  shortDescription: '<p>Drive hiring for frontline and specialist roles.</p>',
  mandatorySkills: ['Communication', 'Recruiting'],
  jobLocationRecord: [
    {
      formattedLocation: 'Ahmedabad, Gujarat, India',
      country: 'India',
      city: 'Ahmedabad',
      state: 'Gujarat',
    },
  ],
}

const nonIndiaListingRecord = {
  jobTitle: 'Middle East Retail Leader',
  jobUrl: 'middle-east-retail-leader-dubai-2026021717171717',
  jobCode: '44444',
  newJobCode: '44444',
  referenceNumber: '44444',
  location: 'Dubai',
  locAgg: 'Dubai, United Arab Emirates',
  DepartmentName: 'International Retail',
  createDate: '17-Feb-2026',
  yrsOfExperience: '8 to 12 Years ',
  shortDescription: '<p>Lead the Middle East retail expansion.</p>',
  mandatorySkills: ['Retail Operations'],
  jobLocationRecord: [
    {
      formattedLocation: 'Dubai, United Arab Emirates',
      country: 'United Arab Emirates',
      city: 'Dubai',
      state: 'Dubai',
    },
  ],
}

const firstListingPayload = {
  data: {
    data: [
      { _source: firstListingRecord },
      { _source: nonIndiaListingRecord },
    ],
    hasMoreData: true,
    facetedSearchConfig: {
      paginationHowMuch: '9',
    },
    totalCount: 3,
  },
}

const secondListingPayload = {
  data: {
    data: [
      { _source: secondListingRecord },
    ],
    hasMoreData: false,
    facetedSearchConfig: {
      paginationHowMuch: '9',
    },
    totalCount: 3,
  },
}

const firstDetailPayload = {
  jobTitle: 'Cluster Manager - Retail Ops',
  jobCode: 13405,
  jobUrl: 'cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
  referenceNumber: '13405',
  location: 'Pune,Maharashtra',
  departmentName: 'Residential Interior IN',
  createdDate: '08-May-2026',
  jobLocationRecord: [
    {
      formattedLocation: 'Pune, Maharashtra, India',
      country: 'India',
      city: 'Pune',
      state: 'Maharashtra',
    },
  ],
  jobConfigurationData: {
    'Job Description': '<p>Lead end-to-end operations across experience centres.</p>',
    'Mandatory Skills': 'Retail Store Operations, Cluster Operations, Audit Management',
    Location: 'Pune,Maharashtra',
    Experience: '10 to 20 years',
  },
}

const secondDetailPayload = {
  jobTitle: 'Senior Recruitment Specialist',
  jobCode: 12509,
  jobUrl: 'senior-recruitment-specialist-ahmedabad-gujarat-2026022010201010',
  referenceNumber: '12509',
  location: 'Ahmedabad,Gujarat',
  departmentName: 'People Team',
  createdDate: '20-Feb-2026',
  workMode: 'In Office/On-site',
  jobLocationRecord: [
    {
      formattedLocation: 'Ahmedabad, Gujarat, India',
      country: 'India',
      city: 'Ahmedabad',
      state: 'Gujarat',
    },
  ],
  jobConfigurationData: {
    'Job Description': '<p>Drive hiring for frontline and specialist roles.</p>',
    'Mandatory Skills': 'Communication, Recruiting',
    Location: 'Ahmedabad,Gujarat',
    Experience: '1 to 3 years',
  },
}

const loadLivspaceModule = async () => {
  try {
    return await import('../../scraper/livspace/script.js')
  } catch {
    assert.fail('Expected Livspace scraper module at ../../scraper/livspace/script.js')
  }
}

test('Livspace pins the verified official careers handoff and public Zwayam board shell', async () => {
  const livspace = await loadLivspaceModule()

  assert.equal(livspace.SOURCE, 'livspace')
  assert.equal(livspace.COMPANY_NAME, 'Livspace')
  assert.equal(livspace.CAREERS_URL, 'https://www.livspace.com/in/careers')
  assert.equal(livspace.CAREERS_LANDING_URL, 'https://careers.livspace.com/livspace/')
  assert.equal(livspace.JOBS_LIST_URL, 'https://careers.livspace.com/livspace/jobslist')
  assert.equal(livspace.LISTING_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(livspace.DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(livspace.TENANT_GROUP_ID, 'G1')
  assert.equal(livspace.SEARCH_COMPANY_ID, 'MTU5MTk=')
  assert.equal(livspace.DETAIL_COMPANY_ID, '15919')
  assert.equal(livspace.VERIFIED_ON, '2026-10-03')
  assert.equal(livspace.hasOfficialCareersPageSignal(officialCareersPageHtml), true)
  assert.equal(
    livspace.extractZwayamHandoffUrl(officialCareersPageHtml),
    'https://careers.livspace.com/livspace/',
  )
  assert.equal(livspace.hasPublicBoardShell(boardShellHtml), true)

  assert.deepEqual(livspace.buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.livspace.com',
    companyId: 'MTU5MTk=',
  })

  assert.deepEqual(livspace.buildSearchPayload({ page: 2 }), {
    filterCri: JSON.stringify({
      paginationStartNo: 9,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.livspace.com',
    companyId: 'MTU5MTk=',
  })

  assert.equal(
    livspace.buildJobDetailUrl('cluster-manager-retail-ops-pune-maharashtra-2026051109291415'),
    'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
  )

  assert.deepEqual(livspace.buildDetailRequest(firstListingRecord), {
    jobUrl: 'cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
    externalSource: 'CareerSite',
    campusUrl: 'empty',
    companyId: '15919',
  })
})

test('Livspace search extraction keeps only India jobs from the verified Zwayam payload', async () => {
  const livspace = await loadLivspaceModule()

  const jobs = livspace.extractSearchResults(firstListingPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Cluster Manager - Retail Ops',
    company: 'Livspace',
    department: 'Residential Interior IN',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    jobId: '13405',
    requisitionId: '13405',
    sourceUrl:
      'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
    applyUrl:
      'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
    employmentType: null,
    experienceRequired: '10 to 20 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Retail Store Operations', 'Cluster Operations'],
    postingDate: '2026-05-08',
    closingDate: null,
    jobDescription: 'Lead end-to-end operations across experience centres.',
    _listingRecord: firstListingRecord,
  })

  assert.deepEqual(livspace.extractPaginationSummary(firstListingPayload), {
    hasNext: true,
    pageSize: 9,
    totalCount: 3,
  })
})

test('Livspace detail extraction keeps the first-party detail route and richer Zwayam fields', async () => {
  const livspace = await loadLivspaceModule()

  const detail = livspace.extractJobDetail(firstDetailPayload, {
    title: 'Cluster Manager - Retail Ops',
    department: 'Residential Interior IN',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    jobId: '13405',
    requisitionId: '13405',
    sourceUrl:
      'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
    applyUrl:
      'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
    _listingRecord: firstListingRecord,
  })

  assert.deepEqual(detail, {
    title: 'Cluster Manager - Retail Ops',
    company: 'Livspace',
    department: 'Residential Interior IN',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    jobId: '13405',
    requisitionId: '13405',
    sourceUrl:
      'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
    applyUrl:
      'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
    employmentType: null,
    experienceRequired: '10 to 20 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Retail Store Operations', 'Cluster Operations', 'Audit Management'],
    postingDate: '2026-05-08',
    closingDate: null,
    jobDescription: 'Lead end-to-end operations across experience centres.',
  })
})

test('createLivspaceScraper validates the official handoff, the board shell, and paginates the live Zwayam flow', async () => {
  const livspace = await loadLivspaceModule()
  const requestedPages = []
  const apiRequests = []
  const listingPayloads = [firstListingPayload, secondListingPayload]
  const detailPayloads = [firstDetailPayload, secondDetailPayload]

  const jobs = await livspace.createLivspaceScraper().run({
    fetchText: async (url) => {
      requestedPages.push(url)

      if (url === livspace.CAREERS_URL) return officialCareersPageHtml
      if (url === livspace.CAREERS_LANDING_URL) return boardShellHtml

      throw new Error(`Unexpected Livspace page URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      apiRequests.push({ url, options })

      if (url === livspace.LISTING_API_URL) {
        return listingPayloads.shift()
      }

      if (url === livspace.DETAIL_API_URL) {
        return detailPayloads.shift()
      }

      throw new Error(`Unexpected Livspace API URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedPages, [
    livspace.CAREERS_URL,
    livspace.CAREERS_LANDING_URL,
  ])

  assert.deepEqual(apiRequests, [
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
        form: {
          filterCri: JSON.stringify({
            paginationStartNo: 0,
            selectedCall: 'sort',
            sortCriteria: {
              name: 'modifiedDate',
              isAscending: false,
            },
            anyOfTheseWords: '',
          }),
          domain: 'careers.livspace.com',
          companyId: 'MTU5MTk=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15919',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
        form: {
          filterCri: JSON.stringify({
            paginationStartNo: 9,
            selectedCall: 'sort',
            sortCriteria: {
              name: 'modifiedDate',
              isAscending: false,
            },
            anyOfTheseWords: '',
          }),
          domain: 'careers.livspace.com',
          companyId: 'MTU5MTk=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'senior-recruitment-specialist-ahmedabad-gujarat-2026022010201010',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15919',
        },
      },
    },
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '13405')
  assert.equal(jobs[0].source, 'livspace')
  assert.equal(jobs[0].company, 'Livspace')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].companyCareerPage, 'https://www.livspace.com/in/careers')
  assert.equal(jobs[0].companyDomain, 'livspace.com')
  assert.equal(jobs[0].atsPlatform, 'zwayam')
  assert.equal(
    jobs[0].link,
    'https://careers.livspace.com/livspace/jobview/cluster-manager-retail-ops-pune-maharashtra-2026051109291415',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].jobId, '12509')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('Livspace fails closed when the verified official handoff or public board shell drifts', async () => {
  const livspace = await loadLivspaceModule()

  await assert.rejects(
    livspace.createLivspaceScraper().run({
      fetchText: async (url) => {
        if (url === livspace.CAREERS_URL) return '<html><body><h1>Placeholder</h1></body></html>'
        throw new Error(`Unexpected Livspace page URL: ${url}`)
      },
    }),
    /official careers page/i,
  )

  await assert.rejects(
    livspace.createLivspaceScraper().run({
      fetchText: async (url) => {
        if (url === livspace.CAREERS_URL) return officialCareersPageHtml
        if (url === livspace.CAREERS_LANDING_URL) {
          return '<html><head><title>Placeholder</title></head><body>broken</body></html>'
        }
        throw new Error(`Unexpected Livspace page URL: ${url}`)
      },
    }),
    /public zwayam board/i,
  )
})
