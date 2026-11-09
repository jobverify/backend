import assert from 'node:assert/strict'
import test from 'node:test'

const officialCorporateCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | JPMorganChase</title>
      <link rel="canonical" href="https://www.jpmorganchase.com/careers" />
    </head>
    <body>
      <a href="https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions" target="_blank">
        Join our team
      </a>
      <a href="/careers/explore-opportunities">Explore opportunities</a>
      <p>JPMorgan Chase &amp; Co. is an Equal Opportunity Employer, including Disability/Veterans.</p>
    </body>
  </html>
`

const officialCandidateExperienceHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>JPMC Candidate Experience page</title>
      <base
        href="/hcmUI/CandidateExperience/en/sites/CX_1001"
        data-apibaseurl="https://jpmc.fa.oraclecloud.com:443"
        data-sitenumber="CX_1001"
      />
    </head>
    <body>
      <a href="https://www.careersatchase.com/content/index">Careers at Chase</a>
      <a href="https://careers.jpmorgan.com">GLOBAL</a>
      <p>JPMorgan Chase &amp; Co. is an equal opportunity employer and affirmative action employer Disability/Veteran.</p>
    </body>
  </html>
`

const listingPayload = {
  items: [{
    Limit: 24,
    TotalJobsCount: 2,
    requisitionList: [
      {
        Id: '210730346',
        Title: 'Applied AI/ML Lead',
        PostedDate: '2026-07-13',
        PostingEndDate: null,
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Bengaluru, Karnataka, India',
        JobFamily: 'Predictive Science',
        JobFunction: 'Data & Analytics',
        WorkplaceType: '',
        ShortDescriptionStr: 'Contribute to a transformative journey and make a substantial impact ',
        secondaryLocations: [],
      },
      {
        Id: '999999999',
        Title: 'US-only Role',
        PostedDate: '2026-07-13',
        PostingEndDate: null,
        PrimaryLocationCountry: 'US',
        PrimaryLocation: 'New York, New York, United States',
        JobFamily: 'Operations',
        JobFunction: 'Operations',
        WorkplaceType: '',
        ShortDescriptionStr: 'Should be filtered out.',
        secondaryLocations: [],
      },
    ],
  }],
}

const detailPayload = {
  items: [{
    Id: '210730346',
    Title: 'Applied AI/ML Lead',
    Category: 'Predictive Science',
    RequisitionType: 'Professional',
    ExternalPostedStartDate: '2026-07-13T16:31:16+00:00',
    JobSchedule: 'Full time',
    StudyLevel: null,
    ExternalPostedEndDate: '2026-07-31T04:00:00+00:00',
    ExternalDescriptionStr: `
      <p>We have an exciting and rewarding opportunity for you to take your software engineering career to the next level.</p>
      <p>As an Applied AI/ML Vice President within Asset &amp; Wealth Management, you will utilize your quantitative, data science, and analytical skills to tackle complex problems.</p>
      <p><strong>Required qualifications, capabilities and skills:</strong></p>
      <ul>
        <li>Formal training or certification on software engineering concepts and 5+ years applied experience.</li>
        <li>Strong experience in natural language processing (NLP).</li>
      </ul>
      <p><strong>Preferred Qualifications, capabilities and skills:</strong></p>
      <ul>
        <li>Financial service background.</li>
      </ul>
    `,
    CorporateDescriptionStr: `
      <p>JPMorganChase, one of the oldest financial institutions, offers innovative financial solutions under the J.P. Morgan and Chase brands.</p>
    `,
    OrganizationDescriptionStr: `
      <p>Asset &amp; Wealth Management delivers industry-leading investment management and private banking solutions.</p>
    `,
    ShortDescriptionStr: 'Contribute to a transformative journey and make a substantial impact ',
    PrimaryLocation: 'Bengaluru, Karnataka, India',
    PrimaryLocationCountry: 'IN',
    ExternalQualificationsStr: 'Formal training or certification on software engineering concepts and 5+ years applied experience.',
    ExternalResponsibilitiesStr: '',
    BusinessUnit: 'Asset & Wealth Management',
    Department: null,
    JobFunction: 'Data & Analytics',
    secondaryLocations: [],
    skills: [
      { Skill: 'Python' },
      { Skill: 'Machine Learning' },
    ],
  }],
}

const loadChaseIndiaModule = async () => {
  try {
    return await import('../../scraper/chaseindia/script.js')
  } catch {
    assert.fail('Expected Chase India scraper module at ../../scraper/chaseindia/script.js')
  }
}

test('Chase India verifies the current first-party JPMorgan careers handoff surfaces', async () => {
  const chaseIndia = await loadChaseIndiaModule()

  assert.equal(chaseIndia.hasOfficialCorporateCareersSignal(officialCorporateCareersHtml), true)
  assert.equal(chaseIndia.hasOfficialCandidateExperienceSignal(officialCandidateExperienceHtml), true)
})

