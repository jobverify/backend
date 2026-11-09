import assert from 'node:assert/strict'
import test from 'node:test'

const indiaHomepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Discover Diageo India | Diageo India</title>
  </head>
  <body>
    <a href="/en/careers">Careers</a>
    <h1>Diageo India</h1>
    <p>Diageo India is among the country's leading beverage alcohol companies with an outstanding collection of premium brands.</p>
    <p>Bring your passion, creativity, and determination, and together, we will push the industry to new heights.</p>
  </body>
</html>
`

const indiaCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers | Diageo India</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Bring your passion, creativity, and determination, and together, we will push the industry to new heights.</p>
    <a href="/en/careers/early-careers">Early Careers</a>
    <a href="/en/careers/opportunities-at-diageo">Opportunities at Diageo</a>
    <a href="/en/careers/life-at-diageo">Life at Diageo</a>
    <a href="/en/careers/why-diageo">Why Diageo</a>
  </body>
</html>
`

const indiaOpportunitiesHtml = `
<!doctype html>
<html>
  <head>
    <title>Opportunities at Diageo | Diageo India</title>
  </head>
  <body>
    <h1>Opportunities at Diageo</h1>
    <h2>Find your role at Diageo</h2>
    <p>We're a global and diverse company with exciting and challenging opportunities to build your career across a range of functions.</p>
    <a href="https://www.linkedin.com/company/diageo-india/jobs/?viewAsMember=true">Visit us on LinkedIn</a>
  </body>
</html>
`

const globalSearchAndApplyHtml = `
<!doctype html>
<html>
  <head>
    <title>Search and Apply for Jobs With Us | Diageo</title>
  </head>
  <body id="ip3-search-and-apply" class="ip3-careers ip3-level3">
    <script src="/en/javascripts/shared/jobs-landing-api.js?revision=ac7059d0-6916-4c96-9cb1-7a2a16bb4a93"></script>
    <div id="jobApp">
      <h2>{{ job.Job_Posting_Title }}</h2>
      <span>{{ job.referenceID }}</span>
      <span>{{ formatPrimaryLocation(job.Primary_Job_Posting_Location, job.Country) }}</span>
      <span>{{ country.title }}</span>
    </div>
    <p>Search and apply for jobs with us directly through the search function above.</p>
  </body>
</html>
`

const invalidSearchAndApplyHtml = `
<!doctype html>
<html>
  <head>
    <title>Search and Apply</title>
  </head>
  <body>
    <p>No job app here.</p>
  </body>
</html>
`

const pageOnePayload = {
  meta: {
    currentPage: 1,
    nextPage: 2,
    totalPages: 2,
    currentItemsNumber: 2,
    totalItems: 3,
  },
  facets: {
    country: [
      { title: 'India', count: 3 },
      { title: 'Ireland', count: 1 },
    ],
  },
  data: [
    {
      referenceID: 'JR1127198',
      Country: 'India',
      External_Posting: '1',
      External_Posting_URL: 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Aurangabad-India/Senior-Executive---Unit-Supply-Chain_JR1127198',
      Function_Subtype: 'Supply',
      Job_Category: '6B',
      Job_Description: '<p><b>Job Title: </b></p><p>Senior Executive - Unit Supply Chain</p><p><b>About the Role</b></p><p>2 - 5 years relevant functional experience in Purchase, materials control, procurement and inventory functions</p>',
      Job_Family: 'Warehouse Operations',
      Job_Family_Group: 'Logistics and Planning',
      Job_Posting_Start_Date: '2026-07-14',
      Job_Posting_Title: 'Senior Executive - Unit Supply Chain',
      Job_Requisition_Additional_Job_Posting_Locations_group: [],
      Job_Requisition_Status: 'Open',
      Primary_Job_Posting_Location: ['Aurangabad', 'India'],
      Recruiting_Start_Date: '2026-07-14',
      Time_Type: 'Full time',
      Worker_type: 'Employee',
    },
    {
      referenceID: 'JR1126617',
      Country: 'India',
      External_Posting: '1',
      External_Posting_URL: 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Pune-India/Assistant-Manager---Key-Accounts_JR1126617',
      Function_Subtype: 'Sales',
      Job_Category: '5B',
      Job_Description: '<p><b>Job Title: </b></p><p>Assistant Manager - Key Accounts</p><p>3 - 7 years of experience in key accounts management</p>',
      Job_Family: 'Sales',
      Job_Family_Group: 'Commercial',
      Job_Posting_Start_Date: '2026-07-11',
      Job_Posting_Title: 'Assistant Manager - Key Accounts',
      Job_Requisition_Additional_Job_Posting_Locations_group: [],
      Job_Requisition_Status: 'Open',
      Primary_Job_Posting_Location: ['Pune', 'India'],
      Recruiting_Start_Date: '2026-07-11',
      Time_Type: 'Full time',
      Worker_type: 'Employee',
    },
  ],
}

