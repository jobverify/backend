import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Verint</title>
  </head>
  <body>
    <h1>Everything you need to know about careers at Verint</h1>
    <a href="https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">
      Join Our Global Team
    </a>
    <a href="https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">
      See Our Current Vacancies
    </a>
  </body>
</html>
`

const candidateExperienceHtml = `
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <title>Verint</title>
    <base href="/hcmUI/CandidateExperience/en/sites/CX/" />
    <meta property="og:title" content="Verint Careers" />
    <meta property="og:description" content="JOIN OUR TEAM" />
  </head>
  <body>
    <div data-apibaseurl="https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com:443" data-sitenumber="CX"></div>
    <div id="jobSearchPage">Search Verint jobs</div>
  </body>
</html>
`

const listingPayload = {
  items: [{
    Limit: 24,
    TotalJobsCount: 3,
    SiteNumber: 'CX',
    requisitionList: [
      {
        Id: '3884',
        Title: 'Software Engineer',
        PostedDate: '2026-07-10',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Bengaluru, Karnataka, India',
        WorkplaceType: 'On-site',
        secondaryLocations: [],
      },
      {
        Id: '3921',
        Title: 'SOC L1 Analyst',
        PostedDate: '2026-07-12',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Bengaluru, Karnataka, India',
        WorkplaceType: 'On-site',
        secondaryLocations: [],
      },
      {
        Id: '4999',
        Title: 'Mid-Market Account Executive',
        PostedDate: '2026-07-11',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'United States',
        WorkplaceType: 'Remote',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload3884 = {
  items: [{
    Id: '3884',
    Title: 'Software Engineer',
    JobFunction: 'Engineering',
    JobSchedule: 'Full time',
    ExternalPostedStartDate: '2026-07-10T09:00:00+00:00',
    StudyLevel: 'Bachelor degree',
    PrimaryLocation: 'Bengaluru, Karnataka, India',
    PrimaryLocationCountry: 'IN',
    WorkplaceType: 'On-site',
    ExternalDescriptionStr: '<p>Build cloud-native customer engagement services.</p>',
    secondaryLocations: [],
    skills: [{ Skill: 'Java' }, { Skill: 'React' }],
  }],
}

const detailPayload3921 = {
  items: [{
    Id: '3921',
    Title: 'SOC L1 Analyst',
    JobFunction: 'Security Operations',
    JobSchedule: 'Full time',
    ExternalPostedStartDate: '2026-07-12T09:00:00+00:00',
    StudyLevel: 'Bachelor degree',
    PrimaryLocation: 'Bengaluru, Karnataka, India',
    PrimaryLocationCountry: 'IN',
    WorkplaceType: 'On-site',
    ExternalDescriptionStr: '<p>Monitor security telemetry and triage incidents.</p>',
    secondaryLocations: [],
    skills: [{ Skill: 'Cyber Security' }, { Skill: 'Log Monitoring' }],
  }],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/verintsystems/script.js')
  } catch {
    assert.fail('Expected Verint Systems scraper module at ../../scraper/verintsystems/script.js')
  }
}

test('Verint Systems keeps the verified Oracle careers handoff pinned', async () => {
  const verint = await loadModule()

  assert.equal(verint.CAREERS_URL, 'https://www.verint.com/careers/')
  assert.equal(
    verint.CANDIDATE_EXPERIENCE_URL,
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
  )
  assert.equal(verint.WORKSPACE_DOMAIN, 'fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com')
  assert.equal(verint.SITE_NUMBER, 'CX')
  assert.equal(verint.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(verint.hasOfficialCandidateExperienceSignal(candidateExperienceHtml), true)
})

test('Verint Systems builds the expected Oracle finder and detail URLs', async () => {
  const verint = await loadModule()

  assert.equal(
    verint.buildSearchUrl(),
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=24,offset=0,location=India',
  )
  assert.equal(
    verint.buildSearchUrl({ page: 2, limit: 10 }),
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=10,offset=20,location=India',
  )
  assert.equal(
    verint.buildJobDetailUrl('3884'),
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3884',
  )
  assert.equal(
    verint.buildJobDetailApiUrl('3884'),
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%223884%22,siteNumber=CX',
  )
})

test('Verint Systems extracts India requisitions from the Oracle payloads', async () => {
  const verint = await loadModule()
  const listings = verint.extractSearchResults(listingPayload)

  assert.deepEqual(
    listings.map((job) => [job.title, job.location, job.jobId]),
    [
      ['Software Engineer', 'Bengaluru, Karnataka, India', '3884'],
      ['SOC L1 Analyst', 'Bengaluru, Karnataka, India', '3921'],
    ],
  )

  assert.deepEqual(verint.extractJobDetail(detailPayload3884, listings[0]), {
    title: 'Software Engineer',
    company: 'Verint Systems',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '3884',
    requisitionId: '3884',
    sourceUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3884',
    applyUrl: 'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/3884',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: 'Bachelor degree',
    preferredQualification: null,
    requiredSkills: ['Java', 'React'],
    postingDate: '2026-07-10',
    closingDate: null,
    jobDescription: 'Build cloud-native customer engagement services.',
    remoteStatus: 'On-site',
    siteNumber: 'CX',
  })
})

test('Verint Systems run verifies the careers handoff, Oracle shell, and public India jobs payload', async () => {
  const verint = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await verint.createVerintSystemsScraper({
    maxPages: 1,
    now: () => '2026-07-18T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === verint.CAREERS_URL) return officialCareersHtml
      if (url === verint.CANDIDATE_EXPERIENCE_URL) return candidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === verint.buildSearchUrl()) return listingPayload
      if (url === verint.buildJobDetailApiUrl('3884')) return detailPayload3884
      if (url === verint.buildJobDetailApiUrl('3921')) return detailPayload3921
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [verint.CAREERS_URL, verint.CANDIDATE_EXPERIENCE_URL])
  assert.deepEqual(requestedJsonUrls, [
    verint.buildSearchUrl(),
    verint.buildJobDetailApiUrl('3884'),
    verint.buildJobDetailApiUrl('3921'),
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.location, job.source]),
    [
      ['Software Engineer', 'Engineering', 'Bengaluru, Karnataka, India', 'verintsystems'],
      ['SOC L1 Analyst', 'Security Operations', 'Bengaluru, Karnataka, India', 'verintsystems'],
    ],
  )
})

test('Verint Systems fails closed when the verified first-party or Oracle shell drifts materially', async () => {
  const verint = await loadModule()

  await assert.rejects(
    verint.createVerintSystemsScraper({
      fetchText: async (url) => {
        if (url === verint.CAREERS_URL) {
          return officialCareersHtml.replace('Join Our Global Team', 'Browse roles')
        }
        return candidateExperienceHtml
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Verint careers page/i,
  )

  await assert.rejects(
    verint.createVerintSystemsScraper({
      fetchText: async (url) => {
        if (url === verint.CAREERS_URL) return officialCareersHtml
        return candidateExperienceHtml.replace('data-sitenumber="CX"', 'data-sitenumber="CX_2"')
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified Oracle candidate experience page/i,
  )
})
