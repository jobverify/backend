import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const jobsPageShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MakeMyTrip</title>
    <link href="/styles.css" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script src="/cdn/jquery.min.js"></script>
    <script src="/cdn/slick.min.js"></script>
    <script src="https://imgak.mmtcdn.com/mmt-careers-ui/assets/static/scripts/adobeAnalytics.js"></script>
    <script defer src="/bundle.js"></script>
  </body>
</html>
`

const firstListingRecord = {
  job_id: 'a679c58dda0f87',
  job_code: 'JOB_1417',
  group_company: 'MakeMyTrip (India) Limited',
  parent_department: 'GCC',
  department: 'GCC',
  division: 'MMTGC',
  business_unit: 'Marketing',
  location: ['Gurgaon, Haryana, India (Gurgaon_MMT)'],
  location_city: ['Gurgaon'],
  location_country: 'India',
  job_title: 'Marketing Analytics',
  post_on_careers_page: 1,
  post_on_refer_page: 1,
  post_on_ijp_page: 0,
  employee_type: 'Employee',
  job_created_timestamp: '31-01-2025 10:30:13',
  job_updated_timestamp: '16-07-2026 21:10:00',
  experience_to: '6',
  experience_from: '2',
  is_remote: 0,
  designation_code: 'MR1143',
}

const secondListingRecord = {
  job_id: 'a6a0eb962633ec',
  job_code: 'JOB_2014',
  group_company: 'MakeMyTrip (India) Limited',
  parent_department: 'B2B & Affiliates',
  department: 'B2B & Affiliates',
  division: 'MMTGC',
  business_unit: 'Revenue Management',
  location: [
    'Gurgaon, Haryana, India (Gurgaon_MMT)',
    'Bangalore, Karnataka, India (Bangalore_MMT)',
  ],
  location_city: ['Gurgaon', 'Bangalore'],
  location_country: 'India',
  job_title: 'Revenue Manager',
  post_on_careers_page: 1,
  post_on_refer_page: 1,
  post_on_ijp_page: 0,
  employee_type: 'Employee',
  job_created_timestamp: '21-05-2026 13:20:58',
  job_updated_timestamp: '16-07-2026 20:45:00',
  experience_to: '8',
  experience_from: '4',
  is_remote: 0,
  designation_code: 'MR236',
}

const hiddenListingRecord = {
  job_id: 'hidden-job-001',
  job_code: 'JOB_HIDDEN',
  group_company: 'MakeMyTrip (India) Limited',
  parent_department: 'Corporate',
  department: 'Corporate',
  division: 'MMTGC',
  business_unit: 'Corporate',
  location: ['Gurgaon, Haryana, India (Gurgaon_MMT)'],
  location_city: ['Gurgaon'],
  location_country: 'India',
  job_title: 'Hidden Role',
  post_on_careers_page: 0,
  employee_type: 'Employee',
  job_created_timestamp: '01-07-2026 10:00:00',
  experience_to: '4',
  experience_from: '2',
  is_remote: 0,
}

const jobsApiPayload = {
  allJobs: [
    firstListingRecord,
    secondListingRecord,
    hiddenListingRecord,
  ],
  businessUnits: [
    { name: 'Marketing', count: 1 },
    { name: 'Revenue Management', count: 1 },
  ],
  locations: ['Gurgaon', 'Bangalore'],
}

const firstDetailPayload = {
  message: 'Successfully loaded job detais',
  status: 1,
  data: {
    applyUrl: 'https://gommt.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a679c58dda0f87?from=all',
    department: 'GCC',
    department_code: 'MMT_Mkt_GCC_GCC',
    designation: 'Analytics',
    employee_type: 'Employee',
    experience_from: '2',
    experience_to: '6',
    group_company: 'MakeMyTrip (India) Limited',
    job_created_timestamp: '31-01-2025 10:30:13',
    job_decription:
      '&lt;p&gt;&lt;strong&gt;About the Opportunity&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;Role: Marketing Analytics&lt;/p&gt;&lt;p&gt;Location: Gurgaon&lt;/p&gt;',
    job_status: 'OPEN',
    job_title: 'Marketing Analytics',
    job_updated_timestamp: '16-07-2026 21:10:00',
    location: ['Gurgaon, Haryana, India (Gurgaon_MMT)'],
    location_city: ['Gurgaon'],
    location_country: 'India',
    open_positions: 0,
    unit_experience: 'Years',
  },
}

const loadMakeMyTripModule = async () => {
  try {
    return await import('../../scraper/makemytrip/script.js')
  } catch {
    assert.fail('Expected MakeMyTrip scraper module at ../../scraper/makemytrip/script.js')
  }
}

test('MakeMyTrip pins the verified first-party jobs shell and API routes', async () => {
  const makemytrip = await loadMakeMyTripModule()

  assert.equal(makemytrip.SOURCE, 'makemytrip')
  assert.equal(makemytrip.COMPANY_NAME, 'MakeMyTrip')
  assert.equal(makemytrip.CAREERS_LANDING_URL, 'https://careers.makemytrip.com/')
  assert.equal(makemytrip.CAREERS_URL, 'https://careers.makemytrip.com/prod/jobs')
  assert.equal(makemytrip.CAREERS_ORIGIN, 'https://careers.makemytrip.com')
  assert.equal(makemytrip.JOBS_API_URL, 'https://careers.makemytrip.com/api/jobs')
  assert.equal(makemytrip.VERIFIED_ON, '2026-07-16')
  assert.equal(makemytrip.hasOfficialJobsPageShellSignal(jobsPageShellHtml), true)
  assert.equal(makemytrip.slugifyTitle('Marketing Analytics'), 'marketing-analytics')
  assert.equal(
    makemytrip.slugifyTitle('Assistant Manager/Deputy Manager - Taxation'),
    'assistant-manager-deputy-manager-taxation',
  )
  assert.equal(
    makemytrip.buildOpportunityUrl({
      jobId: 'a679c58dda0f87',
      title: 'Marketing Analytics',
    }),
    'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
  )
  assert.equal(
    makemytrip.buildJobDetailsApiUrl('a679c58dda0f87'),
    'https://careers.makemytrip.com/api/jobDetails?jobId=a679c58dda0f87',
  )
})

test('MakeMyTrip extracts public jobs from the first-party jobs API and filters hidden rows', async () => {
  const makemytrip = await loadMakeMyTripModule()
  const jobs = makemytrip.extractSearchResults(jobsApiPayload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Marketing Analytics',
    company: 'MakeMyTrip',
    department: 'Marketing',
    team: 'GCC',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: 'a679c58dda0f87',
    requisitionId: 'JOB_1417',
    sourceUrl: 'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
    applyUrl: 'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
    employmentType: 'Employee',
    experienceRequired: '2-6 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-01-31',
    closingDate: null,
    jobDescription: null,
    groupCompany: 'MakeMyTrip (India) Limited',
    division: 'MMTGC',
    remoteStatus: 'On-site',
    _listingRecord: firstListingRecord,
  })

  assert.deepEqual(jobs[1], {
    title: 'Revenue Manager',
    company: 'MakeMyTrip',
    department: 'Revenue Management',
    team: 'B2B & Affiliates',
    location: 'Gurgaon, Haryana, India; Bangalore, Karnataka, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: 'a6a0eb962633ec',
    requisitionId: 'JOB_2014',
    sourceUrl: 'https://careers.makemytrip.com/prod/opportunity/a6a0eb962633ec/revenue-manager',
    applyUrl: 'https://careers.makemytrip.com/prod/opportunity/a6a0eb962633ec/revenue-manager',
    employmentType: 'Employee',
    experienceRequired: '4-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-21',
    closingDate: null,
    jobDescription: null,
    groupCompany: 'MakeMyTrip (India) Limited',
    division: 'MMTGC',
    remoteStatus: 'On-site',
    _listingRecord: secondListingRecord,
  })
})

test('MakeMyTrip detail extraction preserves the first-party opportunity route and external apply URL', async () => {
  const makemytrip = await loadMakeMyTripModule()
  const detail = makemytrip.extractJobDetail(firstDetailPayload, {
    title: 'Marketing Analytics',
    company: 'MakeMyTrip',
    department: 'Marketing',
    team: 'GCC',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: 'a679c58dda0f87',
    requisitionId: 'JOB_1417',
    sourceUrl: 'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
    applyUrl: 'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
    employmentType: 'Employee',
    experienceRequired: '2-6 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-01-31',
    closingDate: null,
    jobDescription: null,
    groupCompany: 'MakeMyTrip (India) Limited',
    division: 'MMTGC',
    remoteStatus: 'On-site',
    _listingRecord: firstListingRecord,
  })

  assert.equal(detail.title, 'Marketing Analytics')
  assert.equal(detail.company, 'MakeMyTrip')
  assert.equal(detail.department, 'Marketing')
  assert.equal(detail.team, 'GCC')
  assert.equal(detail.location, 'Gurgaon, Haryana, India')
  assert.equal(detail.city, 'Gurgaon')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'a679c58dda0f87')
  assert.equal(detail.requisitionId, 'JOB_1417')
  assert.equal(
    detail.sourceUrl,
    'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
  )
  assert.equal(
    detail.applyUrl,
    'https://gommt.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a679c58dda0f87?from=all',
  )
  assert.equal(detail.employmentType, 'Employee')
  assert.equal(detail.experienceRequired, '2-6 years')
  assert.equal(detail.groupCompany, 'MakeMyTrip (India) Limited')
  assert.equal(detail.division, 'MMTGC')
  assert.equal(detail.remoteStatus, 'On-site')
  assert.match(detail.jobDescription, /About the Opportunity/i)
  assert.match(detail.jobDescription, /Role: Marketing Analytics/i)
})

test('createMakeMyTripScraper verifies the first-party shell and decorates jobs from the live APIs', async () => {
  const makemytrip = await loadMakeMyTripModule()
  const pageRequests = []
  const apiRequests = []

  const jobs = await makemytrip.createMakeMyTripScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      pageRequests.push(url)
      assert.equal(url, makemytrip.CAREERS_URL)
      return jobsPageShellHtml
    },
    fetchJson: async (url) => {
      apiRequests.push(url)

      if (url === makemytrip.JOBS_API_URL) {
        return jobsApiPayload
      }

      if (url === makemytrip.buildJobDetailsApiUrl('a679c58dda0f87')) {
        return firstDetailPayload
      }

      if (url === makemytrip.buildJobDetailsApiUrl('a6a0eb962633ec')) {
        throw new Error('detail unavailable')
      }

      throw new Error(`Unexpected MakeMyTrip API URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    makemytrip.CAREERS_URL,
  ])
  assert.deepEqual(apiRequests, [
    'https://careers.makemytrip.com/api/jobs',
    'https://careers.makemytrip.com/api/jobDetails?jobId=a679c58dda0f87',
    'https://careers.makemytrip.com/api/jobDetails?jobId=a6a0eb962633ec',
  ])
  assert.equal(jobs.length, 2)

  assert.deepEqual(jobs[0], {
    title: 'Marketing Analytics',
    company: 'MakeMyTrip',
    department: 'Marketing',
    team: 'GCC',
    location: 'Gurgaon, Haryana, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: 'a679c58dda0f87',
    requisitionId: 'JOB_1417',
    sourceUrl: 'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
    applyUrl: 'https://gommt.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a679c58dda0f87?from=all',
    employmentType: 'Employee',
    experienceRequired: '2-6 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-01-31',
    closingDate: null,
    jobDescription: 'About the Opportunity Role: Marketing Analytics Location: Gurgaon',
    groupCompany: 'MakeMyTrip (India) Limited',
    division: 'MMTGC',
    remoteStatus: 'On-site',
    source: 'makemytrip',
    link: 'https://careers.makemytrip.com/prod/opportunity/a679c58dda0f87/marketing-analytics',
    companyCareerPage: 'https://careers.makemytrip.com/prod/jobs',
    companyDomain: 'makemytrip.com',
    atsPlatform: 'first-party-careers-api',
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs[1], {
    title: 'Revenue Manager',
    company: 'MakeMyTrip',
    department: 'Revenue Management',
    team: 'B2B & Affiliates',
    location: 'Gurgaon, Haryana, India; Bangalore, Karnataka, India',
    city: 'Gurgaon',
    country: 'India',
    jobId: 'a6a0eb962633ec',
    requisitionId: 'JOB_2014',
    sourceUrl: 'https://careers.makemytrip.com/prod/opportunity/a6a0eb962633ec/revenue-manager',
    applyUrl: 'https://careers.makemytrip.com/prod/opportunity/a6a0eb962633ec/revenue-manager',
    employmentType: 'Employee',
    experienceRequired: '4-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-05-21',
    closingDate: null,
    jobDescription: null,
    groupCompany: 'MakeMyTrip (India) Limited',
    division: 'MMTGC',
    remoteStatus: 'On-site',
    source: 'makemytrip',
    link: 'https://careers.makemytrip.com/prod/opportunity/a6a0eb962633ec/revenue-manager',
    companyCareerPage: 'https://careers.makemytrip.com/prod/jobs',
    companyDomain: 'makemytrip.com',
    atsPlatform: 'first-party-careers-api',
    scrapedAt: FIXED_SCRAPED_AT,
  })
})

test('MakeMyTrip fails closed when the verified first-party shell drifts', async () => {
  const makemytrip = await loadMakeMyTripModule()

  await assert.rejects(
    makemytrip.createMakeMyTripScraper().run({
      fetchText: async () => '<html><body><h1>Placeholder</h1></body></html>',
      fetchJson: async () => jobsApiPayload,
    }),
    /verified first-party careers shell/i,
  )
})
