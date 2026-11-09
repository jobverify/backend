import assert from 'node:assert/strict'
import test from 'node:test'

const searchPayload = {
  items: [{
    Limit: 2,
    TotalJobsCount: 10,
    requisitionList: [
      {
        Id: '18863',
        Title: 'Sr Advanced Systems Administrator - Saviynt Admin',
        PostedDate: '2026-07-07',
        PrimaryLocationCountry: 'IN',
        JobFunction: 'Information Technology',
        ShortDescriptionStr: 'Architect and support the Saviynt identity platform.',
        PrimaryLocation: 'BANGALORE METROPOLITAN AREA, KARNATAKA, India',
        WorkplaceType: 'Hybrid',
        secondaryLocations: [],
      },
      {
        Id: '18399',
        Title: 'Territory Sales Manager - Comfort',
        PostedDate: '2026-07-08',
        PrimaryLocationCountry: 'US',
        JobFunction: 'Sales',
        ShortDescriptionStr: 'Outside India role.',
        PrimaryLocation: 'Dallas, TX, United States',
        WorkplaceType: 'Remote',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '18863',
    Title: 'Sr Advanced Systems Administrator - Saviynt Admin',
    Category: 'Systems Administration',
    RequisitionType: 'Professional',
    JobSchedule: 'Full time',
    ExternalPostedStartDate: '2026-07-07T04:12:46+00:00',
    PrimaryLocation: 'BANGALORE METROPOLITAN AREA, KARNATAKA, India',
    PrimaryLocationCountry: 'IN',
    ExternalDescriptionStr: '<p>Architect and support the Saviynt identity platform.</p>',
    CorporateDescriptionStr: '<p>Build the future of homes at Resideo.</p>',
    ShortDescriptionStr: 'Architect and support the Saviynt identity platform.',
    JobFunction: 'Information Technology',
    WorkplaceType: 'Hybrid',
    secondaryLocations: [],
    workLocation: [{
      TownOrCity: 'Bangalore',
      Region2: 'Karnataka',
      Country: 'IN',
    }],
    requisitionFlexFields: [
      {
        Prompt: 'Business',
        Value: 'Resideo',
      },
    ],
    skills: [],
  }],
}

test('Resideo scraper normalizes India Oracle CE requisitions and enriches them end to end', async () => {
  const resideo = await import('../../scraper/resideo/script.js')
  const requestedUrls = []

  assert.equal(
    resideo.LISTING_API_BASE_URL,
    'https://ehtl.fa.us6.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    resideo.DETAIL_API_BASE_URL,
    'https://ehtl.fa.us6.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    resideo.PUBLIC_JOBS_BASE_URL,
    'https://ehtl.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/',
  )
  assert.equal(resideo.SITE_NUMBER, 'CX')
  assert.equal(typeof resideo.extractSearchResults, 'function')
  assert.equal(typeof resideo.extractJobDetail, 'function')
  assert.equal(typeof resideo.createResideoScraper, 'function')
  assert.equal(typeof resideo.run, 'function')

  assert.equal(
    resideo.buildSearchUrl(),
    'https://ehtl.fa.us6.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=24,offset=0,location=India',
  )
  assert.equal(
    resideo.buildJobDetailUrl('18863'),
    'https://ehtl.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/18863',
  )

  const listings = resideo.extractSearchResults(searchPayload)
  assert.deepEqual(listings, [{
    title: 'Sr Advanced Systems Administrator - Saviynt Admin',
    company: 'Resideo',
    department: 'Information Technology',
    location: 'Bangalore Metropolitan Area, Karnataka, India',
    city: 'Bangalore Metropolitan Area',
    jobId: '18863',
    requisitionId: '18863',
    sourceUrl: 'https://ehtl.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/18863',
    applyUrl: 'https://ehtl.fa.us6.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/18863',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-07',
    closingDate: null,
    jobDescription: 'Architect and support the Saviynt identity platform.',
  }])

  const detail = resideo.extractJobDetail(detailPayload, listings[0])
  assert.equal(detail.title, 'Sr Advanced Systems Administrator - Saviynt Admin')
  assert.equal(detail.company, 'Resideo')
  assert.equal(detail.department, 'Systems Administration')
  assert.equal(detail.location, 'Bangalore Metropolitan Area, Karnataka, India')
  assert.equal(detail.city, 'Bangalore Metropolitan Area')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.postingDate, '2026-07-07')
  assert.equal(detail.closingDate, null)
  assert.match(detail.jobDescription, /Architect and support the Saviynt identity platform/i)
  assert.match(detail.jobDescription, /Build the future of homes at Resideo/i)

  const jobs = await resideo.createResideoScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === resideo.buildSearchUrl({ page: 0 })) return searchPayload
      if (url === `${resideo.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX`) {
        return detailPayload
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    resideo.buildSearchUrl({ page: 0 }),
    `${resideo.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX`,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'resideo')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[0].title, 'Sr Advanced Systems Administrator - Saviynt Admin')
})
