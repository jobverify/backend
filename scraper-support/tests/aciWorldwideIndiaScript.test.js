import assert from 'node:assert/strict'
import test from 'node:test'

const loadAciWorldwideIndiaModule = async () => {
  try {
    return await import('../../scraper/aciworldwideindia/script.js')
  } catch {
    assert.fail('Expected ACI Worldwide India scraper module at ../../scraper/aciworldwideindia/script.js')
  }
}

const officialCorporateCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | ACI Worldwide</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>ACI powers the global economy.</p>
      <p>Every person at ACI makes an impact on payments around the world.</p>
      <a href="https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/">
        Explore Opportunities
      </a>
    </main>
  </body>
</html>
`

const officialCandidateExperienceHtml = `
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <title>ACI Worldwide Job Opportunities</title>
    <meta property="og:title" content="ACI Worldwide Job Opportunities Careers" />
    <meta property="og:description" content="JOIN OUR TEAM" />
    <base
      href="/hcmUI/CandidateExperience/en/sites/CX"
      data-apibaseurl="https://ebwg.fa.us2.oraclecloud.com:443"
      data-sitenumber="CX"
    />
  </head>
  <body>
    <div id="jobSearchPage">Search ACI jobs</div>
  </body>
</html>
`

const listingPayload = {
  items: [{
    Offset: 0,
    Limit: 24,
    SiteNumber: 'CX',
    Location: null,
    TotalJobsCount: 2,
    requisitionList: [
      {
        Id: '19081',
        Title: 'Software Engineer',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Pune, Maharashtra, India',
        JobFunction: 'Software Engineering',
        Category: 'Product Development',
        JobSchedule: 'Full time',
        ExternalPostedStartDate: '2026-07-09T06:21:07+00:00',
        ExternalPostedEndDate: null,
        ShortDescriptionStr: 'Software Engineer',
        secondaryLocations: [],
      },
      {
        Id: '99999',
        Title: 'US-only Role',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'Naples, Florida, United States',
        JobFunction: 'Operations',
        Category: 'Operations',
        JobSchedule: 'Full time',
        ExternalPostedStartDate: '2026-07-09T06:21:07+00:00',
        ExternalPostedEndDate: null,
        ShortDescriptionStr: 'Should be filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '19081',
    Title: 'Software Engineer',
    PrimaryLocationCountry: 'IN',
    PrimaryLocation: 'Pune, Maharashtra, India',
    JobFunction: 'Software Engineering',
    Category: 'Product Development',
    Department: null,
    JobSchedule: 'Full time',
    RequisitionType: 'Professional',
    ExternalPostedStartDate: '2026-07-09T06:21:07+00:00',
    ExternalPostedEndDate: null,
    StudyLevel: 'Bachelor degree',
    ExternalQualificationsStr: 'Bachelor degree in Computer Science or a related field.',
    ShortDescriptionStr: 'Software Engineer',
    ExternalResponsibilitiesStr: 'Design and build payment software.',
    ExternalDescriptionStr: `
      <p><b>JOB SUMMARY:</b></p>
      <p>Plans, designs, develops and tests software systems or applications for software enhancements and new company products.</p>
    `,
    skills: [
      { Skill: 'Java' },
      { Skill: 'Spring Boot' },
    ],
    secondaryLocations: [],
  }],
}

test('ACI Worldwide India verifies the live first-party corporate and Oracle candidate experience surfaces', async () => {
  const aciWorldwideIndia = await loadAciWorldwideIndiaModule()

  assert.equal(aciWorldwideIndia.SOURCE, 'aciworldwideindia')
  assert.equal(aciWorldwideIndia.COMPANY_NAME, 'ACI Worldwide India')
  assert.equal(aciWorldwideIndia.COMPANY_DOMAIN, 'aciworldwide.com')
  assert.equal(aciWorldwideIndia.VERIFIED_AT, '2026-07-14')
  assert.equal(aciWorldwideIndia.CORPORATE_CAREERS_URL, 'https://www.aciworldwide.com/about-aci/careers')
  assert.equal(
    aciWorldwideIndia.CANDIDATE_EXPERIENCE_URL,
    'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/',
  )
  assert.equal(aciWorldwideIndia.WORKSPACE_DOMAIN, 'ebwg.fa.us2.oraclecloud.com')
  assert.equal(aciWorldwideIndia.SITE_NUMBER, 'CX')
  assert.equal(aciWorldwideIndia.hasOfficialCorporateCareersSignal(officialCorporateCareersHtml), true)
  assert.equal(aciWorldwideIndia.hasOfficialCandidateExperienceSignal(officialCandidateExperienceHtml), true)
})

test('ACI Worldwide India keeps search and detail URLs on the verified Oracle Cloud public surface', async () => {
  const aciWorldwideIndia = await loadAciWorldwideIndiaModule()

  assert.equal(
    aciWorldwideIndia.buildSearchUrl(),
    'https://ebwg.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=24,offset=0,location=India',
  )
  assert.equal(
    aciWorldwideIndia.buildSearchUrl({ page: 2, limit: 10 }),
    'https://ebwg.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=10,offset=20,location=India',
  )
  assert.equal(
    aciWorldwideIndia.buildJobDetailUrl('19081'),
    'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/19081',
  )
  assert.equal(
    aciWorldwideIndia.buildJobDetailApiUrl('19081'),
    'https://ebwg.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%2219081%22,siteNumber=CX',
  )
})

test('extractSearchResults keeps only India requisitions and normalizes ACI Worldwide India listings', async () => {
  const aciWorldwideIndia = await loadAciWorldwideIndiaModule()
  const jobs = aciWorldwideIndia.extractSearchResults(listingPayload)

  assert.deepEqual(jobs, [{
    title: 'Software Engineer',
    company: 'ACI Worldwide India',
    department: 'Software Engineering',
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    country: 'India',
    jobId: '19081',
    requisitionId: '19081',
    sourceUrl: 'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/19081',
    applyUrl: 'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/19081',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Software Engineer',
    remoteStatus: null,
    siteNumber: 'CX',
  }])
})

test('extractJobDetail enriches ACI Worldwide India requisitions from the public Oracle detail API', async () => {
  const aciWorldwideIndia = await loadAciWorldwideIndiaModule()
  const listing = aciWorldwideIndia.extractSearchResults(listingPayload)[0]
  const detail = aciWorldwideIndia.extractJobDetail(detailPayload, listing)

  assert.equal(detail.title, 'Software Engineer')
  assert.equal(detail.company, 'ACI Worldwide India')
  assert.equal(detail.department, 'Software Engineering')
  assert.equal(detail.location, 'Pune, Maharashtra, India')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '19081')
  assert.equal(detail.requisitionId, '19081')
  assert.equal(
    detail.applyUrl,
    'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/19081',
  )
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.minimumQualification, 'Bachelor degree in Computer Science or a related field.')
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [
    'Java',
    'Spring Boot',
  ])
  assert.equal(detail.postingDate, '2026-07-09')
  assert.equal(detail.closingDate, null)
  assert.match(detail.jobDescription, /Design and build payment software/i)
  assert.match(detail.jobDescription, /Plans, designs, develops and tests software systems/i)
})

test('run verifies the official careers handoff before calling the public Oracle APIs', async () => {
  const aciWorldwideIndia = await loadAciWorldwideIndiaModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await aciWorldwideIndia.createAciWorldwideIndiaScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-14T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === aciWorldwideIndia.CORPORATE_CAREERS_URL) return officialCorporateCareersHtml
      if (url === aciWorldwideIndia.CANDIDATE_EXPERIENCE_URL) return officialCandidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === aciWorldwideIndia.buildSearchUrl({ location: '' })) return listingPayload
      if (url === aciWorldwideIndia.buildJobDetailApiUrl('19081')) return detailPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [
    aciWorldwideIndia.CORPORATE_CAREERS_URL,
    aciWorldwideIndia.CANDIDATE_EXPERIENCE_URL,
    aciWorldwideIndia.CORPORATE_CAREERS_URL,
    aciWorldwideIndia.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    aciWorldwideIndia.buildSearchUrl({ location: '' }),
    aciWorldwideIndia.buildJobDetailApiUrl('19081'),
    aciWorldwideIndia.buildSearchUrl({ location: '' }),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'aciworldwideindia')
  assert.equal(jobs[0].company, 'ACI Worldwide India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run fails closed when the verified ACI corporate or Oracle candidate experience handoff drifts materially', async () => {
  const aciWorldwideIndia = await loadAciWorldwideIndiaModule()

  await assert.rejects(
    aciWorldwideIndia.createAciWorldwideIndiaScraper({
      fetchText: async (url) => {
        if (url === aciWorldwideIndia.CORPORATE_CAREERS_URL) {
          return officialCorporateCareersHtml.replace('Explore Opportunities', 'Browse Roles')
        }
        return officialCandidateExperienceHtml
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified official ACI Worldwide careers page/i,
  )

  await assert.rejects(
    aciWorldwideIndia.createAciWorldwideIndiaScraper({
      fetchText: async (url) => {
        if (url === aciWorldwideIndia.CORPORATE_CAREERS_URL) return officialCorporateCareersHtml
        return officialCandidateExperienceHtml.replace('data-sitenumber="CX"', 'data-sitenumber="CX_1"')
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Oracle candidate experience page/i,
  )
})
