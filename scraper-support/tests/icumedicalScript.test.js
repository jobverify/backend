import assert from 'node:assert/strict'
import test from 'node:test'

const searchPayload = {
  items: [{
    Limit: 24,
    TotalJobsCount: 13,
    requisitionList: [
      {
        Id: '1028',
        Title: 'Oracle Applications Programmer',
        Category: 'Application Development & Support',
        PrimaryLocation: 'Chennai, Tamil Nadu, India',
        PrimaryLocationCountry: 'IN',
        WorkplaceType: 'Hybrid',
        PostedDate: '2026-01-28',
        StudyLevel: "Master's Degree",
        ShortDescriptionStr: '',
        ExternalResponsibilitiesStr: '',
        secondaryLocations: [],
      },
      {
        Id: '2028',
        Title: 'Outside India Role',
        Category: 'Engineering',
        PrimaryLocation: 'Irvine, California, United States',
        PrimaryLocationCountry: 'US',
        PostedDate: '2026-01-28',
        ShortDescriptionStr: 'This role should be filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '1028',
    Title: 'Oracle Applications Programmer',
    Category: 'Application Development & Support',
    RequisitionType: 'Non-Confidential',
    JobFunction: 'IT',
    JobFunctionCode: 'IT',
    JobSchedule: 'Full time',
    StudyLevel: "Master's Degree",
    WorkplaceType: 'Hybrid',
    PrimaryLocation: 'Chennai, Tamil Nadu, India',
    PrimaryLocationCountry: 'IN',
    ExternalPostedStartDate: '2026-01-28T08:03:26+00:00',
    ExternalPostedEndDate: null,
    ExternalDescriptionStr: '<p><strong>Position Summary</strong></p><p>Build and support Oracle business systems.</p><ul><li>Integrate Oracle EDI flows</li><li>Support production systems</li></ul>',
    ExternalResponsibilitiesStr: '',
    ExternalQualificationsStr: '<p>R12 experience is required and a Bachelorâ€™s degree is preferred</p>',
    secondaryLocations: [],
    skills: [],
  }],
}

test('ICU Medical scraper normalizes Oracle CE requisitions and enriches them end to end', async () => {
  const icumedical = await import('../../scraper/icumedical/script.js')
  const requestedUrls = []

  assert.equal(
    icumedical.LISTING_API_BASE_URL,
    'https://eduu.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    icumedical.DETAIL_API_BASE_URL,
    'https://eduu.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    icumedical.PUBLIC_JOBS_BASE_URL,
    'https://eduu.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
  )
  assert.equal(icumedical.SITE_NUMBER, 'CX_1')
  assert.equal(typeof icumedical.extractSearchResults, 'function')
  assert.equal(typeof icumedical.extractJobDetail, 'function')
  assert.equal(typeof icumedical.createIcuMedicalScraper, 'function')
  assert.equal(typeof icumedical.run, 'function')

  assert.equal(
    icumedical.buildSearchUrl(),
    'https://eduu.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    icumedical.buildJobDetailUrl('1028'),
    'https://eduu.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1028',
  )

  const listings = icumedical.extractSearchResults(searchPayload)
  assert.deepEqual(listings, [{
    title: 'Oracle Applications Programmer',
    company: 'ICU Medical',
    department: 'Application Development & Support',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    jobId: '1028',
    requisitionId: '1028',
    sourceUrl: 'https://eduu.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1028',
    applyUrl: 'https://eduu.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1028',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: "Master's Degree",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-01-28',
    closingDate: null,
    jobDescription: null,
  }])

  const detail = icumedical.extractJobDetail(detailPayload, listings[0])
  assert.equal(detail.title, 'Oracle Applications Programmer')
  assert.equal(detail.department, 'Application Development & Support')
  assert.equal(detail.location, 'Chennai, Tamil Nadu, India')
  assert.equal(detail.city, 'Chennai')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.minimumQualification, "Master's Degree")
  assert.deepEqual(detail.requiredSkills, [])
  assert.equal(detail.postingDate, '2026-01-28')
  assert.equal(detail.closingDate, null)
  assert.match(detail.jobDescription, /Build and support Oracle business systems/i)
  assert.match(detail.jobDescription, /Integrate Oracle EDI flows/i)
  assert.match(detail.jobDescription, /R12 experience is required/i)
  assert.match(detail.jobDescription, /Bachelor's degree is preferred/i)

  const jobs = await icumedical.createIcuMedicalScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === icumedical.buildSearchUrl({ page: 0 })) return searchPayload
      if (url === `${icumedical.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`) {
        return detailPayload
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    icumedical.buildSearchUrl({ page: 0 }),
    `${icumedical.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'icumedical')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[0].title, 'Oracle Applications Programmer')
})
