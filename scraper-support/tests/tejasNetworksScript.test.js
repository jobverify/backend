import assert from 'node:assert/strict'
import test from 'node:test'

const searchPayload = {
  items: [{
    Limit: 10,
    TotalJobsCount: 6,
    requisitionList: [
      {
        Id: '335',
        Title: 'Senior FPGA Engineer',
        Department: 'Engineering',
        PrimaryLocation: 'India',
        PrimaryLocationCountry: 'IN',
        JobSchedule: 'Full time',
        PostedDate: '2026-07-09',
        StudyLevel: "Bachelor's degree in Electronics",
        ShortDescriptionStr: 'Design next-generation telecom hardware.',
        workLocation: [
          {
            LocationName: 'Bengaluru, Karnataka, India',
          },
        ],
      },
      {
        Id: '999',
        Title: 'Outside India Role',
        Department: 'Engineering',
        PrimaryLocation: 'Dallas, Texas, United States',
        PrimaryLocationCountry: 'US',
        PostedDate: '2026-07-09',
        ShortDescriptionStr: 'Filtered out.',
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '335',
    Title: 'Senior FPGA Engineer',
    Department: 'Engineering',
    PrimaryLocation: 'India',
    PrimaryLocationCountry: 'IN',
    JobSchedule: 'Full time',
    StudyLevel: "Bachelor's degree in Electronics",
    ExternalPostedStartDate: '2026-07-09',
    ExternalPostedEndDate: '2026-08-09',
    ExternalDescriptionStr: '<p>Design next-generation telecom hardware.</p>',
    ExternalResponsibilitiesStr: '<ul><li>Develop FPGA flows</li><li>Validate high-speed interfaces</li></ul>',
    ExternalQualificationsStr: '<p>RTL design and verification experience.</p>',
    workLocation: [
      {
        LocationName: 'Bengaluru, Karnataka, India',
      },
    ],
    skills: [
      { Skill: 'FPGA' },
      { Skill: 'RTL Design' },
    ],
  }],
}

test('Tejas Networks scraper normalizes India Oracle CE requisitions and enriches them end to end', async () => {
  const tejas = await import('../../scraper/tejasnetworks/script.js')
  const requestedUrls = []

  assert.equal(
    tejas.LISTING_API_BASE_URL,
    'https://iablcp.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    tejas.DETAIL_API_BASE_URL,
    'https://iablcp.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    tejas.PUBLIC_JOBS_BASE_URL,
    'https://iablcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/TejasNetworks/job/',
  )
  assert.equal(tejas.SITE_NUMBER, 'CX_1')
  assert.equal(typeof tejas.extractSearchResults, 'function')
  assert.equal(typeof tejas.extractJobDetail, 'function')
  assert.equal(typeof tejas.createTejasNetworksScraper, 'function')
  assert.equal(typeof tejas.run, 'function')

  assert.equal(
    tejas.buildSearchUrl(),
    'https://iablcp.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.workLocation,requisitionList.otherWorkLocations,requisitionList.secondaryLocations,requisitionList.requisitionFlexFields&finder=findReqs;siteNumber=CX_1,limit=24,offset=0',
  )
  assert.equal(
    tejas.buildJobDetailUrl('335'),
    'https://iablcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/TejasNetworks/job/335',
  )
  assert.equal(
    tejas.buildApplyUrl('335'),
    'https://iablcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/TejasNetworks/job/335/apply',
  )

  const listings = tejas.extractSearchResults(searchPayload)
  assert.deepEqual(listings, [{
    title: 'Senior FPGA Engineer',
    company: 'Tejas Networks',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '335',
    requisitionId: '335',
    sourceUrl: 'https://iablcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/TejasNetworks/job/335',
    applyUrl: 'https://iablcp.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/TejasNetworks/job/335/apply',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: "Bachelor's degree in Electronics",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Design next-generation telecom hardware.',
  }])

  const detail = tejas.extractJobDetail(detailPayload, listings[0])
  assert.equal(detail.title, 'Senior FPGA Engineer')
  assert.equal(detail.location, 'Bengaluru, Karnataka, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.minimumQualification, "Bachelor's degree in Electronics")
  assert.deepEqual(detail.requiredSkills, ['FPGA', 'RTL Design'])
  assert.equal(detail.postingDate, '2026-07-09')
  assert.equal(detail.closingDate, '2026-08-09')
  assert.match(detail.jobDescription, /Design next-generation telecom hardware/i)
  assert.match(detail.jobDescription, /Develop FPGA flows/i)
  assert.match(detail.jobDescription, /Validate high-speed interfaces/i)

  const jobs = await tejas.createTejasNetworksScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === tejas.buildSearchUrl({ page: 0 })) return searchPayload
      if (url === `${tejas.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`) {
        return detailPayload
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    tejas.buildSearchUrl({ page: 0 }),
    `${tejas.DETAIL_API_BASE_URL}?expand=all&onlyData=true&finder=ById;Id=%22${listings[0].jobId}%22,siteNumber=CX_1`,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'tejasnetworks')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[0].title, 'Senior FPGA Engineer')
})
