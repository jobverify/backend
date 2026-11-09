import assert from 'node:assert/strict'
import test from 'node:test'

const loadRSystemsModule = async () => {
  try {
    return await import('../../scraper/rsystems/script.js')
  } catch {
    assert.fail('Expected R Systems scraper module at ../../scraper/rsystems/script.js')
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers | Rsystems</title>
    <meta name="description" content="We’re constantly on the lookout for innovative technologists ready to challenge our fast-paced, international environment. Join us now!">
    <base href="/rsystems/">
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.3c70035f58b722ed.js" type="module"></script>
    <script src="main.0f75f334183a9442.js" type="module"></script>
  </body>
</html>
`

const searchPayload = {
  data: {
    hasMoreData: true,
    totalCount: 14,
    facetedSearchConfig: {
      paginationHowMuch: '8',
    },
    data: [
      {
        _source: {
          jobTitle: 'Sr. BI Engineer',
          departmentName: 'INDIA-IT',
          DepartmentName: 'INDIA-IT',
          location: 'Bengaluru, Karnataka, India',
          locAgg: 'Bengaluru, Karnataka, India',
          jobCode: 15841,
          referenceNumber: '15841',
          refNumber: '15841',
          jobUrl: 'sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
          experienceUIField: '5-10 years',
          mandatorySkills: [
            'Power BI',
            'SQL',
          ],
          skillSet: 'Power BI,SQL',
          createDate: '06-Jul-2026',
          shortDescription: '<p>Build enterprise BI dashboards for customer delivery teams.</p>',
          companyId: 15807,
          text9: 'R Systems International Limited - IN01',
          displayStatus: 'Open',
          jobLocationRecord: [
            {
              city: 'Bengaluru',
              country: 'India',
              location: 'Bengaluru, Karnataka, India',
              state: 'Karnataka',
            },
          ],
        },
      },
      {
        _source: {
          jobTitle: 'ITIL Process Consultant',
          departmentName: 'INDIA-IT',
          location: 'Johannesburg, Gauteng, South Africa',
          locAgg: 'Johannesburg, Gauteng, South Africa',
          jobCode: 15871,
          referenceNumber: '15871',
          jobUrl: 'itil-process-consultant-johannesburg-gauteng-south-africa-2026070918162761',
          experienceUIField: '10-25 years',
          mandatorySkills: ['ITIL'],
          createDate: '09-Jul-2026',
          shortDescription: '<p>Global role that should not be included in the India lane.</p>',
          companyId: 15807,
          text9: 'R Systems International Limited - IN01',
          displayStatus: 'Open',
          jobLocationRecord: [
            {
              city: 'Johannesburg',
              country: 'South Africa',
              location: 'Johannesburg, Gauteng, South Africa',
            },
          ],
        },
      },
    ],
  },
}

const detailPayload = {
  jobTitle: 'Sr. BI Engineer',
  jobCode: 15841,
  jobUrl: 'sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
  location: 'Bengaluru, Karnataka, India',
  locationDisplayForManageJobs: 'Bengaluru, Karnataka, India',
  referenceNumber: '15841',
  departmentName: 'INDIA-IT',
  department: {
    departmentName: 'INDIA-IT',
  },
  designation: 'Full Time',
  yrsOfExperience: '5 to 10 Years',
  skillSet: 'Power BI,SQL',
  createDate: '06-Jul-2026',
  endtDate: null,
  longDescription: '<p>Build enterprise BI dashboards for customer delivery teams.</p><p>Support cutover readiness and post-go-live monitoring.</p>',
  jobConfigurationData: {
    Department: 'INDIA-IT',
    Location: 'Bengaluru, Karnataka, India',
    'Skills Required': 'Power BI, SQL',
    Description: '<p>Build enterprise BI dashboards for customer delivery teams.</p><p>Support cutover readiness and post-go-live monitoring.</p>',
    'Education/Qualification': 'Graduate',
    'Posted On': '06-Jul-2026',
    'Years Of Exp': '5 to 10 Years',
  },
}

test('R Systems Zwayam builders stay on the verified public careers contract', async () => {
  const rsystems = await loadRSystemsModule()
  const {
    OFFICIAL_CAREERS_URL,
    CAREERS_BASE_URL,
    LISTING_API_URL,
    DETAIL_API_URL,
    buildSearchPayload,
    buildJobDetailUrl,
    hasVerifiedCareerPageSignals,
    createRSystemsScraper,
    run,
  } = rsystems

  assert.equal(OFFICIAL_CAREERS_URL, 'https://careers.rsystems.com/rsystems/')
  assert.equal(CAREERS_BASE_URL, 'https://careers.rsystems.com/rsystems')
  assert.equal(LISTING_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(typeof buildSearchPayload, 'function')
  assert.equal(typeof buildJobDetailUrl, 'function')
  assert.equal(typeof hasVerifiedCareerPageSignals, 'function')
  assert.equal(typeof createRSystemsScraper, 'function')
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
    domain: 'careers.rsystems.com',
    companyId: 'MTU4MDc=',
  })

  assert.deepEqual(buildSearchPayload({ page: 2, keywords: 'power bi' }), {
    filterCri: JSON.stringify({
      paginationStartNo: 8,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: 'power bi',
    }),
    domain: 'careers.rsystems.com',
    companyId: 'MTU4MDc=',
  })

  assert.equal(
    buildJobDetailUrl('sr-bi-engineer-bengaluru-karnataka-india-202607061923281'),
    'https://careers.rsystems.com/rsystems/jobview/sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
  )
  assert.equal(hasVerifiedCareerPageSignals(careersHtml), true)
  assert.equal(hasVerifiedCareerPageSignals('<html><body>No trusted R Systems careers signals here</body></html>'), false)
})

test('extractSearchResults keeps only India jobs from the R Systems public careers board', async () => {
  const { extractSearchResults } = await loadRSystemsModule()
  const jobs = extractSearchResults(searchPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Sr. BI Engineer',
    company: 'R Systems',
    department: 'INDIA-IT',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: '15841',
    requisitionId: '15841',
    sourceUrl: 'https://careers.rsystems.com/rsystems/jobview/sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
    applyUrl: 'https://careers.rsystems.com/rsystems/jobview/sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
    employmentType: null,
    experienceRequired: '5-10 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Power BI',
      'SQL',
    ],
    postingDate: '2026-07-06',
    closingDate: null,
    jobDescription: 'Build enterprise BI dashboards for customer delivery teams.',
  })
})

test('extractPaginationSummary reads the R Systems page size from the careers response', async () => {
  const { extractPaginationSummary } = await loadRSystemsModule()

  assert.deepEqual(extractPaginationSummary(searchPayload), {
    hasNext: true,
    pageSize: 8,
    nextOffset: 8,
    totalCount: 14,
  })
})

test('extractJobDetail keeps the R Systems apply link inline on the detail page', async () => {
  const { extractJobDetail } = await loadRSystemsModule()
  const detail = extractJobDetail(detailPayload, {
    title: 'Sr. BI Engineer',
    department: 'INDIA-IT',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: '15841',
    requisitionId: '15841',
    sourceUrl: 'https://careers.rsystems.com/rsystems/jobview/sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
  })

  assert.deepEqual(detail, {
    title: 'Sr. BI Engineer',
    department: 'INDIA-IT',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: '15841',
    requisitionId: '15841',
    sourceUrl: 'https://careers.rsystems.com/rsystems/jobview/sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
    applyUrl: 'https://careers.rsystems.com/rsystems/jobview/sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
    employmentType: 'Full Time',
    experienceRequired: '5-10 years',
    minimumQualification: 'Graduate',
    preferredQualification: null,
    requiredSkills: [
      'Power BI',
      'SQL',
    ],
    postingDate: '2026-07-06',
    closingDate: null,
    jobDescription: 'Build enterprise BI dashboards for customer delivery teams. Support cutover readiness and post-go-live monitoring.',
  })
})

test('createRSystemsScraper validates the public careers page and decorates India jobs', async () => {
  const {
    OFFICIAL_CAREERS_URL,
    LISTING_API_URL,
    DETAIL_API_URL,
    createRSystemsScraper,
  } = await loadRSystemsModule()

  const requests = []
  const jobs = await createRSystemsScraper({ maxPages: 1, maxJobs: 5 }).run({
    fetchText: async (url) => {
      requests.push({ url, type: 'text' })
      if (url === OFFICIAL_CAREERS_URL) return careersHtml
      throw new Error(`Unexpected text URL ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requests.push({ url, type: 'json', options })

      if (url === LISTING_API_URL) return searchPayload
      if (url === DETAIL_API_URL) return detailPayload

      throw new Error(`Unexpected JSON URL ${url}`)
    },
  })

  assert.deepEqual(requests, [
    {
      url: 'https://careers.rsystems.com/rsystems/',
      type: 'text',
    },
    {
      url: 'https://public.zwayam.com/jobs/search',
      type: 'json',
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
          domain: 'careers.rsystems.com',
          companyId: 'MTU4MDc=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      type: 'json',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15807',
        },
      },
    },
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '15841')
  assert.equal(jobs[0].source, 'rsystems')
  assert.equal(jobs[0].company, 'R Systems')
  assert.equal(
    jobs[0].link,
    'https://careers.rsystems.com/rsystems/jobview/sr-bi-engineer-bengaluru-karnataka-india-202607061923281',
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})


test('R Systems accepts the current spaced brand title while retaining the verified Angular careers shell', async () => {
  const rSystems = await loadRSystemsModule()
  assert.equal(rSystems.hasVerifiedCareerPageSignals(careersHtml.replace('Careers | Rsystems', 'Careers | R Systems')), true)
  assert.equal(rSystems.hasVerifiedCareerPageSignals(careersHtml.replace('/rsystems/', '/another-company/')), false)
})
