import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aster DM Healthcare, India</title>
    <link rel="canonical" href="https://www.asterdmhealthcare.in/" />
  </head>
  <body>
    <nav>
      <a href="/careers" title="CAREERS">CAREERS</a>
    </nav>
    <section>
      <h1>Making millions of lives better with our network of comprehensive healthcare.</h1>
      <p>Aster DM Healthcare works on a singular mission, to make quality healthcare accessible to all.</p>
    </section>
  </body>
</html>
`

const qualityCareHomepageHtml = `
<html><head><title>Aster Quality Care</title></head><body>
  <nav><a href="/careers">Careers</a></nav>
  <p>Aster DM Quality Care Ltd.</p>
  <em>*Formerly Aster DM Healthcare Ltd.</em>
</body></html>`

const qualityCareCareersHtml = `
<html><head><title>Aster Quality Care</title></head><body>
  <p>Aster DM Quality Care Ltd.</p>
  <div>Build a Career That Makes Every Moment Matter</div>
  <p>Across Aster, CARE, Evercare and KIMSHEALTH Bangladesh, every role contributes to something bigger.</p>
  <form id="career-contact-form" method="POST" enctype="multipart/form-data"
    data-action="https://www.asterqualitycare.com/careers/contact">
    <input type="file" id="resume-upload" name="resume" />
  </form>
  <em>*Formerly Aster DM Healthcare Ltd.</em>
</body></html>`

test('current Aster Quality Care careers form has no published jobs and never queries legacy Oracle', async () => {
  const aster = await loadScriptModule()
  const requested = []
  const jobs = await aster.createAsterDmHealthcareScraper({
    fetchText: async (url) => {
      requested.push(url)
      if (url === 'https://www.asterqualitycare.com/') return qualityCareHomepageHtml
      if (url === 'https://www.asterqualitycare.com/careers') return qualityCareCareersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => { throw new Error(`Unexpected Oracle request: ${url}`) },
  }).run()
  assert.deepEqual(requested, ['https://www.asterqualitycare.com/', 'https://www.asterqualitycare.com/careers'])
  assert.deepEqual(jobs, [])
  assert.equal(aster.hasCurrentHomepageSignal(qualityCareHomepageHtml), true)
  assert.equal(aster.hasCurrentCareersIntakeSignal(qualityCareCareersHtml), true)
  assert.equal(aster.hasCurrentCareersIntakeSignal(qualityCareCareersHtml.replace('name="resume"', 'name="other"')), false)
  assert.equal(aster.hasCurrentCareersIntakeSignal(qualityCareCareersHtml + '<a href="https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">Jobs</a>'), false)
  await assert.rejects(aster.createAsterDmHealthcareScraper({
    fetchText: async (url) => url.endsWith('/careers')
      ? qualityCareCareersHtml.replace('name="resume"', 'name="other"')
      : qualityCareHomepageHtml,
  }).run(), /verified careers page/i)
  await assert.rejects(aster.createAsterDmHealthcareScraper({
    fetchText: async () => qualityCareHomepageHtml.replace('Formerly Aster DM Healthcare Ltd.', 'Formerly another company'),
  }).run(), /verified official homepage/i)
})

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aster DM Healthcare Careers | Build Your Future Today</title>
    <link rel="canonical" href="https://www.asterdmhealthcare.in/careers" />
  </head>
  <body>
    <main>
      <h1>Build Your Future Today</h1>
      <p>Explore Aster career opportunities. We're looking for skilled professionals who are passionate about healthcare.</p>
      <a href="https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">Explore Jobs</a>
      <a href="https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">View Openings</a>
      <section>
        <h2>How do I apply for a role at Aster?</h2>
        <p>To apply for a position at Aster DM Healthcare, please visit our Careers page.</p>
      </section>
    </main>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aster DM Healthcare Careers | Build Your Future Today</title>
    <link rel="canonical" href="https://www.asterdmhealthcare.in/careers" />
  </head>
  <body>
    <main>
      <h1>United to make a healthier planet for every life.</h1>
      <p>Explore Aster career opportunities we're looking for skilled professionals who are passionate about healthcare. Browse our current job vacancies and find your next role with us.</p>
      <a href="https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">Explore Jobs</a>
      <section>
        <h2>Career Horizons</h2>
        <a href="https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX">View Openings</a>
      </section>
      <section>
        <h2>How do I apply for a role at Aster?</h2>
        <p>Click or tap the Explore Jobs button.</p>
      </section>
    </main>
  </body>
</html>
`

const candidateExperienceHtml = `
<!doctype html>
<html lang="en" dir="ltr">
  <head>
    <title>Aster DM Healthcare</title>
    <meta property="og:title" content="Aster DM Healthcare Careers" />
    <meta property="og:description" content="" />
    <meta property="og:site_name" content="Aster DM Healthcare" />
    <base
      href="/hcmUI/CandidateExperience/en/sites/CX"
      data-apibaseurl="https://hcdt.fa.us2.oraclecloud.com:443"
      data-sitenumber="CX"
    />
  </head>
  <body>
    <div id="jobSearchPage">Search Aster DM Healthcare jobs</div>
  </body>
</html>
`

