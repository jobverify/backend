import assert from 'node:assert/strict'
import test from 'node:test'

const samplePayload = {
  totalRecords: 1,
  response: [
    {
      jobTitle: 'Senior Software Engineer',
      jobCode: 'IM-REQ-123',
      requisitionId: 'IM-REQ-123',
      jobDetailUrl: 'https://imcareers.peoplestrong.com/job/detail/IM-REQ-123',
      locationHierarchy: 'Bengaluru, Karnataka, India',
      organizationUnit: 'Technology',
      employmentTenureType: 'Full Time',
      expRange: '4-8 years',
      jobPostedDate: '2026-07-01',
      jobClosureDate: '2026-08-01',
      skills: {
        mustTohave: ['Node.js', 'Scraping'],
        goodtohave: ['Playwright'],
      },
      jobDescription: '<p>Build public-job ingestion systems.</p>',
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

const loadInfraMarketModule = async () => {
  try {
    return await import('../../scraper/inframarket/script.js')
  } catch {
    assert.fail('Expected Infra.Market scraper module at ../../scraper/inframarket/script.js')
  }
}

test('buildApiUrl and buildJobDetailUrl stay pinned to the public Infra.Market PeopleStrong portal', async () => {
  const infraMarket = await loadInfraMarketModule()

  assert.equal(infraMarket.DEFAULT_PAGE_SIZE, 20)
  assert.equal(
    infraMarket.buildApiUrl(),
    'https://imcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(
    infraMarket.buildApiUrl({ offset: 20, limit: 10 }),
    'https://imcareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=20&limit=10',
  )
  assert.equal(
    infraMarket.buildJobDetailUrl('IM-REQ-123'),
    'https://imcareers.peoplestrong.com/job/detail/IM-REQ-123',
  )
  assert.deepEqual(infraMarket.DEFAULT_SEARCH_BODY, {
    bandList: [],
    gradeList: [],
    bandIDList: [],
    gradeIDList: [],
    employeeCategoryLabelList: [],
  })
  assert.equal(infraMarket.buildPublicHeaders().Origin, 'https://imcareers.peoplestrong.com')
  assert.equal(infraMarket.buildPublicHeaders().Referer, 'https://imcareers.peoplestrong.com/job/joblist')
})

test('extractSearchResults maps public PeopleStrong listing fields for Infra.Market', async () => {
  const infraMarket = await loadInfraMarketModule()
  const jobs = infraMarket.extractSearchResults(samplePayload)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'Infra.Market',
    department: 'Technology',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'IM-REQ-123',
    requisitionId: 'IM-REQ-123',
    sourceUrl: 'https://imcareers.peoplestrong.com/job/detail/IM-REQ-123',
    applyUrl: 'https://imcareers.peoplestrong.com/job/detail/IM-REQ-123',
    employmentType: 'Full Time',
    experienceRequired: '4-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Node.js', 'Scraping', 'Playwright'],
    postingDate: '2026-07-01',
    closingDate: '2026-08-01',
    jobDescription: '<p>Build public-job ingestion systems.</p>',
  })
})

test('run replays the verified empty public Infra.Market PeopleStrong feed and decorates runner metadata', async () => {
  const infraMarket = await loadInfraMarketModule()
  const requests = []

  const jobs = await infraMarket.createInfraMarketScraper().run({
    fetchJson: async (url, options = {}) => {
      requests.push({ url, options })
      return emptyPayload
    },
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, infraMarket.buildApiUrl())
  assert.equal(requests[0].options.method, 'POST')
  assert.equal(requests[0].options.headers.Origin, 'https://imcareers.peoplestrong.com')
  assert.equal(requests[0].options.headers.Referer, 'https://imcareers.peoplestrong.com/job/joblist')
  assert.equal(requests[0].options.body, JSON.stringify(infraMarket.DEFAULT_SEARCH_BODY))
  assert.deepEqual(jobs, [])
})
