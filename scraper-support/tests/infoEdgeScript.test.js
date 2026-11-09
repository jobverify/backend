import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const firstListingRecord = {
  companyId: 15578, id: 16072, status: 1, careerSiteUrl: 'careers.infoedge.com',
  jobTitle: 'Lead UI Designer',
  jobUrl: 'lead-ui-designer-noida-2026071413401714',
  jobCode: '16072',
  newJobCode: '16072',
  referenceNumber: '13492',
  location: 'Noida',
  locAgg: 'Noida, Uttar Pradesh, India',
  DepartmentName: 'Design',
  departmentName: 'All Departments',
  createDate: '14-Jul-2026',
  yrsOfExperience: '5.0 to 8.0 Years ',
  shortDescription: '<p>Create consumer-first experiences.</p>',
  mandatorySkills: ['Interaction Design', 'Visual Design'],
  jobLocationRecord: [
    {
      formattedLocation: 'Noida, Uttar Pradesh, India',
      country: 'India',
      city: 'Noida',
      state: 'Uttar Pradesh',
    },
  ],
}

const secondListingRecord = {
  companyId: 15578, id: 16055, status: 1, careerSiteUrl: 'careers.infoedge.com',
  jobTitle: 'Senior Product Designer',
  jobUrl: 'senior-product-designer-noida-2026071310101010',
  jobCode: '16055',
  newJobCode: '16055',
  referenceNumber: '13480',
  location: 'Noida',
  locAgg: 'Noida, Uttar Pradesh, India',
  DepartmentName: 'Design',
  departmentName: 'All Departments',
  createDate: '13-Jul-2026',
  yrsOfExperience: '4.0 to 7.0 Years ',
  shortDescription: '<p>Own end-to-end product design.</p>',
  mandatorySkills: ['Product Design', 'Figma'],
  jobLocationRecord: [
    {
      formattedLocation: 'Noida, Uttar Pradesh, India',
      country: 'India',
      city: 'Noida',
      state: 'Uttar Pradesh',
    },
  ],
}

const nonIndiaListingRecord = {
  companyId: 15578, id: 77777, status: 1, careerSiteUrl: 'careers.infoedge.com',
  jobTitle: 'US Sales Leader',
  jobUrl: 'us-sales-leader-new-york-2026071110101010',
  jobCode: '77777',
  referenceNumber: '77777',
  location: 'New York',
  locAgg: 'New York, United States',
  DepartmentName: 'Sales',
  createDate: '11-Jul-2026',
  jobLocationRecord: [
    {
      formattedLocation: 'New York, United States',
      country: 'United States',
      city: 'New York',
      state: 'New York',
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
      paginationHowMuch: '2',
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
      paginationHowMuch: '2',
    },
    totalCount: 3,
  },
}

const firstDetailPayload = {
  companyId: 15578, id: 16072, status: 1, careerSiteUrl: 'careers.infoedge.com',
  jobTitle: 'Lead UI Designer',
  jobCode: 16072,
  jobUrl: 'lead-ui-designer-noida-2026071413401714',
  referenceNumber: '13492',
  location: 'Noida',
  departmentName: 'All Departments',
  createdDate: '14-Jul-2026',
  jobConfigurationData: {
    Description: '<p><strong>About Info Edge</strong></p><p>Design intuitive products.</p>',
    'Skills Required': 'Interaction Design, Visual Design, UX Research',
    Location: 'Noida',
    'Years Of Exp': '5 to 8 years',
  },
}

const secondDetailPayload = {
  companyId: 15578, id: 16055, status: 1, careerSiteUrl: 'careers.infoedge.com',
  jobTitle: 'Senior Product Designer',
  jobCode: 16055,
  jobUrl: 'senior-product-designer-noida-2026071310101010',
  referenceNumber: '13480',
  location: 'Noida',
  departmentName: 'All Departments',
  createdDate: '13-Jul-2026',
  jobConfigurationData: {
    Description: '<p>Own the product design system.</p>',
    'Skills Required': 'Product Design, Figma',
    Location: 'Noida',
    'Years Of Exp': '4 to 7 years',
  },
}

const placeholderListingRecord = {
  jobTitle: 'Senior Manager Corporate Sales',
  jobUrl: 'senior-manager-corporate-sales-gurgaon-2026042712404327',
  jobCode: '15446',
  referenceNumber: '14044',
  location: 'Gurgaon',
  locAgg: 'Gurugram, Haryana, India',
  DepartmentName: 'Sales',
  createDate: '27-Apr-2026',
  mandatorySkills: ['B2B Sales', 'Business Development', 'Client Acquisition'],
  jobLocationRecord: [
    {
      formattedLocation: 'Gurugram, Haryana, India',
      country: 'India',
      city: 'Gurugram',
      state: 'Haryana',
    },
  ],
}

