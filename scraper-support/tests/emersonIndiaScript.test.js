import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Your Career at Emerson Starts Here</title>
    <meta property="og:title" content="Your Career at Emerson Starts Here" />
  </head>
  <body>
    <main>
      <h1>Careers at Emerson</h1>
      <p>Let’s Go… and change the world</p>
      <p>We want you to join us in our bold aspiration to make the world healthier, safer, smarter and more sustainable.</p>
      <a href="https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs" target="_blank" rel="noopener noreferrer">
        <button type="button">
          <span>Let's Find Your Role</span>
        </button>
      </a>
      <a href="/en/corporate/careers/career-opportunities" title="Explore All Opportunities">
        <p>Explore All Opportunities</p>
      </a>
    </main>
  </body>
</html>
`

const candidateExperienceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Emerson Career Site</title>
    <meta property="og:title" content="Emerson Career Site Careers" />
    <meta property="og:description" content="Explore Careers at Emerson" />
    <meta property="og:site_name" content="Emerson Career Site" />
    <base
      href="/hcmUI/CandidateExperience/en/sites/CX_1"
      data-apibaseurl="https://hdjq.fa.us2.oraclecloud.com:443"
      data-sitenumber="CX_1"
    />
    <link
      rel="icon"
      href="/hcmRestApi/CandidateExperience/siteFavicon/favicon-16x16.png?siteNumber=CX_1&size=16x16"
    />
  </head>
  <body></body>
</html>
`

