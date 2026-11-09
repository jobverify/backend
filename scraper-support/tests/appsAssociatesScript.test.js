import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Apps Associates</title>
  </head>
  <body>
    <h1>Advance Your Career with an Industry Leader known for Growth and Opportunity</h1>
    <a href="https://appsassociates.com/jobs/">See Our Current Job Openings</a>
    <p>Want to be part of our dynamic, innovative team? Browse open positions and learn more about our culture.</p>
    <p>Which documents should be included with the online application and in which format?</p>
    <p>Apps Associates offers recent graduate programs that vary by country.</p>
  </body>
</html>
`

const OFFICIAL_JOBS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Apps Associates</title>
    <meta name="description" content="Explore Apps Associates Careers and join a dynamic team where innovation thrives. Discover growth opportunities and shape your future with us. Apply today!" />
    <link rel="canonical" href="https://appsassociates.com/jobs/" />
  </head>
  <body class="is-page-jobs">
    <noscript>Jobs</noscript>
  </body>
</html>
`

const LISTING_PAYLOAD = {
  items: [
    {
      TotalJobsCount: 29,
      Limit: 24,
      requisitionList: [
        {
          Id: '1654',
          Title: 'HCM Cloud Technical Consultant',
          PostedDate: '2026-07-23',
          PostingEndDate: null,
          PrimaryLocationCountry: 'IN',
          PrimaryLocation: 'Hyderabad, Telangana, India',
          ShortDescriptionStr:
            'Apps Associates seeks a Fusion HCM Cloud Technical Consultant who can understand business requirement and other specifications.',
          secondaryLocations: [],
          WorkplaceType: '',
          JobSchedule: null,
          RequisitionType: null,
          JobType: null,
          WorkerType: null,
          ContractType: null,
          JobFunction: null,
          Department: null,
          Category: null,
          JobFamily: null,
          ExternalPostedStartDate: null,
          ExternalPostedEndDate: null,
        },
      ],
    },
  ],
}