const pageTwoPayload = {
  meta: {
    currentPage: 2,
    nextPage: null,
    totalPages: 2,
    currentItemsNumber: 1,
    totalItems: 3,
  },
  facets: {
    country: [
      { title: 'India', count: 3 },
    ],
  },
  data: [
    {
      referenceID: 'JR1124292',
      Country: 'India',
      External_Posting: '1',
      External_Posting_URL: 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Bangalore-India/Assistant-Manager---Liquid-Commercialization_JR1124292',
      Function_Subtype: 'Supply',
      Job_Category: '5A',
      Job_Description: '<p><b>Job Title: </b></p><p>Assistant Manager - Liquid Commercialization</p><p>5+ years of commercialization experience</p>',
      Job_Family: 'Manufacturing',
      Job_Family_Group: 'Supply Chain',
      Job_Posting_Start_Date: '2026-07-03',
      Job_Posting_Title: 'Assistant Manager - Liquid Commercialization',
      Job_Requisition_Additional_Job_Posting_Locations_group: [],
      Job_Requisition_Status: 'Open',
      Primary_Job_Posting_Location: ['Bangalore', 'India'],
      Recruiting_Start_Date: '2026-07-03',
      Time_Type: 'Full time',
      Worker_type: 'Employee',
    },
  ],
}

const loadDiageoIndiaModule = async () => {
  try {
    return await import('../../scraper/diageoindia/script.js')
  } catch {
    assert.fail('Expected Diageo India scraper module at ../../scraper/diageoindia/script.js')
  }
}

test('Diageo India scraper helpers stay pinned to the verified India careers pages and country-filtered public jobs API contract', async () => {
  const diageoIndia = await loadDiageoIndiaModule()

  assert.equal(diageoIndia.SOURCE, 'diageoindia')
  assert.equal(diageoIndia.COMPANY, 'Diageo India')
  assert.equal(diageoIndia.INDIA_HOMEPAGE_URL, 'https://www.diageoindia.com/')
  assert.equal(diageoIndia.INDIA_CAREERS_URL, 'https://www.diageoindia.com/careers')
  assert.equal(diageoIndia.INDIA_OPPORTUNITIES_URL, 'https://www.diageoindia.com/en/careers/opportunities-at-diageo')
  assert.equal(diageoIndia.GLOBAL_SEARCH_AND_APPLY_URL, 'https://www.diageo.com/en/careers/search-and-apply')
  assert.equal(diageoIndia.JOBS_API_BASE_URL, 'https://diageo-prod-api.connectid.cloud/api/jobs')
  assert.equal(diageoIndia.buildJobsApiUrl(), 'https://diageo-prod-api.connectid.cloud/api/jobs?page=1&country=India')
  assert.equal(diageoIndia.buildJobsApiUrl({ page: 2, country: 'India' }), 'https://diageo-prod-api.connectid.cloud/api/jobs?page=2&country=India')
  assert.equal(
    diageoIndia.buildDetailPageUrl('Senior Executive - Unit Supply Chain', 'JR1127198'),
    'https://www.diageo.com/en/careers/search-and-apply/senior-executive-unit-supply-chain/JR1127198',
  )
  assert.equal(
    diageoIndia.hasIndiaHomepageSignal(indiaHomepageHtml),
    true,
  )
  assert.equal(
    diageoIndia.hasIndiaCareersHubSignal(indiaCareersHtml),
    true,
  )
  assert.equal(
    diageoIndia.hasIndiaOpportunitiesSignal(indiaOpportunitiesHtml),
    true,
  )
  assert.equal(
    diageoIndia.hasGlobalSearchAndApplySignal(globalSearchAndApplyHtml),
    true,
  )
  assert.deepEqual(diageoIndia.extractPaginationSummary(pageOnePayload), {
    currentPage: 1,
    nextPage: 2,
    totalPages: 2,
    totalItems: 3,
  })
  assert.deepEqual(diageoIndia.extractJobsFromPayload(pageOnePayload), [
    {
      title: 'Senior Executive - Unit Supply Chain',
      company: 'Diageo India',
      department: 'Warehouse Operations',
      location: 'Aurangabad, India',
      city: 'Aurangabad',
      country: 'India',
      jobId: 'JR1127198',
      requisitionId: 'JR1127198',
      sourceUrl: 'https://www.diageo.com/en/careers/search-and-apply/senior-executive-unit-supply-chain/JR1127198',
      applyUrl: 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Aurangabad-India/Senior-Executive---Unit-Supply-Chain_JR1127198',
      employmentType: 'Full-time',
      experienceRequired: '2 - 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-14',
      closingDate: null,
      jobDescription: 'Job Title: Senior Executive - Unit Supply Chain About the Role 2 - 5 years relevant functional experience in Purchase, materials control, procurement and inventory functions',
      remoteStatus: null,
    },
    {
      title: 'Assistant Manager - Key Accounts',
      company: 'Diageo India',
      department: 'Sales',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'JR1126617',
      requisitionId: 'JR1126617',
      sourceUrl: 'https://www.diageo.com/en/careers/search-and-apply/assistant-manager-key-accounts/JR1126617',
      applyUrl: 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Pune-India/Assistant-Manager---Key-Accounts_JR1126617',
      employmentType: 'Full-time',
      experienceRequired: '3 - 7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-11',
      closingDate: null,
      jobDescription: 'Job Title: Assistant Manager - Key Accounts 3 - 7 years of experience in key accounts management',
      remoteStatus: null,
    },
  ])
})

