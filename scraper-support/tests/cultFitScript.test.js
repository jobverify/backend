import assert from 'node:assert/strict'
import test from 'node:test'

const loadCultFitModule = async () => {
  try {
    return await import('../../scraper/cultfit/script.js')
  } catch {
    assert.fail('Expected Cult.fit scraper module at ../../scraper/cultfit/script.js')
  }
}

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers | Cult.Fit</title>
    <base href="/cult/">
  </head>
  <body>
    <app-root></app-root>
    <script src="runtime.6a5af8ee.js" type="module"></script>
    <script src="main.4fa605e27fa5dd73.js" type="module"></script>
  </body>
</html>
`

const searchPayload = {
  data: {
    hasMoreData: false,
    totalCount: 2,
    facetedSearchConfig: {
      paginationHowMuch: '10',
    },
    data: [
      {
        _source: {
          jobTitle: 'Senior Product Manager',
          departmentName: 'Product',
          DepartmentName: 'Product',
          location: 'Bengaluru, Karnataka, India',
          locAgg: 'Bengaluru, Karnataka, India',
          jobCode: 'CULT-101',
          referenceNumber: 'REQ-CULT-101',
          refNumber: 'REQ-CULT-101',
          jobUrl: 'senior-product-manager-bengaluru',
          experienceUIField: '5-8 years',
          mandatorySkills: ['Product Management', 'Analytics'],
          createDate: '10-Jul-2026',
          shortDescription: '<p>Lead product discovery for the growth platform.</p>',
          otherStatusOne: 'Live',
          otherStatusTwo: 'Open',
          jobLocationRecord: [
            {
              city: 'Bengaluru',
              country: 'India',
              location: 'Bengaluru, Karnataka, India',
            },
          ],
        },
      },
      {
        _source: {
          jobTitle: 'US Finance Manager',
          departmentName: 'Finance',
          location: 'New York, United States',
          locAgg: 'New York, United States',
          jobCode: 'CULT-102',
          referenceNumber: 'REQ-CULT-102',
          jobUrl: 'us-finance-manager',
          experienceUIField: '6-10 years',
          mandatorySkills: ['Finance'],
          createDate: '09-Jul-2026',
          shortDescription: '<p>Non-India role should be ignored.</p>',
          otherStatusOne: 'Live',
          otherStatusTwo: 'Open',
          jobLocationRecord: [
            {
              city: 'New York',
              country: 'United States',
              location: 'New York, United States',
            },
          ],
        },
      },
    ],
  },
}

const detailPayload = {
  jobTitle: 'Senior Product Manager',
  jobCode: 'CULT-101',
  jobUrl: 'senior-product-manager-bengaluru',
  location: 'Bengaluru, Karnataka, India',
  locationDisplayForManageJobs: 'Bengaluru, Karnataka, India',
  referenceNumber: 'REQ-CULT-101',
  departmentName: 'Product',
  department: {
    departmentName: 'Product',
  },
  designation: 'Full Time',
  yrsOfExperience: '5 to 8 years',
  skillSet: 'Product Management, Analytics, Experimentation',
  createDate: '10-Jul-2026',
  longDescription:
    '<p>Lead product discovery for the growth platform.</p><p>Partner with analytics and design teams to ship new experiences.</p>',
  jobConfigurationData: {
    Department: 'Product',
    Location: 'Bengaluru, Karnataka, India',
    'Skills Required': 'Product Management, Analytics, Experimentation',
    Description:
      '<p>Lead product discovery for the growth platform.</p><p>Partner with analytics and design teams to ship new experiences.</p>',
    'Education/Qualification': 'MBA or equivalent experience',
    'Years Of Exp': '5 to 8 years',
    'Posted On': '10-Jul-2026',
  },
}

test('Cult.fit keeps the verified public Zwayam contract stable', async () => {
  const cultFit = await loadCultFitModule()

  assert.equal(cultFit.OFFICIAL_CAREERS_URL, 'https://careers.cult.fit/cult/')
  assert.equal(cultFit.CAREERS_BASE_URL, 'https://careers.cult.fit/cult')
  assert.equal(cultFit.LISTING_API_URL, 'https://public.zwayam.com/jobs/search')
  assert.equal(cultFit.DETAIL_API_URL, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(cultFit.hasVerifiedCareerPageSignals(careersHtml), true)
  assert.deepEqual(cultFit.buildSearchPayload(), {
    filterCri: JSON.stringify({
      paginationStartNo: 0,
      selectedCall: 'sort',
      sortCriteria: {
        name: 'modifiedDate',
        isAscending: false,
      },
      anyOfTheseWords: '',
    }),
    domain: 'careers.cult.fit',
    companyId: 'MTU0NzA=',
  })
  assert.equal(
    cultFit.buildJobDetailUrl('senior-product-manager-bengaluru'),
    'https://careers.cult.fit/cult/jobview/senior-product-manager-bengaluru',
  )
})

test('Cult.fit keeps only India jobs from the verified public Zwayam response', async () => {
  const cultFit = await loadCultFitModule()
  const jobs = cultFit.extractSearchResults(searchPayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Product Manager',
    company: 'Cult.fit',
    department: 'Product',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: 'CULT-101',
    requisitionId: 'REQ-CULT-101',
    sourceUrl: 'https://careers.cult.fit/cult/jobview/senior-product-manager-bengaluru',
    applyUrl: 'https://careers.cult.fit/cult/jobview/senior-product-manager-bengaluru',
    employmentType: null,
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Product Management', 'Analytics'],
    postingDate: '2026-07-10',
    closingDate: null,
    jobDescription: 'Lead product discovery for the growth platform.',
  })
})

test('Cult.fit detail enrichment preserves the first-party jobview apply URL', async () => {
  const cultFit = await loadCultFitModule()
  const detail = cultFit.extractJobDetail(detailPayload, {
    title: 'Senior Product Manager',
    department: 'Product',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: 'CULT-101',
    requisitionId: 'REQ-CULT-101',
    sourceUrl: 'https://careers.cult.fit/cult/jobview/senior-product-manager-bengaluru',
  })

  assert.deepEqual(detail, {
    title: 'Senior Product Manager',
    department: 'Product',
    location: 'Bengaluru',
    city: 'Bengaluru',
    jobId: 'CULT-101',
    requisitionId: 'REQ-CULT-101',
    sourceUrl: 'https://careers.cult.fit/cult/jobview/senior-product-manager-bengaluru',
    applyUrl: 'https://careers.cult.fit/cult/jobview/senior-product-manager-bengaluru',
    employmentType: 'Full Time',
    experienceRequired: '5-8 years',
    minimumQualification: 'MBA or equivalent experience',
    preferredQualification: null,
    requiredSkills: ['Product Management', 'Analytics', 'Experimentation'],
    postingDate: '2026-07-10',
    closingDate: null,
    jobDescription:
      'Lead product discovery for the growth platform. Partner with analytics and design teams to ship new experiences.',
  })
})

test('createCultFitScraper validates the first-party careers shell and decorates India jobs', async () => {
  const cultFit = await loadCultFitModule()
  const requests = []

  const jobs = await cultFit.createCultFitScraper({ maxPages: 1, maxJobs: 5 }).run({
    fetchText: async (url) => {
      requests.push({ url, type: 'text' })
      if (url === cultFit.OFFICIAL_CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Cult.fit careers URL ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requests.push({ url, type: 'json', options })
      if (url === cultFit.LISTING_API_URL) return searchPayload
      if (url === cultFit.DETAIL_API_URL) return detailPayload
      throw new Error(`Unexpected Cult.fit API URL ${url}`)
    },
  })

  assert.deepEqual(requests, [
    {
      url: 'https://careers.cult.fit/cult/',
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
          domain: 'careers.cult.fit',
          companyId: 'MTU0NzA=',
        },
      },
    },
    {
      url: 'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
      type: 'json',
      options: {
        method: 'POST',
        json: {
          jobUrl: 'senior-product-manager-bengaluru',
          externalSource: 'CareerSite',
          campusUrl: 'empty',
          companyId: '15470',
        },
      },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Cult.fit')
  assert.equal(jobs[0].source, 'cultfit')
  assert.equal(jobs[0].location, 'Bengaluru')
  assert.equal(jobs[0].applyUrl, 'https://careers.cult.fit/cult/jobview/senior-product-manager-bengaluru')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
