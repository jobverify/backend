import assert from 'node:assert/strict'
import test from 'node:test'

const loadTheMathCompanyModule = async () => {
  try {
    return await import('../../scraper/themathcompany/script.js')
  } catch {
    assert.fail('Expected TheMathCompany scraper module at ../../scraper/themathcompany/script.js')
  }
}

const searchPayload = {
  data: {
    hasMoreData: true,
    totalCount: 37,
    facetedSearchConfig: {
      paginationHowMuch: '10',
    },
    data: [
      {
        _source: {
          jobTitle: 'Senior Data Scientist',
          departmentName: 'Decision Sciences',
          DepartmentName: 'Decision Sciences',
          location: 'Bengaluru, Karnataka, India',
          locAgg: 'Bengaluru, Karnataka, India',
          jobCode: 'MATH-101',
          referenceNumber: 'REQ-MATH-101',
          refNumber: 'REQ-MATH-101',
          jobUrl: 'senior-data-scientist-bengaluru',
          experienceUIField: '3-5 years',
          mandatorySkills: [
            'Python',
            'Statistics',
          ],
          createDate: '01-Jul-2026',
          shortDescription: '<p>Build machine learning products for enterprise clients.</p>',
          jobLocationRecord: [
            {
              city: 'Bengaluru',
              country: 'India',
              location: 'Bengaluru, Karnataka, India',
              state: 'Karnataka',
            },
          ],
          otherStatusOne: 'Live',
          otherStatusTwo: 'Open',
        },
      },
      {
        _source: {
          jobTitle: 'Closed Analytics Engineer',
          departmentName: 'Decision Sciences',
          location: 'Bengaluru, Karnataka, India',
          locAgg: 'Bengaluru, Karnataka, India',
          jobCode: 'MATH-102',
          referenceNumber: 'REQ-MATH-102',
          jobUrl: 'closed-analytics-engineer',
          experienceUIField: '2-4 years',
          mandatorySkills: ['SQL'],
          createDate: '30-Jun-2026',
          shortDescription: '<p>Closed listing should be ignored.</p>',
          jobLocationRecord: [
            {
              city: 'Bengaluru',
              country: 'India',
              location: 'Bengaluru, Karnataka, India',
            },
          ],
          otherStatusOne: 'Archive',
          otherStatusTwo: 'Closed',
        },
      },
      {
        _source: {
          jobTitle: 'US Data Scientist',
          departmentName: 'Decision Sciences',
          location: 'New York, United States',
          locAgg: 'New York, United States',
          jobCode: 'MATH-103',
          referenceNumber: 'REQ-MATH-103',
          jobUrl: 'us-data-scientist',
          experienceUIField: '5-7 years',
          mandatorySkills: ['Python'],
          createDate: '29-Jun-2026',
          shortDescription: '<p>Non-India listing should be ignored.</p>',
          jobLocationRecord: [
            {
              city: 'New York',
              country: 'United States',
              location: 'New York, United States',
            },
          ],
          otherStatusOne: 'Live',
          otherStatusTwo: 'Open',
        },
      },
    ],
  },
}

const detailPayload = {
  jobTitle: 'Senior Data Scientist',
  jobCode: 'MATH-101',
  jobUrl: 'senior-data-scientist-bengaluru',
  location: 'Bengaluru, Karnataka, India',
  locationDisplayForManageJobs: 'Bengaluru, Karnataka, India',
  referenceNumber: 'REQ-MATH-101',
  departmentName: 'Decision Sciences',
  department: {
    departmentName: 'Decision Sciences',
  },
  designation: 'Full Time',
  yrsOfExperience: '3 to 5 years',
  skillSet: 'Python, Statistics, Machine Learning',
  createDate: '01-Jul-2026',
  endtDate: null,
  longDescription: '<p>Build machine learning products for enterprise clients.</p><p>Work with business stakeholders to deploy decision intelligence systems.</p>',
  jobConfigurationData: {
    Description: '<p>Build machine learning products for enterprise clients.</p><p>Work with business stakeholders to deploy decision intelligence systems.</p>',
    Department: 'Decision Sciences',
    'Skills Required': 'Python, Statistics, Machine Learning',
    Location: 'Bengaluru, Karnataka, India',
    'Education/Qualification': 'B.E./B.Tech',
    'Years Of Exp': '3 to 5 years',
    'Posted On': '01-Jul-2026',
  },
}