const listingPayload = {
  items: [{
    Limit: 24,
    TotalJobsCount: 2430,
    requisitionList: [
      {
        Id: '31150',
        Title: 'Insurance Officer.Insurance.Aster MIMS Kannur',
        PostedDate: '2026-06-30',
        PostingEndDate: null,
        Language: 'US',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'India',
        HotJobFlag: false,
        JobFamily: null,
        JobFunction: null,
        WorkerType: null,
        ContractType: null,
        JobSchedule: null,
        JobType: null,
        StudyLevel: null,
        BusinessUnit: null,
        Department: null,
        Organization: null,
        ShortDescriptionStr: '',
        WorkplaceType: '',
        secondaryLocations: [],
      },
      {
        Id: '99999',
        Title: 'US-only Role',
        PostedDate: '2026-06-30',
        PostingEndDate: null,
        Language: 'US',
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'Naples, Florida, United States',
        HotJobFlag: false,
        JobFamily: 'Operations',
        JobFunction: 'Operations',
        WorkerType: null,
        ContractType: null,
        JobSchedule: 'Full time',
        JobType: null,
        StudyLevel: null,
        BusinessUnit: null,
        Department: null,
        Organization: null,
        ShortDescriptionStr: 'Should be filtered out.',
        WorkplaceType: '',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '31150',
    Title: 'Insurance Officer.Insurance.Aster MIMS Kannur',
    Category: 'Enabling & Support',
    RequisitionType: 'Budgeted',
    RequisitionId: 300017057013434,
    ExternalPostedStartDate: '2026-06-30T16:34:43+00:00',
    JobSchedule: 'Full time',
    StudyLevel: null,
    ContractType: null,
    ExternalPostedEndDate: null,
    ExternalDescriptionStr: '',
    ShortDescriptionStr: '',
    PrimaryLocation: 'India',
    PrimaryLocationCountry: 'IN',
    ExternalQualificationsStr: '',
    ExternalResponsibilitiesStr: '',
    WorkplaceType: '',
    Department: null,
    JobFunction: null,
    secondaryLocations: [],
    skills: [],
    workLocation: [
      {
        LocationId: 300003668849459,
        LocationName: 'Aster MIMS Kannur',
        TownOrCity: 'Kannur',
        PostalCode: '670621',
        Country: 'IN',
        Region1: null,
        Region2: null,
        Region3: null,
      },
    ],
    otherWorkLocations: [],
  }],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/asterdmhealthcare/script.js')
  } catch {
    assert.fail('Expected Aster DM Healthcare scraper module at ../../scraper/asterdmhealthcare/script.js')
  }
}

test('Aster DM Healthcare verifies the live first-party homepage, careers handoff, and Oracle candidate experience shell', async () => {
  const aster = await loadScriptModule()

  assert.equal(aster.SOURCE, 'asterdmhealthcare')
  assert.equal(aster.COMPANY_NAME, 'Aster DM Healthcare')
  assert.equal(aster.VERIFIED_AT, '2026-10-03')
  assert.equal(aster.OFFICIAL_HOMEPAGE_URL, 'https://www.asterqualitycare.com/')
  assert.equal(aster.OFFICIAL_CAREERS_URL, 'https://www.asterqualitycare.com/careers')
  assert.equal(
    aster.CANDIDATE_EXPERIENCE_URL,
    'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
  )
  assert.equal(aster.WORKSPACE_DOMAIN, 'hcdt.fa.us2.oraclecloud.com')
  assert.equal(aster.SITE_NUMBER, 'CX')
  assert.equal(aster.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aster.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(aster.hasOfficialCareersPageSignal(currentCareersHtml), true)
  assert.equal(aster.hasOfficialCandidateExperienceSignal(candidateExperienceHtml), true)
})

test('Aster DM Healthcare keeps finder, detail, and public job URLs pinned to the verified Oracle Cloud surface', async () => {
  const aster = await loadScriptModule()

  assert.equal(
    aster.buildSearchUrl(),
    'https://hcdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=24,offset=0,location=India',
  )
  assert.equal(
    aster.buildSearchUrl({ page: 2, limit: 10 }),
    'https://hcdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX,limit=10,offset=20,location=India',
  )
  assert.equal(
    aster.buildJobDetailUrl('31150'),
    'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/31150',
  )
  assert.equal(
    aster.buildJobApplyUrl('31150'),
    'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/31150/apply',
  )
  assert.equal(
    aster.buildJobDetailApiUrl('31150'),
    'https://hcdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%2231150%22,siteNumber=CX',
  )
})

test('extractSearchResults and extractJobDetail normalize live Aster DM Healthcare Oracle requisitions', async () => {
  const aster = await loadScriptModule()
  const listings = aster.extractSearchResults(listingPayload)

  assert.deepEqual(listings, [{
    title: 'Insurance Officer.Insurance.Aster MIMS Kannur',
    company: 'Aster DM Healthcare',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: '31150',
    requisitionId: '31150',
    sourceUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/31150',
    applyUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/31150/apply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30',
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    siteNumber: 'CX',
  }])

  const detail = aster.extractJobDetail(detailPayload, listings[0])

  assert.deepEqual(detail, {
    title: 'Insurance Officer.Insurance.Aster MIMS Kannur',
    company: 'Aster DM Healthcare',
    department: 'Enabling & Support',
    location: 'Kannur, India',
    city: 'Kannur',
    country: 'India',
    jobId: '31150',
    requisitionId: '31150',
    sourceUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/31150',
    applyUrl: 'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/31150/apply',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30',
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    siteNumber: 'CX',
  })
})
