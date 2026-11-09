import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const LISTING_PAYLOAD = {
  items: [{
    Limit: 24,
    TotalJobsCount: 2,
    requisitionList: [
      {
        Id: '7194',
        Title: 'Project Engineer - Intern',
        Organization: 'GreenPowerMonitor',
        PrimaryLocation: 'Chennai, Tamil Nadu, India',
        PrimaryLocationCountry: 'IN',
        JobSchedule: 'Full time',
        PostedDate: '2026-07-16T00:00:00+00:00',
        ShortDescriptionStr: 'Support renewable energy monitoring projects.',
        secondaryLocations: [],
      },
      {
        Id: '8001',
        Title: 'US-only Role',
        Organization: 'GreenPowerMonitor',
        PrimaryLocation: 'Austin, Texas, United States',
        PrimaryLocationCountry: 'US',
        JobSchedule: 'Full time',
        PostedDate: '2026-07-16T00:00:00+00:00',
        ShortDescriptionStr: 'Filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const DETAIL_PAYLOAD = {
  items: [{
    Id: '7194',
    Title: 'Project Engineer - Intern',
    Organization: 'GreenPowerMonitor',
    PrimaryLocation: 'Chennai, Tamil Nadu, India',
    PrimaryLocationCountry: 'IN',
    JobSchedule: 'Full time',
    ExternalPostedStartDate: '2026-07-16T00:00:00+00:00',
    ExternalPostedEndDate: '2026-08-16T00:00:00+00:00',
    ExternalDescriptionStr: `
      <p>GreenPowerMonitor is looking for a Project Engineer - Intern for SCADA work across renewable energy assets.</p>
      <p>You will support photovoltaic, BESS, and wind projects, prepare single-line diagrams for SCADA cabinet hardware, and assist with commissioning.</p>
    `,
    ExternalResponsibilitiesStr: `
      <ul>
        <li>Configure, test, and commission dataloggers and monitoring platforms.</li>
        <li>Work with automation, networking, and industrial protocols.</li>
      </ul>
    `,
    ExternalQualificationsStr: `
      <ul>
        <li>Bachelor's degree in Electrical, Renewable Energy, or a related discipline.</li>
        <li>0-2 years of experience with SCADA systems, automation, or renewable energy technologies.</li>
      </ul>
    `,
    skills: [
      { Skill: 'SCADA' },
      { Skill: 'Linux' },
    ],
  }],
}

test('DNV scraper enriches India Oracle listings with detail payload text and experience cues', async () => {
  const dnv = await import('../../scraper/dnv/script.js')
  const requestedUrls = []

  assert.equal(
    dnv.LISTING_API_BASE_URL,
    'https://ecyq.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    dnv.DETAIL_API_BASE_URL,
    'https://ecyq.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    dnv.buildJobDetailUrl('7194'),
    'https://ecyq.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/7194',
  )
  assert.equal(
    dnv.buildJobDetailApiUrl('7194'),
    'https://ecyq.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%227194%22,siteNumber=CX_1',
  )

  const listings = dnv.extractSearchResults(LISTING_PAYLOAD)
  assert.deepEqual(listings, [{
    title: 'Project Engineer - Intern',
    company: 'DNV',
    department: 'GreenPowerMonitor',
    location: 'Chennai, Tamil Nadu, India',
    city: 'Chennai',
    jobId: '7194',
    requisitionId: '7194',
    sourceUrl: 'https://ecyq.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/7194',
    applyUrl: 'https://ecyq.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/7194',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-16',
    closingDate: null,
    jobDescription: 'Support renewable energy monitoring projects.',
  }])

  const detail = dnv.extractJobDetail(DETAIL_PAYLOAD, listings[0])
  assert.equal(detail.title, 'Project Engineer - Intern')
  assert.equal(detail.location, 'Chennai, Tamil Nadu, India')
  assert.equal(detail.city, 'Chennai')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.postingDate, '2026-07-16')
  assert.equal(detail.closingDate, '2026-08-16')
  assert.equal(detail.experienceRequired, '0-2 years')
  assert.deepEqual(detail.requiredSkills, ['SCADA', 'Linux'])
  assert.match(detail.minimumQualification, /Electrical/i)
  assert.match(detail.jobDescription, /SCADA/i)
  assert.match(detail.jobDescription, /renewable energy/i)
  assert.match(detail.jobDescription, /photovoltaic/i)
  assert.match(detail.jobDescription, /BESS/i)

  const normalized = normalizeScrapedJob({
    ...detail,
    source: 'dnv',
  }, {
    source: 'dnv',
  })
  assert.equal(normalized.experienceRequired, '0-2 years')
  assert.notEqual(normalized.engineeringDomain, 'Unknown')

  const jobs = await dnv.createDnvScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-08-01T16:00:00.000Z',
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === dnv.buildSearchUrl({ page: 0 })) return LISTING_PAYLOAD
      if (url === dnv.buildJobDetailApiUrl('7194')) return DETAIL_PAYLOAD
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    dnv.buildSearchUrl({ page: 0 }),
    dnv.buildJobDetailApiUrl('7194'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'dnv')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-01T16:00:00.000Z')
  assert.equal(jobs[0].experienceRequired, '0-2 years')
  assert.match(jobs[0].jobDescription, /commission dataloggers/i)
})
