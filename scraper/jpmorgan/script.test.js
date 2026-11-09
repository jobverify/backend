import assert from 'node:assert/strict'
import test from 'node:test'

const listingPayload = {
  items: [{
    Limit: 24,
    TotalJobsCount: 2,
    requisitionList: [
      {
        Id: '210680354',
        Title: 'Software Engineer III, Spark Developer',
        PostedDate: '2026-07-07',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Hyderabad, Telangana, India',
        JobFamily: 'Software Engineering',
        JobFunction: 'Technology',
        WorkplaceType: '',
        ShortDescriptionStr: 'Design and deliver market-leading technology products in a secure and scalable way.',
        secondaryLocations: [],
      },
      {
        Id: '999999999',
        Title: 'US-only role',
        PostedDate: '2026-07-07',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'New York, New York, United States',
        JobFamily: 'Operations',
        JobFunction: 'Operations',
        WorkplaceType: '',
        ShortDescriptionStr: 'Should be filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '210680354',
    Title: 'Software Engineer III, Spark Developer',
    PrimaryLocation: 'Hyderabad, Telangana, India',
    JobFunction: 'Technology',
    ExternalPostedStartDate: '2026-07-07T13:27:21+00:00',
    ExternalPostedEndDate: '2026-07-14T04:00:00+00:00',
    JobSchedule: 'Full time',
    ShortDescriptionStr: 'Design and deliver market-leading technology products in a secure and scalable way as a seasoned member of an agile team',
    ExternalDescriptionStr: '<p>We have an exciting and rewarding opportunity for you to take your software engineering career to the next level.</p><p><strong>Job responsibilities</strong></p><ul><li>Executes software solutions</li><li>Creates secure and high-quality production code</li></ul>',
    ExternalQualificationsStr: '<p>Formal training or certification in software engineering concepts and 3+ years of applied experience.</p>',
  }],
}

test('JP Morgan scraper normalizes Oracle Cloud India requisitions and enriches detail fields', async () => {
  const jpmorgan = await import('./script.js')
  const requestedUrls = []

  assert.equal(
    jpmorgan.LISTING_API_BASE_URL,
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    jpmorgan.DETAIL_API_BASE_URL,
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    jpmorgan.PUBLIC_JOBS_BASE_URL,
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/',
  )
  assert.equal(jpmorgan.SITE_NUMBER, 'CX_1001')
  assert.equal(typeof jpmorgan.extractSearchResults, 'function')
  assert.equal(typeof jpmorgan.extractJobDetail, 'function')
  assert.equal(typeof jpmorgan.createJPMorganScraper, 'function')

  assert.equal(
    jpmorgan.buildSearchUrl(),
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=24,offset=0,location=India',
  )
  assert.equal(
    jpmorgan.buildJobDetailUrl('210680354'),
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210680354',
  )

  const listings = jpmorgan.extractSearchResults(listingPayload)
  assert.deepEqual(listings, [{
    title: 'Software Engineer III, Spark Developer',
    company: 'JP Morgan',
    department: 'Technology',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '210680354',
    requisitionId: '210680354',
    sourceUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210680354',
    applyUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210680354',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-07',
    closingDate: null,
    jobDescription: 'Design and deliver market-leading technology products in a secure and scalable way.',
  }])

  const detail = jpmorgan.extractJobDetail(detailPayload, listings[0])
  assert.equal(detail.title, 'Software Engineer III, Spark Developer')
  assert.equal(detail.department, 'Technology')
  assert.equal(detail.location, 'Hyderabad, Telangana, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.postingDate, '2026-07-07')
  assert.equal(detail.closingDate, '2026-07-14')
  assert.equal(detail.minimumQualification, 'Formal training or certification in software engineering concepts and 3+ years of applied experience.')
  assert.match(detail.jobDescription, /software engineering career to the next level/i)
  assert.match(detail.jobDescription, /Executes software solutions/i)
  assert.match(detail.jobDescription, /Creates secure and high-quality production code/i)

  const jobs = await jpmorgan.createJPMorganScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === jpmorgan.buildSearchUrl({ page: 0 })) return listingPayload
      if (url === `${jpmorgan.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1001`) {
        return detailPayload
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    jpmorgan.buildSearchUrl({ page: 0 }),
    `${jpmorgan.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1001`,
    jpmorgan.buildSearchUrl({ page: 0 }),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'jpmorgan')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