test('TheMathCompany Zwayam builders stay on the public careers contract', async () => {
  const theMathCompany = await loadTheMathCompanyModule()
  const {
    OFFICIAL_CAREERS_URL,
    EXPLORE_ROLES_URL,
    CAREERS_BASE_URL,
    LISTING_API_URL,
    DETAIL_API_URL,
    buildSearchPayload,
    buildJobDetailUrl,
    createTheMathCompanyScraper,
    run,
  } = theMathCompany

  assert.equal(OFFICIAL_CAREERS_URL, 'https://mathco.com/careers/')
  assert.equal(EXPLORE_ROLES_URL, 'https://mathco.com/explore-roles/')
  assert.equal(CAREERS_BASE_URL, 'https://careers.mathco.com/mathco')
  assert.equal(LISTING_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(typeof buildSearchPayload, 'function')
  assert.equal(typeof buildJobDetailUrl, 'function')
  assert.equal(typeof createTheMathCompanyScraper, 'function')
  assert.equal(typeof run, 'function')

  assert.deepEqual(buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.mathco.com',
    companyId: 'MTUyMTU=',
  })

  assert.deepEqual(buildSearchPayload({ page: 2, keywords: 'data science' }), {
    filterCri: JSON.stringify({
      paginationStartNo: 10,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: 'data science',
    }),
    domain: 'careers.mathco.com',
    companyId: 'MTUyMTU=',
  })

  assert.equal(
    buildJobDetailUrl('senior-data-scientist-bengaluru'),
    'https://careers.mathco.com/mathco/jobview/senior-data-scientist-bengaluru',
  )
})

test('extractSearchResults keeps only open India jobs from TheMathCompany Zwayam responses', async () => {
  const { extractSearchResults } = await loadTheMathCompanyModule()
  const jobs = extractSearchResults(searchPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Data Scientist',
    company: 'TheMathCompany',
    department: 'Decision Sciences',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: 'MATH-101',
    requisitionId: 'REQ-MATH-101',
    sourceUrl: 'https://careers.mathco.com/mathco/jobview/senior-data-scientist-bengaluru',
    applyUrl: 'https://careers.mathco.com/mathco/jobview/senior-data-scientist-bengaluru',
    employmentType: null,
    experienceRequired: '3-5 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Python',
      'Statistics',
    ],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Build machine learning products for enterprise clients.',
  })
})

test('extractPaginationSummary reads TheMathCompany page sizes from the careers response', async () => {
  const { extractPaginationSummary } = await loadTheMathCompanyModule()

  assert.deepEqual(extractPaginationSummary(searchPayload), {
    hasNext: true,
    pageSize: 10,
    nextOffset: 10,
    totalCount: 37,
  })
})

test('extractJobDetail keeps TheMathCompany apply links inline on the detail page', async () => {
  const { extractJobDetail } = await loadTheMathCompanyModule()
  const detail = extractJobDetail(detailPayload, {
    title: 'Senior Data Scientist',
    department: 'Decision Sciences',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: 'MATH-101',
    requisitionId: 'REQ-MATH-101',
    sourceUrl: 'https://careers.mathco.com/mathco/jobview/senior-data-scientist-bengaluru',
  })

  assert.deepEqual(detail, {
    title: 'Senior Data Scientist',
    department: 'Decision Sciences',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: 'MATH-101',
    requisitionId: 'REQ-MATH-101',
    sourceUrl: 'https://careers.mathco.com/mathco/jobview/senior-data-scientist-bengaluru',
    applyUrl: 'https://careers.mathco.com/mathco/jobview/senior-data-scientist-bengaluru',
    employmentType: 'Full Time',
    experienceRequired: '3-5 years',
    minimumQualification: 'B.E./B.Tech',
    preferredQualification: null,
    requiredSkills: [
      'Python',
      'Statistics',
      'Machine Learning',
    ],
    postingDate: '2026-07-01',
    closingDate: null,
    jobDescription: 'Build machine learning products for enterprise clients. Work with business stakeholders to deploy decision intelligence systems.',
  })
})

test('createTheMathCompanyScraper skips closed rows before detail fetch and decorates final jobs', async () => {
  const {
    LISTING_API_URL,
    DETAIL_API_URL,
    createTheMathCompanyScraper,
  } = await loadTheMathCompanyModule()

  const requests = []
  const jobs = await createTheMathCompanyScraper({ maxPages: 1, maxJobs: 5 }).run({
    fetchJson: async (url, options = {}) => {
      requests.push({ url, options })

      if (url === LISTING_API_URL) {
        return searchPayload
      }

      if (url === DETAIL_API_URL) {
        return detailPayload
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requests, [
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
          domain: 'careers.mathco.com',
          companyId: 'MTUyMTU=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'senior-data-scientist-bengaluru',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15215',
        },
      },
    },
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'MATH-101')
  assert.equal(jobs[0].source, 'themathcompany')
  assert.equal(jobs[0].company, 'TheMathCompany')
  assert.equal(
    jobs[0].link,
    'https://careers.mathco.com/mathco/jobview/senior-data-scientist-bengaluru',
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