const listingPayload = {
  items: [{
    Limit: 10,
    TotalJobsCount: 146,
    requisitionList: [
      {
        Id: '26002023',
        Title: 'Analyst I Finance',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'PUNE, MAHARASHTRA, India',
        JobFunction: null,
        Department: null,
        Category: null,
        JobFamily: null,
        JobSchedule: null,
        ExternalPostedStartDate: null,
        ExternalPostedEndDate: null,
        ShortDescriptionStr:
          'Job Summary: We are seeking an experienced FP&A professional to join our finance team.',
        secondaryLocations: [],
      },
      {
        Id: '99999999',
        Title: 'United States Role',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'ST. LOUIS, MISSOURI, United States',
        JobFunction: 'Operations',
        Department: 'Operations',
        Category: 'Operations',
        JobFamily: null,
        JobSchedule: 'Full time',
        ExternalPostedStartDate: '2026-07-10T00:00:00+00:00',
        ExternalPostedEndDate: null,
        ShortDescriptionStr: 'Should be filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '26002023',
    Title: 'Analyst I Finance',
    PrimaryLocationCountry: 'IN',
    PrimaryLocation: 'PUNE, MAHARASHTRA, India',
    JobFunction: 'Finance',
    Department: null,
    Category: 'Financial Planning & Analysis',
    JobFamily: null,
    JobSchedule: 'Full time',
    RequisitionType: 'Professional',
    ExternalPostedStartDate: '2026-07-13T09:50:58+00:00',
    ExternalPostedEndDate: null,
    StudyLevel: null,
    ExternalQualificationsStr: '',
    ShortDescriptionStr:
      'Job Summary: We are seeking an experienced FP&A professional to join our finance team.',
    ExternalDescriptionStr: `
      <p><strong>In&nbsp;this&nbsp;Role,&nbsp;Your&nbsp;Responsibilities&nbsp;Will&nbsp;Be:</strong></p>
      <ul>
        <li>Lead preparation of annual budgets, quarterly forecasts, and long-term financial models.</li>
        <li>Collaborate with business units to understand assumptions and key drivers of financial performance.</li>
      </ul>
    `,
    ExternalResponsibilitiesStr: null,
    skills: [],
    secondaryLocations: [],
  }],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/emersonindia/script.js')
  } catch {
    assert.fail('Expected Emerson India scraper module at ../../scraper/emersonindia/script.js')
  }
}

test('Emerson India verifies the first-party careers page and Oracle candidate experience shell', async () => {
  const emerson = await loadScriptModule()

  assert.equal(emerson.SOURCE, 'emersonindia')
  assert.equal(emerson.COMPANY_NAME, 'Emerson India')
  assert.equal(emerson.OFFICIAL_BRAND_NAME, 'Emerson')
  assert.equal(emerson.VERIFIED_AT, '2026-07-15')
  assert.equal(emerson.CAREERS_URL, 'https://www.emerson.com/en/corporate/careers')
  assert.equal(
    emerson.CANDIDATE_EXPERIENCE_URL,
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
  )
  assert.equal(emerson.WORKSPACE_DOMAIN, 'hdjq.fa.us2.oraclecloud.com')
  assert.equal(emerson.SITE_NUMBER, 'CX_1')
  assert.equal(emerson.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(emerson.hasOfficialCandidateExperienceSignal(candidateExperienceHtml), true)
})

test('Emerson India keeps finder, detail, and public job URLs on the verified Oracle Cloud surface', async () => {
  const emerson = await loadScriptModule()

  assert.equal(
    emerson.buildSearchUrl(),
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    emerson.buildSearchUrl({ page: 2, limit: 10 }),
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=10,offset=20,location=India',
  )
  assert.equal(
    emerson.buildJobDetailUrl('26002023'),
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26002023',
  )
  assert.equal(
    emerson.buildJobDetailApiUrl('26002023'),
    'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%2226002023%22,siteNumber=CX_1',
  )
})

test('extractSearchResults and extractJobDetail normalize Emerson India requisitions from the public Oracle APIs', async () => {
  const emerson = await loadScriptModule()

  const listings = emerson.extractSearchResults(listingPayload)

  assert.deepEqual(listings, [{
    title: 'Analyst I Finance',
    company: 'Emerson India',
    department: null,
    location: 'PUNE, MAHARASHTRA, India',
    city: 'PUNE',
    country: 'India',
    jobId: '26002023',
    requisitionId: '26002023',
    sourceUrl: 'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26002023',
    applyUrl: 'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26002023',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Job Summary: We are seeking an experienced FP&A professional to join our finance team.',
    remoteStatus: null,
    siteNumber: 'CX_1',
  }])

  const detail = emerson.extractJobDetail(detailPayload, listings[0])

  assert.deepEqual(detail, {
    title: 'Analyst I Finance',
    company: 'Emerson India',
    department: 'Finance',
    location: 'PUNE, MAHARASHTRA, India',
    city: 'PUNE',
    country: 'India',
    jobId: '26002023',
    requisitionId: '26002023',
    sourceUrl: 'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26002023',
    applyUrl: 'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26002023',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-13',
    closingDate: null,
    jobDescription:
      'Job Summary: We are seeking an experienced FP&A professional to join our finance team. In this Role, Your Responsibilities Will Be: Lead preparation of annual budgets, quarterly forecasts, and long-term financial models. Collaborate with business units to understand assumptions and key drivers of financial performance.',
    remoteStatus: null,
    siteNumber: 'CX_1',
    publicExperienceChecked: true,
  })
})

test('run verifies the first-party careers handoff before calling the public Oracle APIs', async () => {
  const emerson = await loadScriptModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await emerson.createEmersonIndiaScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-15T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === emerson.CAREERS_URL) return officialCareersHtml
      if (url === emerson.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === emerson.buildSearchUrl()) return {
        items: [{ ...listingPayload.items[0], Limit: 24, Offset: 0, SiteNumber: 'CX_1' }],
      }
      if (url === emerson.buildJobDetailApiUrl('26002023')) return detailPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [
    emerson.CAREERS_URL,
    emerson.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    emerson.buildSearchUrl(),
    emerson.buildJobDetailApiUrl('26002023'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'emersonindia')
  assert.equal(jobs[0].company, 'Emerson India')
  assert.equal(
    jobs[0].link,
    'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/26002023',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('run fails closed when the verified Emerson careers page or Oracle shell drifts materially', async () => {
  const emerson = await loadScriptModule()

  await assert.rejects(
    emerson.createEmersonIndiaScraper({
      fetchText: async (url) => {
        if (url === emerson.CAREERS_URL) {
          return officialCareersHtml.replace(
            '/en/corporate/careers/career-opportunities',
            '/en/corporate/careers/growth-opportunities',
          )
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Emerson careers page/i,
  )

  await assert.rejects(
    emerson.createEmersonIndiaScraper({
      fetchText: async (url) => {
        if (url === emerson.CAREERS_URL) return officialCareersHtml
        if (url === emerson.CANDIDATE_EXPERIENCE_URL) {
          return candidateExperienceHtml.replace('data-sitenumber="CX_1"', 'data-sitenumber="CX_9"')
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Oracle candidate experience page/i,
  )
})