test('Chase India keeps search and detail URLs on the verified Oracle Cloud public surface', async () => {
  const chaseIndia = await loadChaseIndiaModule()

  assert.equal(
    chaseIndia.buildSearchUrl(),
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=24,offset=0,location=India',
  )
  assert.equal(
    chaseIndia.buildSearchUrl({ page: 2, limit: 10 }),
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1001,limit=10,offset=20,location=India',
  )
  assert.equal(
    chaseIndia.buildJobDetailUrl('210730346'),
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
  )
  assert.equal(
    chaseIndia.buildJobDetailApiUrl('210730346'),
    'https://jpmc.fa.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22210730346%22,siteNumber=CX_1001',
  )
})

test('extractSearchResults keeps only India requisitions and normalizes Chase India listings', async () => {
  const chaseIndia = await loadChaseIndiaModule()
  const jobs = chaseIndia.extractSearchResults(listingPayload)

  assert.deepEqual(jobs, [{
    title: 'Applied AI/ML Lead',
    company: 'Chase India',
    department: 'Data & Analytics',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '210730346',
    requisitionId: '210730346',
    sourceUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
    applyUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-13',
    closingDate: null,
    jobDescription: 'Contribute to a transformative journey and make a substantial impact',
    remoteStatus: null,
    siteNumber: 'CX_1001',
  }])
})

test('extractJobDetail enriches Chase India requisitions from the public Oracle detail API', async () => {
  const chaseIndia = await loadChaseIndiaModule()
  const listing = chaseIndia.extractSearchResults(listingPayload)[0]
  const detail = chaseIndia.extractJobDetail(detailPayload, listing)

  assert.equal(detail.title, 'Applied AI/ML Lead')
  assert.equal(detail.company, 'Chase India')
  assert.equal(detail.department, 'Data & Analytics')
  assert.equal(detail.location, 'Bengaluru, Karnataka, India')
  assert.equal(detail.city, 'Bengaluru')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '210730346')
  assert.equal(detail.requisitionId, '210730346')
  assert.equal(
    detail.applyUrl,
    'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/210730346',
  )
  assert.equal(detail.employmentType, 'Full time')
  assert.equal(detail.experienceRequired, '5+ years applied experience')
  assert.equal(
    detail.minimumQualification,
    'Formal training or certification on software engineering concepts and 5+ years applied experience.',
  )
  assert.equal(detail.preferredQualification, 'Financial service background.')
  assert.deepEqual(detail.requiredSkills, [
    'Python',
    'Machine Learning',
  ])
  assert.equal(detail.postingDate, '2026-07-13')
  assert.equal(detail.closingDate, '2026-07-31')
  assert.match(detail.jobDescription, /software engineering career to the next level/i)
  assert.match(detail.jobDescription, /J\.P\. Morgan and Chase brands/i)
})

test('run verifies the official careers handoff before calling the public Oracle APIs', async () => {
  const chaseIndia = await loadChaseIndiaModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await chaseIndia.createChaseIndiaScraper({
    maxPages: 1,
    maxJobs: 1,
    now: () => '2026-07-14T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === chaseIndia.CORPORATE_CAREERS_URL) return officialCorporateCareersHtml
      if (url === chaseIndia.CANDIDATE_EXPERIENCE_URL) return officialCandidateExperienceHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === chaseIndia.buildSearchUrl()) return listingPayload
      if (url === chaseIndia.buildJobDetailApiUrl('210730346')) return detailPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedTextUrls, [
    chaseIndia.CORPORATE_CAREERS_URL,
    chaseIndia.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    chaseIndia.buildSearchUrl(),
    chaseIndia.buildJobDetailApiUrl('210730346'),
    chaseIndia.buildSearchUrl(),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'chaseindia')
  assert.equal(jobs[0].company, 'Chase India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run fails closed when the verified JPMorgan careers handoff drifts materially', async () => {
  const chaseIndia = await loadChaseIndiaModule()

  await assert.rejects(
    chaseIndia.createChaseIndiaScraper({
      fetchText: async (url) => {
        if (url === chaseIndia.CORPORATE_CAREERS_URL) {
          return officialCorporateCareersHtml.replace('Join our team', 'Work here')
        }
        return officialCandidateExperienceHtml
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified official JPMorgan careers page/i,
  )

  await assert.rejects(
    chaseIndia.createChaseIndiaScraper({
      fetchText: async (url) => {
        if (url === chaseIndia.CORPORATE_CAREERS_URL) return officialCorporateCareersHtml
        return officialCandidateExperienceHtml.replace('Careers at Chase', 'Chase roles')
      },
      fetchJson: async () => listingPayload,
    }).run(),
    /verified JPMC candidate experience page/i,
  )
})