const placeholderDetailPayload = {
  jobTitle: 'Senior Manager Corporate Sales',
  jobCode: 15446,
  jobUrl: 'senior-manager-corporate-sales-gurgaon-2026042712404327',
  referenceNumber: '14044',
  location: 'Gurgaon',
  createdDate: '27-Apr-2026',
  jobConfigurationData: {
    Description: 'JD',
    'Skills Required': 'B2B Sales,Business Development,Client Acquisition',
    Location: 'Gurgaon',
    'Job Title': 'Senior Manager Corporate Sales',
  },
}

const loadInfoEdgeModule = async () => {
  try {
    return await import('../../scraper/infoedge/script.js')
  } catch {
    assert.fail('Expected InfoEdge scraper module at ../../scraper/infoedge/script.js')
  }
}

test('InfoEdge pins the verified first-party careers and Zwayam contracts', async () => {
  const infoEdge = await loadInfoEdgeModule()

  assert.equal(infoEdge.SOURCE, 'infoedge')
  assert.equal(infoEdge.COMPANY_NAME, 'InfoEdge')
  assert.equal(infoEdge.OFFICIAL_BRAND_NAME, 'Info Edge India Ltd')
  assert.equal(infoEdge.CAREERS_LANDING_URL, 'https://careers.infoedge.com/infoedge/')
  assert.equal(infoEdge.CAREERS_URL, 'https://careers.infoedge.com/infoedge/jobslist')
  assert.equal(infoEdge.LISTING_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(infoEdge.DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(infoEdge.TENANT_GROUP_ID, 'G1')

  assert.deepEqual(infoEdge.buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.infoedge.com',
    companyId: 'MTU1Nzg=',
  })

  assert.deepEqual(infoEdge.buildSearchPayload({ page: 2 }), {
    filterCri: JSON.stringify({
      paginationStartNo: 12,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.infoedge.com',
    companyId: 'MTU1Nzg=',
  })

  assert.equal(
    infoEdge.buildJobDetailUrl('lead-ui-designer-noida-2026071413401714'),
    'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
  )

  assert.deepEqual(
    infoEdge.buildDetailRequest(firstListingRecord),
    {
      jobUrl: 'lead-ui-designer-noida-2026071413401714',
      externalSource: 'CareerSite',
      campusUrl: 'empty',
      companyId: '15578',
    },
  )
})

test('InfoEdge search extraction keeps only India jobs from the verified Zwayam payload', async () => {
  const infoEdge = await loadInfoEdgeModule()

  const jobs = infoEdge.extractSearchResults(firstListingPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Lead UI Designer',
    company: 'InfoEdge',
    department: 'Design',
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    jobId: '16072',
    requisitionId: '13492',
    sourceUrl: 'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
    applyUrl: 'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
    employmentType: null,
    experienceRequired: '5.0 to 8.0 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Interaction Design', 'Visual Design'],
    postingDate: '2026-07-14',
    closingDate: null,
    jobDescription: 'Create consumer-first experiences.',
    _listingRecord: firstListingRecord,
  })

  assert.deepEqual(infoEdge.extractPaginationSummary(firstListingPayload), {
    hasNext: true,
    pageSize: 2,
    totalCount: 3,
  })
})

test('InfoEdge detail extraction keeps the first-party detail route and richer Zwayam description', async () => {
  const infoEdge = await loadInfoEdgeModule()

  const detail = infoEdge.extractJobDetail(firstDetailPayload, {
    title: 'Lead UI Designer',
    department: 'Design',
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    jobId: '16072',
    requisitionId: '13492',
    sourceUrl: 'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
    applyUrl: 'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
    _listingRecord: firstListingRecord,
  })

  assert.deepEqual(detail, {
    title: 'Lead UI Designer',
    company: 'InfoEdge',
    department: 'Design',
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    jobId: '16072',
    requisitionId: '13492',
    sourceUrl: 'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
    applyUrl: 'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
    employmentType: null,
    experienceRequired: '5 to 8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Interaction Design', 'Visual Design', 'UX Research'],
    postingDate: '2026-07-14',
    closingDate: null,
    jobDescription: 'About Info Edge Design intuitive products.',
    publicExperienceChecked: true,
  })
})

