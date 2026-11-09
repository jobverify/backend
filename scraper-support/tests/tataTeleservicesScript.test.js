import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tata Tele Business Services - Careers</title>
  </head>
  <body>
    <main>
      <h1>Your journey to Do Big starts here!</h1>
      <p>Work on technology that matters.</p>
      <a href="https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location">View All Openings</a>
      <footer>
        <p>TATA is a registered trademark of Tata Sons Private Limited</p>
        <p>© 2026 Tata Teleservices Limited</p>
      </footer>
    </main>
  </body>
</html>
`

const OFFICIAL_CANDIDATE_EXPERIENCE_HTML = `
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta property="og:title" content="Tata Teleservices Career Portal Careers" />
    <meta property="og:description" content="Join Our Team" />
    <meta property="og:site_name" content="Tata Teleservices Career Portal" />
    <title>Tata Teleservices Career Portal</title>
    <base
      href="/hcmUI/CandidateExperience/en/sites/CX_1"
      data-apibaseurl="https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com:443"
      data-sitenumber="CX_1"
    />
  </head>
  <body>
    <div class="app">Search Tata Teleservices jobs</div>
  </body>
</html>
`

const LISTING_PAYLOAD = {
  items: [{
    Limit: 3,
    TotalJobsCount: 11,
    SiteNumber: 'CX_1001',
    organizationsFacet: [
      { Id: 300000002776886, Name: 'Tata Teleservices Ltd', TotalCount: 6 },
      { Id: 300000002776867, Name: 'Tata Teleservices (Maharashtra) Limited', TotalCount: 5 },
    ],
    workplaceTypesFacet: [
      { Id: 'ORA_ON_SITE', Name: 'On-site', TotalCount: 13 },
    ],
    requisitionList: [
      {
        Id: '2258',
        Title: 'Product Sales Specialist - IAAS',
        PostedDate: '2026-07-16',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Pune, Maharashtra, India',
        JobSchedule: null,
        StudyLevel: null,
        ShortDescriptionStr: '',
        WorkplaceType: '',
        secondaryLocations: [],
      },
      {
        Id: '2404',
        Title: 'Product Sales Specialist - Data',
        PostedDate: '2026-07-14',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Pune, Maharashtra, India',
        JobSchedule: null,
        StudyLevel: null,
        ShortDescriptionStr: '',
        WorkplaceType: '',
        secondaryLocations: [],
      },
      {
        Id: '99999',
        Title: 'Outside India Role',
        PostedDate: '2026-07-14',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'Dallas, Texas, United States',
        JobSchedule: 'Full time',
        StudyLevel: null,
        ShortDescriptionStr: 'Should be filtered out.',
        WorkplaceType: 'Remote',
        secondaryLocations: [],
      },
    ],
  }],
}

const DETAIL_PAYLOAD = {
  items: [{
    Id: '2258',
    Title: 'Product Sales Specialist - IAAS',
    Category: 'Sales & Marketing',
    RequisitionType: 'Lateral Hiring',
    ExternalPostedStartDate: '2026-07-16T10:48:59+00:00',
    JobSchedule: 'Full time',
    ExternalPostedEndDate: '2026-07-31T10:48:00+00:00',
    ExternalDescriptionStr: `
      <p><strong>Job Description:</strong></p>
      <ul>
        <li>Cloud based products are gaining momentum in SMB segment.</li>
        <li>Candidate will be responsible for product sales revenue in assigned territory.</li>
      </ul>
      <p><strong>Skills Required:</strong></p>
      <ul>
        <li>Specialization/certification</li>
        <li>Online learning ability</li>
      </ul>
      <p><strong>Overall Work Experience:</strong> At least 8-12 years of experience.</p>
    `,
    CorporateDescriptionStr: `
      <div><b>Transforming Businesses through Digitalization</b></div>
      <div>Tata Tele Business Services (TTBS), belonging to the prestigious Tata Group of Companies, is the country’s leading enabler of connectivity and communication solutions for businesses.</div>
    `,
    PrimaryLocation: 'Pune, Maharashtra, India',
    PrimaryLocationCountry: 'IN',
    WorkplaceType: '',
    JobFunction: 'Administrative',
    secondaryLocations: [],
    workLocation: [{
      LocationName: 'Pune',
      TownOrCity: 'Pune',
      Region2: 'Maharashtra',
      Country: 'IN',
    }],
    skills: [],
  }],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tatateleservices/script.js')
  } catch {
    assert.fail('Expected Tata Teleservices scraper module at ../../scraper/tatateleservices/script.js')
  }
}

test('Tata Teleservices keeps the verified TTBS careers handoff and Oracle candidate shell pinned', async () => {
  const tata = await loadScriptModule()

  assert.equal(tata.SOURCE, 'tatateleservices')
  assert.equal(tata.COMPANY_NAME, 'Tata Teleservices')
  assert.equal(tata.OFFICIAL_BRAND_NAME, 'Tata Teleservices Limited')
  assert.equal(tata.VERIFIED_AT, '2026-08-01')
  assert.equal(tata.HOMEPAGE_URL, 'https://www.tatatelebusiness.com/')
  assert.equal(tata.OFFICIAL_CAREERS_URL, 'https://www.tatatelebusiness.com/careers/')
  assert.equal(
    tata.OFFICIAL_JOBS_HANDOFF_URL,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location',
  )
  assert.equal(
    tata.CANDIDATE_EXPERIENCE_URL,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location',
  )
  assert.equal(tata.WORKSPACE_DOMAIN, 'fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com')
  assert.equal(tata.SITE_NUMBER, 'CX_1001')
  assert.equal(tata.hasOfficialCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    tata.hasOfficialCandidateExperienceSignal(OFFICIAL_CANDIDATE_EXPERIENCE_HTML),
    true,
  )
  assert.equal(tata.hasVerifiedTataListingSignal(LISTING_PAYLOAD), true)
})

test('Tata Teleservices keeps Oracle finder, detail, and public job URLs pinned to the verified CX_1001 surface', async () => {
  const tata = await loadScriptModule()

  assert.equal(
    tata.buildSearchUrl(),
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=24,offset=0,location=India',
  )
  assert.equal(
    tata.buildSearchUrl({ page: 2, limit: 10 }),
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=10,offset=20,location=India',
  )
  assert.equal(
    tata.buildJobDetailUrl('2258'),
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/2258',
  )
  assert.equal(
    tata.buildJobDetailApiUrl('2258'),
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%222258%22,siteNumber=CX_1001',
  )
})

test('extractSearchResults and extractJobDetail normalize Tata Teleservices Oracle requisitions', async () => {
  const tata = await loadScriptModule()
  const listings = tata.extractSearchResults(LISTING_PAYLOAD)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Product Sales Specialist - IAAS',
    company: 'Tata Teleservices',
    department: null,
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    jobId: '2258',
    requisitionId: '2258',
    sourceUrl: 'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/2258',
    applyUrl: 'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/2258',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-16',
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    siteNumber: 'CX_1001',
  })

  const detail = tata.extractJobDetail(DETAIL_PAYLOAD, listings[0])

  assert.equal(detail.title, 'Product Sales Specialist - IAAS')
  assert.equal(detail.company, 'Tata Teleservices')
  assert.equal(detail.department, 'Administrative')
  assert.equal(detail.location, 'Pune, Maharashtra, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.country, 'India')
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.experienceRequired, '8-12 years')
  assert.equal(detail.minimumQualification, null)
  assert.deepEqual(detail.requiredSkills, [])
  assert.equal(detail.postingDate, '2026-07-16')
  assert.equal(detail.closingDate, '2026-07-31')
  assert.match(detail.jobDescription, /Cloud based products are gaining momentum/i)
  assert.match(detail.jobDescription, /Transforming Businesses through Digitalization/i)
})

test('run verifies the TTBS careers page, Oracle shell, and Tata listing contract before calling the public detail API', async () => {
  const tata = await loadScriptModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await tata.createTataTeleservicesScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-08-01T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === tata.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === tata.CANDIDATE_EXPERIENCE_URL) return OFFICIAL_CANDIDATE_EXPERIENCE_HTML
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === tata.buildSearchUrl()) return LISTING_PAYLOAD
      if (url === tata.buildJobDetailApiUrl('2258')) return DETAIL_PAYLOAD
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [
    tata.OFFICIAL_CAREERS_URL,
    tata.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    tata.buildSearchUrl(),
    tata.buildJobDetailApiUrl('2258'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'tatateleservices')
  assert.equal(jobs[0].company, 'Tata Teleservices')
  assert.equal(
    jobs[0].link,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/2258',
  )
  assert.equal(jobs[0].scrapedAt, '2026-08-01T00:00:00.000Z')
})

test('run fails closed when the TTBS handoff, Oracle shell, or Tata listing contract drifts materially', async () => {
  const tata = await loadScriptModule()

  await assert.rejects(
    tata.createTataTeleservicesScraper({
      fetchText: async (url) => {
        if (url === tata.OFFICIAL_CAREERS_URL) {
          return OFFICIAL_CAREERS_HTML.replace('View All Openings', 'Explore Roles')
        }
        return OFFICIAL_CANDIDATE_EXPERIENCE_HTML
      },
      fetchJson: async () => LISTING_PAYLOAD,
    }).run(),
    /verified official Tata Teleservices careers page/i,
  )

  await assert.rejects(
    tata.createTataTeleservicesScraper({
      fetchText: async (url) => {
        if (url === tata.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
        return OFFICIAL_CANDIDATE_EXPERIENCE_HTML.replace('data-sitenumber="CX_1"', 'data-sitenumber="CX_2"')
      },
      fetchJson: async () => LISTING_PAYLOAD,
    }).run(),
    /verified Oracle candidate experience page/i,
  )

  await assert.rejects(
    tata.createTataTeleservicesScraper({
      fetchText: async (url) => {
        if (url === tata.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
        return OFFICIAL_CANDIDATE_EXPERIENCE_HTML
      },
      fetchJson: async (url) => {
        if (url === tata.buildSearchUrl()) {
          return {
            ...LISTING_PAYLOAD,
            items: [{
              ...LISTING_PAYLOAD.items[0],
              organizationsFacet: [{ Id: 1, Name: 'Other Company', TotalCount: 13 }],
            }],
          }
        }
        return DETAIL_PAYLOAD
      },
    }).run(),
    /verified Tata listing contract/i,
  )
})
