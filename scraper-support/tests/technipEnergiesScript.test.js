import assert from 'node:assert/strict'
import test from 'node:test'

const searchPayload = {
  items: [{
    Limit: 10,
    TotalJobsCount: 9,
    requisitionList: [
      {
        Id: '14116',
        Title: 'Process Engineer',
        Department: 'Engineering',
        PrimaryLocation: 'India',
        PrimaryLocationCountry: 'IN',
        PostedDate: '2026-07-09',
        StudyLevel: "Bachelor's Degree",
        ShortDescriptionStr: 'Deliver energy transition engineering projects.',
        secondaryLocations: [
          {
            Name: 'Mumbai, Maharashtra, India',
            CountryCode: 'IN',
          },
        ],
      },
      {
        Id: '29999',
        Title: 'Outside India Role',
        Department: 'Engineering',
        PrimaryLocation: 'Paris, France',
        PrimaryLocationCountry: 'FR',
        PostedDate: '2026-07-09',
        ShortDescriptionStr: 'Filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '14116',
    Title: 'Process Engineer',
    Department: 'Engineering',
    RequisitionType: 'Regular',
    JobSchedule: 'Full time',
    PrimaryLocation: 'India',
    PrimaryLocationCountry: 'IN',
    ExternalPostedStartDate: '2026-07-09T00:00:00+00:00',
    ExternalPostedEndDate: '2026-08-09T00:00:00+00:00',
    StudyLevel: "Bachelor's Degree",
    ExternalDescriptionStr: '<p>Deliver energy transition engineering projects.</p>',
    ExternalResponsibilitiesStr: '<ul><li>Design process systems</li><li>Support EPC execution</li></ul>',
    ExternalQualificationsStr: '<p>Experience in process engineering.</p>',
    secondaryLocations: [
      {
        Name: 'Mumbai, Maharashtra, India',
        CountryCode: 'IN',
      },
    ],
    skills: [
      { Skill: 'Process Engineering' },
      { Skill: 'EPC' },
    ],
  }],
}

test('Technip Energies scraper normalizes India Oracle CE requisitions and enriches them end to end', async () => {
  const technip = await import('../../scraper/technipenergies/script.js')
  const requestedUrls = []

  assert.equal(
    technip.LISTING_API_BASE_URL,
    'https://hcxg.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    technip.DETAIL_API_BASE_URL,
    'https://hcxg.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    technip.PUBLIC_JOBS_BASE_URL,
    'https://hcxg.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  )
  assert.equal(technip.SITE_NUMBER, 'CX_1')
  assert.equal(typeof technip.extractSearchResults, 'function')
  assert.equal(typeof technip.extractJobDetail, 'function')
  assert.equal(typeof technip.createTechnipEnergiesScraper, 'function')
  assert.equal(typeof technip.run, 'function')

  assert.equal(
    technip.buildSearchUrl(),
    'https://hcxg.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    technip.buildJobDetailUrl('14116'),
    'https://hcxg.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/14116',
  )

  const listings = technip.extractSearchResults(searchPayload)
  assert.deepEqual(listings, [{
    title: 'Process Engineer',
    company: 'Technip Energies',
    department: 'Engineering',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: '14116',
    requisitionId: '14116',
    sourceUrl: 'https://hcxg.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/14116',
    applyUrl: 'https://hcxg.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/14116',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: "Bachelor's Degree",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Deliver energy transition engineering projects.',
  }])

  const detail = technip.extractJobDetail(detailPayload, listings[0])
  assert.equal(detail.title, 'Process Engineer')
  assert.equal(detail.location, 'Mumbai, Maharashtra, India')
  assert.equal(detail.city, 'Mumbai')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.minimumQualification, "Bachelor's Degree")
  assert.deepEqual(detail.requiredSkills, ['Process Engineering', 'EPC'])
  assert.equal(detail.postingDate, '2026-07-09')
  assert.equal(detail.closingDate, '2026-08-09')
  assert.match(detail.jobDescription, /Deliver energy transition engineering projects/i)
  assert.match(detail.jobDescription, /Design process systems/i)
  assert.match(detail.jobDescription, /Support EPC execution/i)

  const jobs = await technip.createTechnipEnergiesScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === technip.buildSearchUrl({ page: 0 })) return searchPayload
      if (url === `${technip.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`) {
        return detailPayload
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    technip.buildSearchUrl({ page: 0 }),
    `${technip.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'technipenergies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[0].title, 'Process Engineer')
})
