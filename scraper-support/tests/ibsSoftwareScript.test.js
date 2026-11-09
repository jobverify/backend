import assert from 'node:assert/strict'
import test from 'node:test'

const searchPayload = {
  items: [{
    Limit: 5,
    TotalJobsCount: 8,
    requisitionList: [
      {
        Id: '300000001234567',
        Title: 'Senior Software Engineer',
        Department: 'Product Engineering',
        PrimaryLocation: 'Trivandrum, Kerala, India',
        PrimaryLocationCountry: 'IN',
        JobSchedule: 'Full time',
        PostedDate: '2026-06-30',
        StudyLevel: "Bachelor's degree in Computer Science",
        ShortDescriptionStr: 'Build airline retailing systems for global travel customers.',
      },
      {
        Id: '300000001234568',
        Title: 'Platform Engineer',
        Department: 'Product Engineering',
        PrimaryLocation: 'Dubai, United Arab Emirates',
        PrimaryLocationCountry: 'AE',
        JobSchedule: 'Full time',
        PostedDate: '2026-06-30',
        ShortDescriptionStr: 'This non-India role should be filtered out.',
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '300000001234567',
    Title: 'Senior Software Engineer',
    Department: 'Product Engineering',
    PrimaryLocation: 'Trivandrum, Kerala, India',
    PrimaryLocationCountry: 'IN',
    JobSchedule: 'Full time',
    StudyLevel: "Bachelor's degree in Computer Science",
    ExternalPostedStartDate: '2026-06-30',
    ExternalPostedEndDate: '2026-07-30',
    ExternalDescriptionStr: '<p>Build airline retailing systems for global travel customers.</p>',
    ExternalResponsibilitiesStr: '<ul><li>Design APIs</li><li>Ship services</li></ul>',
    ExternalQualificationsStr: '<p>Node.js and distributed systems experience.</p>',
    skills: [
      { Skill: 'Node.js' },
      { Skill: 'Distributed Systems' },
    ],
  }],
}

test('IBS Software scraper normalizes India Oracle CE requisitions and enriches them end to end', async () => {
  const ibsSoftware = await import('../../scraper/ibssoftware/script.js')
  const requestedUrls = []

  assert.equal(
    ibsSoftware.LISTING_API_BASE_URL,
    'https://fa-etbm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    ibsSoftware.DETAIL_API_BASE_URL,
    'https://fa-etbm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    ibsSoftware.PUBLIC_JOBS_BASE_URL,
    'https://fa-etbm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  )
  assert.equal(ibsSoftware.SITE_NUMBER, 'CX_1')
  assert.equal(typeof ibsSoftware.extractSearchResults, 'function')
  assert.equal(typeof ibsSoftware.extractJobDetail, 'function')
  assert.equal(typeof ibsSoftware.createIbsSoftwareScraper, 'function')
  assert.equal(typeof ibsSoftware.run, 'function')

  assert.equal(
    ibsSoftware.buildSearchUrl(),
    'https://fa-etbm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,requisitionList.requisitionFlexFields&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    ibsSoftware.buildJobDetailUrl('300000001234567'),
    'https://fa-etbm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/300000001234567',
  )

  const listings = ibsSoftware.extractSearchResults(searchPayload)
  assert.deepEqual(listings, [{
    title: 'Senior Software Engineer',
    company: 'IBS Software',
    department: 'Product Engineering',
    location: 'Trivandrum, Kerala, India',
    city: 'Trivandrum',
    jobId: '300000001234567',
    requisitionId: '300000001234567',
    sourceUrl: 'https://fa-etbm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/300000001234567',
    applyUrl: 'https://fa-etbm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/300000001234567',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: "Bachelor's degree in Computer Science",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30',
    closingDate: null,
    jobDescription: 'Build airline retailing systems for global travel customers.',
  }])

  const detail = ibsSoftware.extractJobDetail(detailPayload, listings[0])
  assert.equal(detail.title, 'Senior Software Engineer')
  assert.equal(detail.location, 'Trivandrum, Kerala, India')
  assert.equal(detail.city, 'Trivandrum')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.minimumQualification, "Bachelor's degree in Computer Science")
  assert.deepEqual(detail.requiredSkills, ['Node.js', 'Distributed Systems'])
  assert.equal(detail.postingDate, '2026-06-30')
  assert.equal(detail.closingDate, '2026-07-30')
  assert.match(detail.jobDescription, /Build airline retailing systems/i)
  assert.match(detail.jobDescription, /Design APIs/i)
  assert.match(detail.jobDescription, /Ship services/i)

  const jobs = await ibsSoftware.createIbsSoftwareScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === ibsSoftware.buildSearchUrl({ page: 0 })) return searchPayload
      if (url === `${ibsSoftware.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`) {
        return detailPayload
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    ibsSoftware.buildSearchUrl({ page: 0 }),
    `${ibsSoftware.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'ibssoftware')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[0].title, 'Senior Software Engineer')
})
