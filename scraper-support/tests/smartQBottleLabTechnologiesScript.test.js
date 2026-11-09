import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-04T15:30:00.000Z'

const firstPartyCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at SmartQ</title>
  </head>
  <body>
    <h1>Great food experiences start with&nbsp; great people.</h1>
    <a href="https://careers.thesmartq.com/thesmartq/">Explore Opportunities</a>
    <p>Bottle Lab Technologies Pvt Ltd</p>
    <p>What do we cook?</p>
  </body>
</html>
`

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Smartq | Careers</title>
    <base href="/thesmartq/">
    <script src="main.9e951b885743d792.js" type="module"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`

const tenantPayload = {
  responseStatus: 'SUCCESS',
  responseCode: 200,
  reponseObject: {
    name: 'SmartQ Bottle Lab Technologies Pvt Ltd',
    tenantGroupId: 'G1',
  },
}

const searchPayloadPage1 = {
  data: {
    hasMoreData: true,
    totalCount: 3,
    facetedSearchConfig: {
      paginationHowMuch: '2',
    },
    data: [
      {
        _source: {
          id: 2001,
          jobTitle: 'Kitchen Operations Manager',
          departmentName: 'Operations',
          DepartmentName: 'Operations',
          location: 'Bangalore, Karnataka, India',
          locationSeparatedbySlash: 'Bangalore, Karnataka, India',
          locationDisplayForManageJobs: 'Bangalore, Karnataka, India',
          jobCode: '10982',
          referenceNumber: '10982',
          jobUrl: 'kitchen-operations-manager-bangalore-karnataka-india-2026080410574753',
          experienceUIField: '8-12 years',
          mandatorySkills: ['Food Safety', 'Vendor Management'],
          createDate: '04-Aug-2026',
          otherStatusOne: 'Hidden',
          otherStatusTwo: 'Closed',
          jobVisibiltyLevel: 'N',
          appliesNotBlocked: 0,
          jobLocationRecord: [
            {
              city: 'Bengaluru',
              state: 'Karnataka',
              country: 'India',
              location: 'Bangalore, Karnataka, India',
            },
          ],
        },
      },
      {
        _source: {
          id: 2009,
          jobTitle: 'US Supply Manager',
          departmentName: 'Operations',
          location: 'Seattle, Washington, United States',
          locationDisplayForManageJobs: 'Seattle, Washington, United States',
          jobCode: '20999',
          referenceNumber: '20999',
          jobUrl: 'us-supply-manager-seattle-washington-united-states-202608011200',
          experienceUIField: '6-8 years',
          mandatorySkills: ['Supply Chain'],
          createDate: '04-Aug-2026',
          otherStatusOne: 'Hidden',
          otherStatusTwo: 'Closed',
          jobVisibiltyLevel: 'N',
          appliesNotBlocked: 0,
          jobLocationRecord: [
            {
              city: 'Seattle',
              state: 'Washington',
              country: 'United States',
              location: 'Seattle, Washington, United States',
            },
          ],
        },
      },
    ],
  },
}

const searchPayloadPage2 = {
  data: {
    hasMoreData: false,
    totalCount: 3,
    facetedSearchConfig: {
      paginationHowMuch: '2',
    },
    data: [
      {
        _source: {
          id: 2002,
          jobTitle: 'People Success Partner',
          departmentName: 'Human Resources',
          DepartmentName: 'Human Resources',
          location: 'Chennai, Tamil Nadu, India',
          locationDisplayForManageJobs: 'Chennai, Tamil Nadu, India',
          jobCode: '10979',
          referenceNumber: '10979',
          jobUrl: 'people-success-partner-chennai-tamil-nadu-india-2026073115390513',
          experienceUIField: '3-5 years',
          mandatorySkills: ['Employee Engagement', 'HR Operations'],
          createDate: '31-Jul-2026',
          otherStatusOne: 'Hidden',
          otherStatusTwo: 'Closed',
          jobVisibiltyLevel: 'N',
          appliesNotBlocked: 0,
          jobLocationRecord: [
            {
              city: 'Chennai',
              state: 'Tamil Nadu',
              country: 'India',
              location: 'Chennai, Tamil Nadu, India',
            },
          ],
        },
      },
    ],
  },
}

