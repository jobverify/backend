import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Amneal India | Join Our Team</title>
  </head>
  <body>
    <main>
      <h1>Join and help make medicines accessible for all</h1>
      <p>Amneal is cultivating a workplace where innovation, excellence, and employee growth are at the forefront, making it a place to thrive, grow, and make an impact.</p>
      <a href="https://india.amneal.com/careers/search-our-career-opportunities/">
        Search Our Career Opportunities
      </a>
    </main>
  </body>
</html>
`

const searchPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search Career Opportunities | Amneal India</title>
  </head>
  <body>
    <main>
      <h1>Search Our Career Opportunities</h1>
      <p>We have many ways for you to grow and contribute</p>
      <p>Join our team and help build an exciting future.</p>
      <a href="https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001">
        India Career Opportunities<span class="sr-only">(Opens in a new tab)</span>
      </a>
    </main>
  </body>
</html>
`

const candidateExperienceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Amneal India</title>
    <meta property="og:title" content="Amneal India Careers" />
    <meta property="og:description" content="" />
    <meta property="og:site_name" content="Amneal India" />
    <base href="/hcmUI/CandidateExperience/en/sites/CX_5001" />
    <link rel="icon" href="/hcmRestApi/CandidateExperience/siteFavicon/favicon-16x16.png?siteNumber=CX_5001&size=16x16" />
  </head>
  <body></body>