test('InfoEdge detail extraction marks job-specific public Zwayam placeholder payloads as checked when experience is absent', async () => {
  const infoEdge = await loadInfoEdgeModule()

  const detail = infoEdge.extractJobDetail(placeholderDetailPayload, {
    title: 'Senior Manager Corporate Sales',
    department: 'Sales',
    location: 'Gurugram, Haryana, India',
    city: 'Gurugram',
    jobId: '15446',
    requisitionId: '14044',
    sourceUrl: 'https://careers.infoedge.com/infoedge/jobview/senior-manager-corporate-sales-gurgaon-2026042712404327',
    applyUrl: 'https://careers.infoedge.com/infoedge/jobview/senior-manager-corporate-sales-gurgaon-2026042712404327',
    _listingRecord: placeholderListingRecord,
  })

  assert.deepEqual(detail, {
    title: 'Senior Manager Corporate Sales',
    company: 'InfoEdge',
    department: 'Sales',
    location: 'Gurugram, Haryana, India',
    city: 'Gurgaon',
    jobId: '15446',
    requisitionId: '14044',
    sourceUrl: 'https://careers.infoedge.com/infoedge/jobview/senior-manager-corporate-sales-gurgaon-2026042712404327',
    applyUrl: 'https://careers.infoedge.com/infoedge/jobview/senior-manager-corporate-sales-gurgaon-2026042712404327',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['B2B Sales', 'Business Development', 'Client Acquisition'],
    postingDate: '2026-04-27',
    closingDate: null,
    jobDescription: null,
    publicExperienceChecked: true,
  })
})

test('createInfoEdgeScraper follows the verified first-party Zwayam flow across pages and decorates jobs', async () => {
  const infoEdge = await loadInfoEdgeModule()
  const requests = []

  const listingPayloads = [firstListingPayload, secondListingPayload]
  const detailPayloads = [firstDetailPayload, secondDetailPayload]

  const jobs = await infoEdge.createInfoEdgeScraper({ maxPages: 3, maxJobs: 5 }).run({
    fetchJson: async (url, options = {}) => {
      requests.push({ url, options })

      if (url === infoEdge.LISTING_API_URL) {
        return listingPayloads.shift() || firstListingPayload
      }

      if (url === infoEdge.DETAIL_API_URL) {
        return detailPayloads.shift()
      }

      throw new Error(`Unexpected URL ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  const expectedRequests = [
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
          domain: 'careers.infoedge.com',
          companyId: 'MTU1Nzg=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'lead-ui-designer-noida-2026071413401714',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15578',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs/search',
      options: {
        method: 'POST',
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
          domain: 'careers.infoedge.com',
          companyId: 'MTU1Nzg=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'senior-product-designer-noida-2026071310101010',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15578',
        },
      },
    },
  ]
  expectedRequests.push(expectedRequests[0])
  assert.deepEqual(requests.filter(request => request.url === infoEdge.LISTING_API_URL), expectedRequests.filter(request => request.url === infoEdge.LISTING_API_URL))
  assert.deepEqual(requests.filter(request => request.url === infoEdge.DETAIL_API_URL), expectedRequests.filter(request => request.url === infoEdge.DETAIL_API_URL))

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].jobId, '16072')
  assert.equal(jobs[0].source, 'infoedge')
  assert.equal(jobs[0].company, 'InfoEdge')
  assert.equal(
    jobs[0].link,
    'https://careers.infoedge.com/infoedge/jobview/lead-ui-designer-noida-2026071413401714',
  )
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].jobId, '16055')
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
})

test('createInfoEdgeScraper overlaps public detail requests so large India batches do not time out sequentially', async () => {
  const infoEdge = await loadInfoEdgeModule()
  let activeDetails = 0
  let maxActiveDetails = 0
  const concurrentListingPayload = {
    data: {
      data: [
        { _source: firstListingRecord },
        { _source: secondListingRecord },
      ],
      hasMoreData: false,
      facetedSearchConfig: {
        paginationHowMuch: '2',
      },
      totalCount: 2,
    },
  }

  const jobs = await infoEdge.createInfoEdgeScraper({ maxPages: 1, maxJobs: 5 }).run({
    fetchJson: async (url, options = {}) => {
      if (url === infoEdge.LISTING_API_URL) {
        return concurrentListingPayload
      }

      if (url === infoEdge.DETAIL_API_URL) {
        activeDetails += 1
        maxActiveDetails = Math.max(maxActiveDetails, activeDetails)
        await new Promise((resolve) => setTimeout(resolve, 20))
        activeDetails -= 1

        return options.json?.jobUrl === firstListingRecord.jobUrl
          ? firstDetailPayload
          : secondDetailPayload
      }

      throw new Error(`Unexpected URL ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 2)
  assert.ok(maxActiveDetails > 1, `expected overlapping detail fetches, saw max concurrency ${maxActiveDetails}`)
})