const kitchenOperationsManagerDetailPayload = {
  id: 2001,
  jobCode: '10982',
  referenceNumber: '10982',
  jobUrl: 'kitchen-operations-manager-bangalore-karnataka-india-2026080410574753',
  jobTitle: 'Kitchen Operations Manager',
  departmentName: 'Operations',
  employeeType: 'Full Time',
  location: 'Bangalore, Karnataka, India',
  skillSet: 'Food Safety, Vendor Management, Team Leadership',
  longDescription: '<p>Lead kitchen operations for enterprise cafeterias.</p>',
  role: '<p>Own food safety, vendor governance, and daily service excellence.</p>',
  jobLocationRecord: [
    {
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      location: 'Bangalore, Karnataka, India',
    },
  ],
  jobConfigurationData: {
    Department: 'Operations',
    Description: '<p>Lead kitchen operations for enterprise cafeterias.</p>',
    'Skills Required': 'Food Safety, Vendor Management, Team Leadership',
    Location: 'Bangalore, Karnataka, India',
    'Education/Qualification': 'Bachelor of Hotel Management',
    'Years Of Exp': '8 to 12 years',
    'Posted On': '04-Aug-2026',
  },
}

const peopleSuccessPartnerDetailPayload = {
  id: 2002,
  jobCode: '10979',
  referenceNumber: '10979',
  jobUrl: 'people-success-partner-chennai-tamil-nadu-india-2026073115390513',
  jobTitle: 'People Success Partner',
  departmentName: 'Human Resources',
  employeeType: 'Full Time',
  location: 'Chennai, Tamil Nadu, India',
  skillSet: 'Employee Engagement, HR Operations, Stakeholder Management',
  longDescription: '<p>Drive people programs for SmartQ teams in Chennai.</p>',
  role: '<p>Partner with business leaders on engagement and lifecycle processes.</p>',
  jobLocationRecord: [
    {
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      location: 'Chennai, Tamil Nadu, India',
    },
  ],
  jobConfigurationData: {
    Department: 'Human Resources',
    Description: '<p>Drive people programs for SmartQ teams in Chennai.</p>',
    'Skills Required': 'Employee Engagement, HR Operations, Stakeholder Management',
    Location: 'Chennai, Tamil Nadu, India',
    'Education/Qualification': 'MBA / Postgraduate in HR',
    'Years Of Exp': '3 to 5 years',
    'Posted On': '31-Jul-2026',
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/smartqbottlelabtechnologies/script.js')
  } catch {
    assert.fail('Expected SmartQ - Bottle Lab Technologies scraper module at ../../scraper/smartqbottlelabtechnologies/script.js')
  }
}