</html>
`

const listingPayload = {
  items: [{
    Limit: 10,
    TotalJobsCount: 180,
    requisitionList: [
      {
        Id: '6812',
        Title: 'Deputy Manager / Manager - Clinical Trials management',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Ahmedabad City, Gujarat, India',
        JobFunction: null,
        Category: null,
        JobSchedule: null,
        ExternalPostedStartDate: '2026-07-02T06:11:02+00:00',
        ExternalPostedEndDate: '2026-07-19T18:30:00+00:00',
        ShortDescriptionStr: 'Candidate must have exposure of Clinical trial operation and have handled patient PK and CEP study.',
        secondaryLocations: [
          {
            Name: 'India',
            CountryCode: 'IN',
          },
        ],
      },
      {
        Id: '99999',
        Title: 'US-only Role',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'Naples, Florida, United States',
        JobFunction: 'Operations',
        Category: 'Operations',
        JobSchedule: 'Full time',
        ExternalPostedStartDate: '2026-07-02T06:11:02+00:00',
        ExternalPostedEndDate: null,
        ShortDescriptionStr: 'Should be filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '6812',
    Title: 'Deputy Manager / Manager - Clinical Trials management',
    PrimaryLocationCountry: 'IN',
    PrimaryLocation: 'Ahmedabad City, Gujarat, India',
    JobFunction: null,
    Category: null,
    Department: null,
    JobSchedule: null,
    RequisitionType: null,
    ExternalPostedStartDate: '2026-07-02T06:11:02+00:00',
    ExternalPostedEndDate: '2026-07-19T18:30:00+00:00',
    StudyLevel: 'Master of Science - Clinical Research',
    ExternalQualificationsStr: `
      <p>M. Pharm (Clinical Pharmacy/Pharmacology)</p>
      <p><span>5-7 years' Experience</span></p>
    `,
    ShortDescriptionStr: 'Candidate must have exposure of Clinical trial operation and have handled patient PK and CEP study.',
    ExternalResponsibilitiesStr: '',
    ExternalDescriptionStr: `
      <p><strong>Job Description:</strong></p>
      <ul>
        <li>Scientific review of Protocol and related documents as per regulatory requirements.</li>
        <li>Review of SIV presentations prepared by CRO and check for compliance with protocol.</li>
      </ul>
    `,
    skills: [],
    secondaryLocations: [],
  }],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/amnealpharmaceuticalsindia/script.js')
  } catch {
    assert.fail('Expected Amneal Pharmaceuticals India scraper module at ../../scraper/amnealpharmaceuticalsindia/script.js')
  }
}

test('Amneal Pharmaceuticals India verifies the live first-party India careers handoff and Oracle candidate experience shell', async () => {
  const amneal = await loadScriptModule()

  assert.equal(amneal.SOURCE, 'amnealpharmaceuticalsindia')
  assert.equal(amneal.COMPANY_NAME, 'Amneal Pharmaceuticals India')
  assert.equal(amneal.OFFICIAL_BRAND_NAME, 'Amneal India')
  assert.equal(amneal.VERIFIED_AT, '2026-07-15')
  assert.equal(amneal.OFFICIAL_CAREERS_URL, 'https://india.amneal.com/careers/')
  assert.equal(
    amneal.SEARCH_CAREERS_URL,
    'https://india.amneal.com/careers/search-our-career-opportunities/',
  )
  assert.equal(
    amneal.CANDIDATE_EXPERIENCE_URL,
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001',
  )
  assert.equal(amneal.WORKSPACE_DOMAIN, 'hcfa.fa.us2.oraclecloud.com')
  assert.equal(amneal.SITE_NUMBER, 'CX_5001')
  assert.equal(amneal.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(amneal.hasOfficialSearchPageSignal(searchPageHtml), true)
  assert.equal(amneal.hasOfficialCandidateExperienceSignal(candidateExperienceHtml), true)
})

test('Amneal Pharmaceuticals India keeps finder, detail, and public job URLs on the verified Oracle Cloud surface', async () => {
  const amneal = await loadScriptModule()

  assert.equal(
    amneal.buildSearchUrl(),
    'https://hcfa.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_5001,limit=24,offset=0,location=India',
  )
  assert.equal(
    amneal.buildSearchUrl({ page: 2, limit: 10 }),
    'https://hcfa.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_5001,limit=10,offset=20,location=India',
  )
  assert.equal(
    amneal.buildJobDetailUrl('6812'),
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/6812',
  )
  assert.equal(
    amneal.buildJobApplyUrl('6812'),
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/6812/apply',
  )
  assert.equal(
    amneal.buildJobDetailApiUrl('6812'),
    'https://hcfa.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%226812%22,siteNumber=CX_5001',
  )
})

test('extractSearchResults and extractJobDetail normalize Amneal Pharmaceuticals India requisitions from the public Oracle APIs', async () => {
  const amneal = await loadScriptModule()

  const listings = amneal.extractSearchResults(listingPayload)

  assert.deepEqual(listings, [{
    title: 'Deputy Manager / Manager - Clinical Trials management',
    company: 'Amneal Pharmaceuticals India',
    department: null,
    location: 'Ahmedabad City, Gujarat, India',
    city: 'Ahmedabad City',
    country: 'India',
    jobId: '6812',
    requisitionId: '6812',
    sourceUrl: 'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/6812',
    applyUrl: 'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/6812/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-02',
    closingDate: '2026-07-19',
    jobDescription: 'Candidate must have exposure of Clinical trial operation and have handled patient PK and CEP study.',
    remoteStatus: null,
    siteNumber: 'CX_5001',
  }])

  const detail = amneal.extractJobDetail(detailPayload, listings[0])

  assert.deepEqual(detail, {
    title: 'Deputy Manager / Manager - Clinical Trials management',
    company: 'Amneal Pharmaceuticals India',
    department: null,
    location: 'Ahmedabad City, Gujarat, India',
    city: 'Ahmedabad City',
    country: 'India',
    jobId: '6812',
    requisitionId: '6812',
    sourceUrl: 'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/6812',
    applyUrl: 'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/6812/apply',
    employmentType: null,
    experienceRequired: "5-7 years' Experience",
    minimumQualification: 'M. Pharm (Clinical Pharmacy/Pharmacology)',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-02',
    closingDate: '2026-07-19',
    jobDescription:
      'Candidate must have exposure of Clinical trial operation and have handled patient PK and CEP study. Job Description: Scientific review of Protocol and related documents as per regulatory requirements. Review of SIV presentations prepared by CRO and check for compliance with protocol. M. Pharm (Clinical Pharmacy/Pharmacology) 5-7 years\' Experience',
    remoteStatus: null,
    siteNumber: 'CX_5001',
  })
})

test('run verifies the first-party India careers handoff before calling the public Oracle APIs', async () => {
  const amneal = await loadScriptModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await amneal.createAmnealPharmaceuticalsIndiaScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-15T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === amneal.OFFICIAL_CAREERS_URL) return officialCareersHtml
      if (url === amneal.SEARCH_CAREERS_URL) return searchPageHtml
      if (url === amneal.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === amneal.buildSearchUrl()) return listingPayload
      if (url === amneal.buildJobDetailApiUrl('6812')) return detailPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [
    amneal.OFFICIAL_CAREERS_URL,
    amneal.SEARCH_CAREERS_URL,
    amneal.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    amneal.buildSearchUrl(),
    amneal.buildJobDetailApiUrl('6812'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'amnealpharmaceuticalsindia')
  assert.equal(jobs[0].company, 'Amneal Pharmaceuticals India')
  assert.equal(
    jobs[0].link,
    'https://hcfa.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_5001/job/6812/apply',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
})

test('run fails closed when the verified Amneal India careers or Oracle shell drifts materially', async () => {
  const amneal = await loadScriptModule()

  await assert.rejects(
    amneal.createAmnealPharmaceuticalsIndiaScraper({
      fetchText: async (url) => {
        if (url === amneal.OFFICIAL_CAREERS_URL) {
          return officialCareersHtml.replace('Search Our Career Opportunities', 'Browse Roles')
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Amneal India careers landing page/i,
  )

  await assert.rejects(
    amneal.createAmnealPharmaceuticalsIndiaScraper({
      fetchText: async (url) => {
        if (url === amneal.OFFICIAL_CAREERS_URL) return officialCareersHtml
        if (url === amneal.SEARCH_CAREERS_URL) {
          return searchPageHtml.replace('CX_5001', 'CX_5002')
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Amneal India search careers page/i,
  )

  await assert.rejects(
    amneal.createAmnealPharmaceuticalsIndiaScraper({
      fetchText: async (url) => {
        if (url === amneal.OFFICIAL_CAREERS_URL) return officialCareersHtml
        if (url === amneal.SEARCH_CAREERS_URL) return searchPageHtml
        return candidateExperienceHtml.replace('siteNumber=CX_5001', 'siteNumber=CX_9999')
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Oracle candidate experience page/i,
  )
})
