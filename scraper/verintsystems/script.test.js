import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CANDIDATE_EXPERIENCE_URL,
  CAREERS_URL,
  COMPANY_NAME,
  SITE_NUMBER,
  SOURCE,
  buildJobDetailApiUrl,
  buildSearchUrl,
  createVerintSystemsScraper,
  extractJobDetail,
  extractSearchResults,
  hasOfficialCandidateExperienceSignal,
  hasOfficialCareersPageSignal,
} from './script.js'

const careersHtml = `
  <html>
    <head><title>Careers | Verint</title></head>
    <body>
      <h1>Everything you need to know about careers at Verint</h1>
      <a href="https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">Join Our Global Team</a>
      <a href="https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">See Our Current Vacancies</a>
    </body>
  </html>
`

const candidateExperienceHtml = `
  <html>
    <head>
      <meta property="og:title" content="Verint Careers" />
      <meta property="og:description" content="JOIN OUR TEAM" />
      <title>Verint</title>
      <base
        href="/hcmUI/CandidateExperience/en/sites/CX"
        data-apibaseurl="https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com:443"
        data-sitenumber="CX"
      />
    </head>
    <body>Verint</body>
  </html>
`

const listingPayload = {
  items: [
    {
      Limit: 24,
      TotalJobsCount: 1,
      requisitionList: [
        {
          Id: '3889',
          Title: 'Principal FrontEnd Developer',
          PrimaryLocation: 'Bangalore, India',
          PrimaryLocationCountry: 'IN',
          ExternalPostedStartDate: '2026-08-03T00:00:00Z',
        },
      ],
    },
  ],
  count: 1,
  hasMore: false,
  limit: 24,
  offset: 0,
}

const detailPayload = {
  items: [
    {
      Id: '3889',
      Title: 'Principal FrontEnd Developer',
      PrimaryLocation: 'Bangalore, India',
      PrimaryLocationCountry: 'IN',
      JobSchedule: 'Full time',
      ExternalPostedStartDate: '2026-08-03T00:00:00Z',
    },
  ],
  count: 1,
  hasMore: false,
  limit: 1,
  offset: 0,
}

test('Verint recognizes the current careers handoff and Oracle candidate shell', () => {
  assert.equal(SOURCE, 'verintsystems')
  assert.equal(COMPANY_NAME, 'Verint Systems')
  assert.equal(CAREERS_URL, 'https://www.verint.com/careers/')
  assert.equal(CANDIDATE_EXPERIENCE_URL, 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX')
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasOfficialCandidateExperienceSignal(candidateExperienceHtml), true)
})

test('Verint extracts India listings and enriches a requisition detail payload', () => {
  const listings = extractSearchResults(listingPayload)

  assert.deepEqual(listings, [
    {
      title: 'Principal FrontEnd Developer',
      company: 'Verint Systems',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '3889',
      requisitionId: '3889',
      sourceUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3889',
      applyUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3889',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-08-03',
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      siteNumber: SITE_NUMBER,
    },
  ])

  assert.deepEqual(extractJobDetail(detailPayload, listings[0]), {
    title: 'Principal FrontEnd Developer',
    company: 'Verint Systems',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '3889',
    requisitionId: '3889',
    sourceUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3889',
    applyUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3889',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-03',
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    siteNumber: 'CX',
  })
})

test('Verint runner follows the first-party handoff and Oracle APIs', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []
  const jobs = await createVerintSystemsScraper({
    maxPages: 1,
    now: () => '2026-08-06T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === buildSearchUrl({ page: 0 })) return listingPayload
      if (url === buildJobDetailApiUrl('3889')) return detailPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [CAREERS_URL, CANDIDATE_EXPERIENCE_URL])
  assert.deepEqual(requestedJsonUrls, [buildSearchUrl({ page: 0 }), buildJobDetailApiUrl('3889')])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-06T00:00:00.000Z')
})