test('SmartQ - Bottle Lab Technologies extracts India jobs from the verified public SmartQ zwayam board', async () => {
  const smartQ = await loadModule()
  const jsonRequests = []

  assert.equal(smartQ.hasOfficialCareersSignal(firstPartyCareersHtml), true)
  assert.equal(smartQ.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(smartQ.hasVerifiedTenantPayload(tenantPayload), true)
  assert.deepEqual(smartQ.buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.thesmartq.com',
    companyId: 'MTU0ODE=',
  })
  assert.deepEqual(smartQ.extractPaginationSummary(searchPayloadPage1), {
    hasNext: true,
    pageSize: 2,
    nextOffset: 2,
    totalCount: 3,
  })

  const jobs = await smartQ.createSmartQBottleLabTechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === smartQ.CAREERS_URL) return firstPartyCareersHtml
      if (url === smartQ.JOBS_BOARD_URL) return jobsBoardHtml
      throw new Error(`Unexpected SmartQ HTML URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      jsonRequests.push({ url, options })

      if (url === smartQ.TENANT_LOOKUP_URL) return tenantPayload

      if (url === smartQ.SEARCH_API_URL) {
        const payload = JSON.parse(options.form.filterCri)
        return payload.paginationStartNo === 0
          ? searchPayloadPage1
          : searchPayloadPage2
      }

      if (url === smartQ.DETAIL_API_URL) {
        if (options.json.jobUrl === 'kitchen-operations-manager-bangalore-karnataka-india-2026080410574753') {
          return kitchenOperationsManagerDetailPayload
        }
        if (options.json.jobUrl === 'people-success-partner-chennai-tamil-nadu-india-2026073115390513') {
          return peopleSuccessPartnerDetailPayload
        }
      }

      throw new Error(`Unexpected SmartQ JSON URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jsonRequests, [
    {
      url: 'https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.thesmartq.com',
      options: {},
    },
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
        headers: {
          TenantGroupId: 'G1',
        },
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
          domain: 'careers.thesmartq.com',
          companyId: 'MTU0ODE=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        headers: {
          TenantGroupId: 'G1',
        },
        json: {
          jobUrl: 'kitchen-operations-manager-bangalore-karnataka-india-2026080410574753',
          externalSource: 'CAREERSITE',
          campusUrl: 'empty',
          companyId: '15481',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
        headers: {
          TenantGroupId: 'G1',
        },
        form: {
          filterCri: JSON.stringify({
            paginationStartNo: 2,
            selectedCall: 'sort',
            sortCriteria: {
              name: 'modifiedDate',
              isAscending: false,
            },
            anyOfTheseWords: '',
          }),
          domain: 'careers.thesmartq.com',
          companyId: 'MTU0ODE=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        headers: {
          TenantGroupId: 'G1',
        },
        json: {
          jobUrl: 'people-success-partner-chennai-tamil-nadu-india-2026073115390513',
          externalSource: 'CAREERSITE',
          campusUrl: 'empty',
          companyId: '15481',
        },
      },
    },
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      state: job.state,
      country: job.country,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      minimumQualification: job.minimumQualification,
      applyUrl: job.applyUrl,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Kitchen Operations Manager',
        location: 'Bangalore, Karnataka, India',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        jobId: '10982',
        requisitionId: '10982',
        minimumQualification: 'Bachelor of Hotel Management',
        applyUrl: 'https://careers.thesmartq.com/thesmartq/jobview/kitchen-operations-manager-bangalore-karnataka-india-2026080410574753?id=2001',
        source: 'smartqbottlelabtechnologies',
        scrapedAt: '2026-08-04T15:30:00.000Z',
      },
      {
        title: 'People Success Partner',
        location: 'Chennai, Tamil Nadu, India',
        city: 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        jobId: '10979',
        requisitionId: '10979',
        minimumQualification: 'MBA / Postgraduate in HR',
        applyUrl: 'https://careers.thesmartq.com/thesmartq/jobview/people-success-partner-chennai-tamil-nadu-india-2026073115390513?id=2002',
        source: 'smartqbottlelabtechnologies',
        scrapedAt: '2026-08-04T15:30:00.000Z',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Lead kitchen operations/i)
  assert.match(jobs[1].jobDescription, /Drive people programs/i)
})

test('SmartQ - Bottle Lab Technologies fails closed when the verified first-party careers page drifts', async () => {
  const smartQ = await loadModule()

  await assert.rejects(
    smartQ.createSmartQBottleLabTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === smartQ.CAREERS_URL) return '<html><body>unexpected</body></html>'
        throw new Error(`Unexpected URL ${url}`)
      },
    }),
    /first-party careers page no longer matches/i,
  )
})

test('SmartQ - Bottle Lab Technologies fails closed when the public jobs shell drifts', async () => {
  const smartQ = await loadModule()

  await assert.rejects(
    smartQ.createSmartQBottleLabTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === smartQ.CAREERS_URL) return firstPartyCareersHtml
        if (url === smartQ.JOBS_BOARD_URL) return '<html><body>unexpected</body></html>'
        throw new Error(`Unexpected URL ${url}`)
      },
    }),
    /public jobs shell no longer matches/i,
  )
})
