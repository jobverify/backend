import assert from 'node:assert/strict'
import test from 'node:test'
import { replayVerint } from '../../scraper/verintsystems/currentFixture20261114.js'

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

test('Verint Systems historical Oracle pure validators retain their original contract', async () => {
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

  assert.equal(verint.extractJobDetail(detailPayload3921, listings[1]).jobId, '3921')
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

test('Verint Systems run verifies the current corporate handoff and original India native criteria', async () => {
  const verint = await loadModule()
  const { jobs, requests } = await replayVerint(verint.run)
  assert.deepEqual(jobs.map(row => [row.title, row.country, row.postingDate]), [
    ['ServiceNow Adminstrator', 'India', '2026-11-12T13:47:09.067+00:00'],
  ])
  assert.equal(jobs[0].sourceNativeDetailRecord.descriptionHtml, jobs[0].jobDescription)
  assert.equal(jobs[0].sourceNativeJobPosting.description, jobs[0].jobDescription)
  assert.equal(requests.length, 8)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})

test('Verint Systems fails closed when the current corporate or native full criteria change', async () => {
  const verint = await loadModule()
  for (const target of [0, 3]) {
    await assert.rejects(replayVerint(verint.run, { mutate: (entity, index) => {
      if (index !== target) return entity
      const html = entity.body.toString('utf8')
      const changed = target === 0 ? html.replace('Join Our Global Team', 'Browse roles')
        : html.replace('About the Role:', 'This role is closed')
      assert.notEqual(changed, html)
      return { ...entity, body: Buffer.from(changed, 'utf8') }
    } }), /Current native text contract/)
  }
})