const DETAIL_PAYLOAD = {
  items: [
    {
      Id: '1654',
      Title: 'HCM Cloud Technical Consultant',
      RequisitionType: 'Employee',
      ExternalPostedStartDate: '2026-07-23T05:08:06+00:00',
      JobSchedule: 'Full time',
      StudyLevel: "Bachelor's Degree",
      ExternalDescriptionStr:
        '<p>Work from offshore in the technical track of client engagements to perform activities such as technical design, build, and unit testing.</p>',
      ShortDescriptionStr:
        'Apps Associates seeks a Fusion HCM Cloud Technical Consultant who can understand business requirement and other specifications.',
      ExternalQualificationsStr: '',
      ExternalResponsibilitiesStr: '',
      PrimaryLocation: 'Hyderabad, Telangana, India',
      PrimaryLocationCountry: 'IN',
      WorkplaceType: '',
      JobFunction: null,
      Department: null,
      Category: null,
      JobFamily: null,
      secondaryLocations: [],
      skills: [],
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/appsassociates/script.js')
  } catch {
    assert.fail('Expected Apps Associates scraper module at ../../scraper/appsassociates/script.js')
  }
}

test('Apps Associates helpers stay pinned to the live first-party Oracle CX_9003 handoff verified on Sunday, July 26, 2026', async () => {
  const apps = await loadModule()

  assert.equal(apps.SOURCE, 'appsassociates')
  assert.equal(apps.COMPANY, 'Apps Associates')
  assert.equal(apps.CAREERS_URL, 'https://appsassociates.com/careers/')
  assert.equal(apps.CANDIDATE_EXPERIENCE_URL, 'https://appsassociates.com/jobs/')
  assert.equal(apps.WORKSPACE_DOMAIN, 'ebdt.fa.us2.oraclecloud.com')
  assert.equal(apps.SITE_NUMBER, 'CX_9003')
  assert.equal(apps.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(apps.hasOfficialJobsPageSignal(OFFICIAL_JOBS_PAGE_HTML), true)
  assert.equal(
    apps.buildSearchUrl(),
    'https://ebdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_9003,limit=24,offset=0,location=India',
  )
  assert.equal(
    apps.buildJobDetailApiUrl('1654'),
    'https://ebdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%221654%22,siteNumber=CX_9003',
  )
  assert.equal(
    apps.buildJobDetailUrl('1654'),
    'https://appsassociates.com/jobs/#en/sites/CX_9003/job/1654',
  )
})

test('Apps Associates extracts India Oracle listings and merges detail payloads into normalized jobs', async () => {
  const apps = await loadModule()
  const listings = apps.extractSearchResults(LISTING_PAYLOAD)

  assert.deepEqual(listings, [
    {
      title: 'HCM Cloud Technical Consultant',
      company: 'Apps Associates',
      department: null,
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '1654',
      requisitionId: '1654',
      sourceUrl: 'https://appsassociates.com/jobs/#en/sites/CX_9003/job/1654',
      applyUrl: 'https://appsassociates.com/jobs/#en/sites/CX_9003/job/1654',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-23',
      closingDate: null,
      jobDescription:
        'Apps Associates seeks a Fusion HCM Cloud Technical Consultant who can understand business requirement and other specifications.',
      remoteStatus: null,
      siteNumber: 'CX_9003',
    },
  ])

  assert.deepEqual(apps.extractPaginationSummary(LISTING_PAYLOAD), {
    hasNext: true,
    pageSize: 24,
    nextOffset: 24,
    totalCount: 29,
  })

  assert.deepEqual(apps.extractJobDetail(DETAIL_PAYLOAD, listings[0]), {
    title: 'HCM Cloud Technical Consultant',
    company: 'Apps Associates',
    department: null,
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: '1654',
    requisitionId: '1654',
    sourceUrl: 'https://appsassociates.com/jobs/#en/sites/CX_9003/job/1654',
    applyUrl: 'https://appsassociates.com/jobs/#en/sites/CX_9003/job/1654',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: "Bachelor's Degree",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-23',
    closingDate: null,
    jobDescription:
      'Work from offshore in the technical track of client engagements to perform activities such as technical design, build, and unit testing. Apps Associates seeks a Fusion HCM Cloud Technical Consultant who can understand business requirement and other specifications.',
    remoteStatus: null,
    siteNumber: 'CX_9003',
  })
})

test('Apps Associates returns Oracle-backed India jobs from the first-party careers handoff', async () => {
  const apps = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await apps.createAppsAssociatesScraper({
    maxPages: 1,
    maxJobs: 1,
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === apps.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === apps.CANDIDATE_EXPERIENCE_URL) return OFFICIAL_JOBS_PAGE_HTML
      throw new Error(`Unexpected Apps Associates text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === apps.buildSearchUrl()) return LISTING_PAYLOAD
      if (url === apps.buildJobDetailApiUrl('1654')) return DETAIL_PAYLOAD
      throw new Error(`Unexpected Apps Associates JSON URL: ${url}`)
    },
    now: () => '2026-07-26T04:30:00.000Z',
  }).run()

  assert.deepEqual(requestedTextUrls, [
    apps.CAREERS_URL,
    apps.CANDIDATE_EXPERIENCE_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    apps.buildSearchUrl(),
    apps.buildJobDetailApiUrl('1654'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'appsassociates')
  assert.equal(jobs[0].company, 'Apps Associates')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-26T04:30:00.000Z')
})

test('Apps Associates fails closed when the careers page or Oracle candidate experience shell drifts', async () => {
  const apps = await loadModule()

  await assert.rejects(
    apps.createAppsAssociatesScraper({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }).run(),
    /verified Apps Associates careers page/i,
  )

  await assert.rejects(
    apps.createAppsAssociatesScraper({
      fetchText: async (url) => {
        if (url === apps.CAREERS_URL) return VERIFIED_CAREERS_HTML
        return '<html><body><title>Jobs</title></body></html>'
      },
    }).run(),
    /Oracle jobs handoff page/i,
  )
})
