import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Icertis | Icertis</title>
  </head>
  <body>
    <main>
      <h1>Careers at Icertis</h1>
      <p>Build the future of contract intelligence.</p>
      <div class="career-hero__actions d-flex flex-wrap">
        <a class="btn btn-primary btn-primary--icon" href="https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/?">
          Explore Open Roles
        </a>
        <a class="btn btn-secondary" href="https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/join-talent-community?">
          Join Our Talent Community
        </a>
      </div>
    </main>
  </body>
</html>
`

const officialCandidateExperienceHtml = `
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <meta property="og:title" content="Icertis Careers" />
    <meta property="og:site_name" content="Icertis" />
    <title>Icertis</title>
    <base
      href="/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis"
      data-apibaseurl="https://iaaviz.fa.ocs.oraclecloud.com:443"
      data-sitenumber="CX_1"
    />
  </head>
  <body>
    <div id="jobSearchPage">Search Icertis jobs</div>
  </body>
</html>
`

const listingPayload = {
  items: [{
    Limit: 5,
    TotalJobsCount: 2,
    SiteNumber: 'Jobs-at-Icertis',
    requisitionList: [
      {
        Id: '7407',
        Title: 'Lead Functional Consultant, Customer Support(L2)',
        PostedDate: '2026-06-04',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Pune, Maharashtra, India',
        ShortDescriptionStr:
          'Icertis Solutions Private Limited is seeking a Lead Functional Consultant to join our Customer Support - L2 team.',
        WorkplaceType: 'Hybrid/Club',
        JobFunction: 'Customer Support',
        secondaryLocations: [],
      },
      {
        Id: '9999',
        Title: 'US-only role',
        PostedDate: '2026-06-01',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'Seattle, Washington, United States',
        ShortDescriptionStr: 'Ignore this one.',
        WorkplaceType: 'On-Site/Hub',
        JobFunction: 'Customer Support',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '7407',
    Title: 'Lead Functional Consultant, Customer Support(L2)',
    Category: 'Customer Support',
    RequisitionType: 'Employee',
    ExternalPostedStartDate: '2026-06-04T06:06:42+00:00',
    JobSchedule: 'Full time',
    JobShift: 'Rotational Shift',
    StudyLevel: "Bachelor's Degree",
    ExternalPostedEndDate: null,
    ExternalDescriptionStr:
      'As a Lead Functional Consultant, you will play a vital role in delivering exceptional customer support and driving the success of our products.',
    ShortDescriptionStr:
      'Icertis Solutions Private Limited is seeking a Lead Functional Consultant to join our Customer Support - L2 team.',
    PrimaryLocation: 'Pune, Maharashtra, India',
    PrimaryLocationCountry: 'IN',
    ExternalQualificationsStr: `
      <ul>
        <li>5-8 years of experience in a customer-facing role.</li>
        <li>Bachelor's degree in computer science, Information Technology, or a related field.</li>
      </ul>
    `,
    ExternalResponsibilitiesStr: `
      <ul>
        <li>Lead and mentor a team of functional consultants.</li>
        <li>Handle complex customer issues and provide timely solutions.</li>
      </ul>
    `,
    WorkplaceTypeCode: 'ORA_HYBRID',
    WorkplaceType: 'Hybrid/Club',
    JobFunction: 'Customer Support',
    secondaryLocations: [],
    skills: [],
  }],
}

const loadIcertisModule = async () => {
  try {
    return await import('../../scraper/icertis/script.js')
  } catch {
    assert.fail('Expected Icertis scraper module at ../../scraper/icertis/script.js')
  }
}

test('Icertis verifies the live first-party careers handoff and Oracle candidate experience shell', async () => {
  const icertis = await loadIcertisModule()

  assert.equal(icertis.SOURCE, 'icertis')
  assert.equal(icertis.COMPANY_NAME, 'Icertis')
  assert.equal(icertis.OFFICIAL_BRAND_NAME, 'Icertis')
  assert.equal(icertis.COMPANY_DOMAIN, 'icertis.com')
  assert.equal(icertis.VERIFIED_AT, '2026-07-16')
  assert.equal(icertis.OFFICIAL_CAREERS_URL, 'https://www.icertis.com/company/careers/')
  assert.equal(
    icertis.CANDIDATE_EXPERIENCE_URL,
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/?',
  )
  assert.equal(icertis.WORKSPACE_DOMAIN, 'iaaviz.fa.ocs.oraclecloud.com')
  assert.equal(icertis.SITE_NUMBER, 'Jobs-at-Icertis')
  assert.equal(icertis.CANDIDATE_EXPERIENCE_SHELL_SITE_NUMBER, 'CX_1')
  assert.equal(icertis.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(icertis.hasOfficialCandidateExperienceSignal(officialCandidateExperienceHtml), true)
})

test('Icertis keeps listing and detail URLs pinned to the verified public Oracle board contract', async () => {
  const icertis = await loadIcertisModule()

  assert.equal(
    icertis.buildSearchUrl(),
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=Jobs-at-Icertis,limit=24,offset=0,location=India',
  )
  assert.equal(
    icertis.buildSearchUrl({ page: 2, limit: 10 }),
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=Jobs-at-Icertis,limit=10,offset=20,location=India',
  )
  assert.equal(
    icertis.buildJobDetailUrl('7407'),
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/7407',
  )
  assert.equal(
    icertis.buildJobDetailApiUrl('7407'),
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%227407%22,siteNumber=Jobs-at-Icertis',
  )
})

test('extractSearchResults keeps only India requisitions and normalizes Icertis listings', async () => {
  const icertis = await loadIcertisModule()
  const jobs = icertis.extractSearchResults(listingPayload)

  assert.deepEqual(jobs, [{
    title: 'Lead Functional Consultant, Customer Support(L2)',
    company: 'Icertis',
    department: 'Customer Support',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    jobId: '7407',
    requisitionId: '7407',
    sourceUrl: 'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/7407',
    applyUrl: 'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/7407',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-04',
    closingDate: null,
    jobDescription:
      'Icertis Solutions Private Limited is seeking a Lead Functional Consultant to join our Customer Support - L2 team.',
    remoteStatus: 'Hybrid',
    siteNumber: 'Jobs-at-Icertis',
  }])
})

test('extractJobDetail enriches Icertis requisitions from the public Oracle detail API', async () => {
  const icertis = await loadIcertisModule()
  const listing = icertis.extractSearchResults(listingPayload)[0]
  const detail = icertis.extractJobDetail(detailPayload, listing)

  assert.equal(detail.title, 'Lead Functional Consultant, Customer Support(L2)')
  assert.equal(detail.company, 'Icertis')
  assert.equal(detail.department, 'Customer Support')
  assert.equal(detail.location, 'Pune, Maharashtra, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '7407')
  assert.equal(detail.requisitionId, '7407')
  assert.equal(
    detail.applyUrl,
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/7407',
  )
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.remoteStatus, 'Hybrid')
  assert.match(detail.minimumQualification, /Bachelor's degree/i)
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [])
  assert.equal(detail.postingDate, '2026-06-04')
  assert.equal(detail.closingDate, null)
  assert.match(detail.jobDescription, /Lead Functional Consultant/i)
  assert.match(detail.jobDescription, /delivering exceptional customer support/i)
  assert.match(detail.jobDescription, /Lead and mentor a team of functional consultants/i)
})

test('run verifies the first-party careers handoff before calling the public Oracle APIs', async () => {
  const icertis = await loadIcertisModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await icertis.createIcertisScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-16T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === icertis.OFFICIAL_CAREERS_URL) return officialCareersHtml
      if (url === icertis.CANDIDATE_EXPERIENCE_URL) return officialCandidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === icertis.buildSearchUrl()) return listingPayload
      if (url === icertis.buildJobDetailApiUrl('7407')) return detailPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [
    icertis.OFFICIAL_CAREERS_URL,
    icertis.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    icertis.buildSearchUrl(),
    icertis.buildJobDetailApiUrl('7407'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'icertis')
  assert.equal(jobs[0].company, 'Icertis')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-16T00:00:00.000Z')
})

test('run fails closed when the verified Icertis careers page or Oracle candidate experience shell drifts materially', async () => {
  const icertis = await loadIcertisModule()

  await assert.rejects(
    icertis.createIcertisScraper({
      fetchText: async (url) => {
        if (url === icertis.OFFICIAL_CAREERS_URL) {
          return officialCareersHtml.replace('Explore Open Roles', 'Browse Jobs')
        }

        return officialCandidateExperienceHtml
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Icertis careers page/i,
  )

  await assert.rejects(
    icertis.createIcertisScraper({
      fetchText: async (url) => {
        if (url === icertis.OFFICIAL_CAREERS_URL) return officialCareersHtml
        return officialCandidateExperienceHtml.replace('data-sitenumber="CX_1"', 'data-sitenumber="CX_9"')
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Oracle candidate experience page/i,
  )
})