test('Diageo India run verifies the official careers pages, paginates the public India jobs API, and decorates jobs for the shared runner', async () => {
  const diageoIndia = await loadDiageoIndiaModule()
  const requested = []

  const jobs = await diageoIndia.createDiageoIndiaScraper().run({
    fetchText: async (url) => {
      requested.push(url)

      if (url === diageoIndia.INDIA_HOMEPAGE_URL) return indiaHomepageHtml
      if (url === diageoIndia.INDIA_CAREERS_URL) return indiaCareersHtml
      if (url === diageoIndia.INDIA_OPPORTUNITIES_URL) return indiaOpportunitiesHtml
      if (url === diageoIndia.GLOBAL_SEARCH_AND_APPLY_URL) return globalSearchAndApplyHtml

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requested.push(url)

      if (url === diageoIndia.buildJobsApiUrl({ page: 1 })) return pageOnePayload
      if (url === diageoIndia.buildJobsApiUrl({ page: 2 })) return pageTwoPayload

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-15T12:00:00.000Z',
  })

  assert.deepEqual(requested, [
    diageoIndia.INDIA_HOMEPAGE_URL,
    diageoIndia.INDIA_CAREERS_URL,
    diageoIndia.INDIA_OPPORTUNITIES_URL,
    diageoIndia.GLOBAL_SEARCH_AND_APPLY_URL,
    diageoIndia.buildJobsApiUrl({ page: 1 }),
    diageoIndia.buildJobsApiUrl({ page: 2 }),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'Senior Executive - Unit Supply Chain')
  assert.equal(jobs[0].company, 'Diageo India')
  assert.equal(jobs[0].source, 'diageoindia')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].atsPlatform, 'first-party-careers-page-plus-public-jobs-api')
  assert.equal(jobs[0].link, 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Aurangabad-India/Senior-Executive---Unit-Supply-Chain_JR1127198')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T12:00:00.000Z')
  assert.equal(jobs[1].title, 'Assistant Manager - Key Accounts')
  assert.equal(jobs[2].title, 'Assistant Manager - Liquid Commercialization')
  assert.equal(jobs[2].city, 'Bangalore')
  assert.equal(jobs[2].experienceRequired, '5+ Years')
})

test('Diageo India fails closed when the verified careers pages or public jobs API drift away from the known contract', async () => {
  const diageoIndia = await loadDiageoIndiaModule()

  await assert.rejects(
    diageoIndia.createDiageoIndiaScraper().run({
      fetchText: async (url) => {
        if (url === diageoIndia.INDIA_HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No careers link</body></html>'
        }
        throw new Error('Should not fetch further')
      },
    }),
    /homepage no longer matches the verified official surface/i,
  )

  await assert.rejects(
    diageoIndia.createDiageoIndiaScraper().run({
      fetchText: async (url) => {
        if (url === diageoIndia.INDIA_HOMEPAGE_URL) return indiaHomepageHtml
        if (url === diageoIndia.INDIA_CAREERS_URL) return indiaCareersHtml
        if (url === diageoIndia.INDIA_OPPORTUNITIES_URL) return indiaOpportunitiesHtml
        if (url === diageoIndia.GLOBAL_SEARCH_AND_APPLY_URL) return invalidSearchAndApplyHtml
        throw new Error('Should not fetch further')
      },
    }),
    /search-and-apply page no longer matches the verified public surface/i,
  )

  await assert.rejects(
    diageoIndia.createDiageoIndiaScraper().run({
      fetchText: async (url) => {
        if (url === diageoIndia.INDIA_HOMEPAGE_URL) return indiaHomepageHtml
        if (url === diageoIndia.INDIA_CAREERS_URL) return indiaCareersHtml
        if (url === diageoIndia.INDIA_OPPORTUNITIES_URL) return indiaOpportunitiesHtml
        if (url === diageoIndia.GLOBAL_SEARCH_AND_APPLY_URL) return globalSearchAndApplyHtml
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => ({ meta: {}, data: 'nope' }),
    }),
    /jobs api payload no longer matches the verified public surface/i,
  )
})
