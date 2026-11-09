import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T12:00:00.000Z'

const jobSearchHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search open jobs at SitusAMC and apply today!</title>
  </head>
  <body>
    <h1>Search Open Jobs Worldwide</h1>
    <p>Work at SitusAMC and build a career with us.</p>
    <p>How you'll work with our teams across global markets.</p>
    <p>Career Areas</p>
    <p>Locations</p>
    <p>Search Jobs</p>
    <p>Remote Location IN - Bengaluru IN - Chennai IN - Gurgaon IN - Hyderabad IN - Navi Mumbai IN - Pune</p>
    <a href="https://careers.situsamc.com/work-at-situsamc/corporate-careers/job-opportunities">Corporate</a>
    <a href="https://careers.situsamc.com/work-at-situsamc/residential-real-estate-careers/job-opportunities">Residential</a>
  </body>
</html>
`

const corporateJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Corporate Jobs | SitusAMC Careers</title>
  </head>
  <body>
    <h1>Corporate Current Job Opportunities</h1>
    <h3>Showing 14 Corporate jobs</h3>
    <a href="https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1">
      Save Saved Share Assistant Manager, Human Resources Business Partner IN - Haryana - Gurgaon JR02278 Onsite
    </a>
    <a href="https://careers.situsamc.com/job-detail/analyst-identity-access-management-administrator-jr02958-1">
      Save Saved Share Analyst, Identity Access Management Administrator IN - Karnataka - Bengaluru JR02958 Onsite
    </a>
    <a href="https://careers.situsamc.com/job-detail/avp-legal-operations-jr02608-1">
      Save Saved Share AVP, Legal Operations US - Remote JR02608 Remote
    </a>
  </body>
</html>
`

const residentialJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Residential Real Estate Jobs | SitusAMC Careers</title>
  </head>
  <body>
    <h1>Residential Real Estate Current Job Opportunities</h1>
    <h3>Showing 15 Residential Real Estate jobs</h3>
    <a href="https://careers.situsamc.com/job-detail/senior-underwriter-shared-services-jr01749-1">
      Save Saved Senior Underwriter, Shared Services IN - Maharashtra - Navi Mumbai JR01749 Onsite
    </a>
    <a href="https://careers.situsamc.com/job-detail/underwriter-shared-services-jr02568-1">
      Save Saved Underwriter, Shared Services IN - Maharashtra - Navi Mumbai JR02568 Onsite
    </a>
    <a href="https://careers.situsamc.com/job-detail/ai-innovation-product-team-jr02652-1">
      Save Saved AI Innovation - Product Team- Remote US US - Remote JR02652 Remote
    </a>
  </body>
</html>
`

const corporateDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Assistant Manager, Human Resources Business Partner Career Opportunity in Gurgaon, Haryana, IN at SitusAMC</h1>
    <h2>Job Attributes</h2>
    <p>Req ID</p>
    <p>JR02278</p>
    <p>Job Category</p>
    <p>Human Resources</p>
    <p>Career Area</p>
    <p>Corporate</p>
    <p>Job Type</p>
    <p>Full time</p>
    <p>Job Location</p>
    <p>IN - Haryana - Gurgaon</p>
    <p>Type</p>
    <p>Onsite</p>
    <a href="https://situsamc.wd1.myworkdayjobs.com/Join_Us/job/Gurgaon/Assistant-Manager-HRBP_JR02278">Apply Now</a>
    <h3>Overview</h3>
    <p>
      SitusAMC is where the best and most passionate people come to transform our client’s businesses
      and their own careers.
    </p>
    <h3>Essential Job Functions:</h3>
    <ul>
      <li>Act as the primary HR contact for employees and managers.</li>
      <li>Partner with assigned business unit leaders.</li>
    </ul>
  </body>
</html>
`

const residentialDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Senior Underwriter, Shared Services in Navi Mumbai, , India at SitusAMC (# JR01749)</h1>
    <h2>Job Attributes</h2>
    <p>Req ID</p>
    <p>JR01749</p>
    <p>Job Category</p>
    <p>Operations</p>
    <p>Career Area</p>
    <p>Residential Real Estate</p>
    <p>Job Type</p>
    <p>Full time</p>
    <p>Job Location</p>
    <p>IN - Maharashtra - Navi Mumbai</p>
    <p>Type</p>
    <p>Onsite</p>
    <a href="https://situsamc.wd1.myworkdayjobs.com/Join_Us/job/Navi-Mumbai/Senior-Underwriter_JR01749">Apply Now</a>
    <h3>Overview</h3>
    <p>
      Join us as we work together to realize opportunities for everyone we proudly serve.
    </p>
    <h3>Essential Job Functions:</h3>
    <ul>
      <li>Perform underwriting and support shared services operations.</li>
    </ul>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/situsamcindia/script.js')
  } catch {
    assert.fail('Expected SitusAMC India scraper module at ../../scraper/situsamcindia/script.js')
  }
}

test('SitusAMC India helpers stay pinned to the verified official job-search, area job pages, and job detail pages', async () => {
  const situs = await loadModule()

  assert.equal(situs.SOURCE, 'situsamcindia')
  assert.equal(situs.COMPANY_NAME, 'SitusAMC India')
  assert.equal(situs.OFFICIAL_BRAND_NAME, 'SitusAMC')
  assert.equal(situs.VERIFIED_ON, '2026-07-17')
  assert.equal(situs.HOMEPAGE_URL, 'https://careers.situsamc.com/')
  assert.equal(situs.JOB_SEARCH_URL, 'https://careers.situsamc.com/job-search')
  assert.equal(
    situs.CORPORATE_JOBS_URL,
    'https://careers.situsamc.com/work-at-situsamc/corporate-careers/job-opportunities',
  )
  assert.equal(
    situs.RESIDENTIAL_JOBS_URL,
    'https://careers.situsamc.com/work-at-situsamc/residential-real-estate-careers/job-opportunities',
  )
  assert.equal(situs.hasOfficialJobSearchSignal(jobSearchHtml), true)
  assert.equal(situs.hasOfficialJobSearchSignal('<html><body>Search Jobs</body></html>'), false)
  assert.equal(situs.hasCorporateJobsPageSignal(corporateJobsHtml), true)
  assert.equal(situs.hasResidentialJobsPageSignal(residentialJobsHtml), true)
  assert.equal(situs.hasOfficialJobDetailSignal(corporateDetailHtml), true)
  assert.equal(situs.hasOfficialJobDetailSignal('<html><body>Req ID JR02278</body></html>'), false)

  assert.deepEqual(
    situs.extractIndiaJobCardsFromAreaPage(corporateJobsHtml),
    [
      {
        title: 'Assistant Manager, Human Resources Business Partner',
        locationCode: 'IN - Haryana - Gurgaon',
        reqId: 'JR02278',
        remoteStatus: 'Onsite',
        detailUrl: 'https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1',
      },
      {
        title: 'Analyst, Identity Access Management Administrator',
        locationCode: 'IN - Karnataka - Bengaluru',
        reqId: 'JR02958',
        remoteStatus: 'Onsite',
        detailUrl: 'https://careers.situsamc.com/job-detail/analyst-identity-access-management-administrator-jr02958-1',
      },
    ],
  )

  assert.deepEqual(
    situs.extractIndiaJobCardsFromAreaPage(residentialJobsHtml),
    [
      {
        title: 'Senior Underwriter, Shared Services',
        locationCode: 'IN - Maharashtra - Navi Mumbai',
        reqId: 'JR01749',
        remoteStatus: 'Onsite',
        detailUrl: 'https://careers.situsamc.com/job-detail/senior-underwriter-shared-services-jr01749-1',
      },
      {
        title: 'Underwriter, Shared Services',
        locationCode: 'IN - Maharashtra - Navi Mumbai',
        reqId: 'JR02568',
        remoteStatus: 'Onsite',
        detailUrl: 'https://careers.situsamc.com/job-detail/underwriter-shared-services-jr02568-1',
      },
    ],
  )

  assert.deepEqual(
    situs.extractJobFromDetailHtml(
      corporateDetailHtml,
      {
        title: 'Assistant Manager, Human Resources Business Partner',
        locationCode: 'IN - Haryana - Gurgaon',
        reqId: 'JR02278',
        remoteStatus: 'Onsite',
        detailUrl: 'https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1',
      },
      { scrapedAt: FIXED_SCRAPED_AT },
    ),
    {
      title: 'Assistant Manager, Human Resources Business Partner',
      company: 'SitusAMC India',
      department: 'Human Resources',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      state: 'Haryana',
      country: 'India',
      jobId: 'JR02278',
      requisitionId: 'JR02278',
      sourceUrl: 'https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1',
      applyUrl: 'https://situsamc.wd1.myworkdayjobs.com/Join_Us/job/Gurgaon/Assistant-Manager-HRBP_JR02278',
      employmentType: 'Full time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'SitusAMC is where the best and most passionate people come to transform our client’s businesses and their own careers. Act as the primary HR contact for employees and managers. Partner with assigned business unit leaders.',
      remoteStatus: 'On-site',
      source: 'situsamcindia',
      link: 'https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('SitusAMC India run validates the official surfaces, aggregates India area pages, and enriches jobs from detail pages', async () => {
  const situs = await loadModule()
  const requestedUrls = []

  const jobs = await situs.createSitusAmcIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === situs.JOB_SEARCH_URL) return jobSearchHtml
      if (url === situs.CORPORATE_JOBS_URL) return corporateJobsHtml
      if (url === situs.RESIDENTIAL_JOBS_URL) return residentialJobsHtml
      if (url === 'https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1') return corporateDetailHtml
      if (url === 'https://careers.situsamc.com/job-detail/analyst-identity-access-management-administrator-jr02958-1') {
        return `
          <!doctype html>
          <html>
            <body>
              <h1>Analyst, Identity Access Management Administrator in Bengaluru, Karnataka, India at SitusAMC</h1>
              <p>Req ID</p><p>JR02958</p>
              <p>Job Category</p><p>Technology</p>
              <p>Career Area</p><p>Corporate</p>
              <p>Job Type</p><p>Full time</p>
              <p>Job Location</p><p>IN - Karnataka - Bengaluru</p>
              <p>Type</p><p>Onsite</p>
              <a href="https://situsamc.wd1.myworkdayjobs.com/Join_Us/job/Bengaluru/Analyst-IAM_JR02958">Apply Now</a>
              <h3>Overview</h3>
              <p>Support identity and access administration across enterprise applications.</p>
            </body>
          </html>
        `
      }
      if (url === 'https://careers.situsamc.com/job-detail/senior-underwriter-shared-services-jr01749-1') return residentialDetailHtml
      if (url === 'https://careers.situsamc.com/job-detail/underwriter-shared-services-jr02568-1') {
        return `
          <!doctype html>
          <html>
            <body>
              <h1>Underwriter, Shared Services in Navi Mumbai, India at SitusAMC</h1>
              <p>Req ID</p><p>JR02568</p>
              <p>Job Category</p><p>Operations</p>
              <p>Career Area</p><p>Residential Real Estate</p>
              <p>Job Type</p><p>Full time</p>
              <p>Job Location</p><p>IN - Maharashtra - Navi Mumbai</p>
              <p>Type</p><p>Onsite</p>
              <a href="https://situsamc.wd1.myworkdayjobs.com/Join_Us/job/Navi-Mumbai/Underwriter_JR02568">Apply Now</a>
              <h3>Overview</h3>
              <p>Perform underwriting tasks across shared services workflows.</p>
            </body>
          </html>
        `
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    situs.JOB_SEARCH_URL,
    situs.CORPORATE_JOBS_URL,
    situs.RESIDENTIAL_JOBS_URL,
    'https://careers.situsamc.com/job-detail/assistant-manager-human-resources-business-partner-jr02278-1',
    'https://careers.situsamc.com/job-detail/analyst-identity-access-management-administrator-jr02958-1',
    'https://careers.situsamc.com/job-detail/senior-underwriter-shared-services-jr01749-1',
    'https://careers.situsamc.com/job-detail/underwriter-shared-services-jr02568-1',
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.city, job.state, job.department, job.source, job.scrapedAt]),
    [
      [
        'Assistant Manager, Human Resources Business Partner',
        'Gurgaon',
        'Haryana',
        'Human Resources',
        'situsamcindia',
        FIXED_SCRAPED_AT,
      ],
      [
        'Analyst, Identity Access Management Administrator',
        'Bengaluru',
        'Karnataka',
        'Technology',
        'situsamcindia',
        FIXED_SCRAPED_AT,
      ],
      [
        'Senior Underwriter, Shared Services',
        'Navi Mumbai',
        'Maharashtra',
        'Operations',
        'situsamcindia',
        FIXED_SCRAPED_AT,
      ],
      [
        'Underwriter, Shared Services',
        'Navi Mumbai',
        'Maharashtra',
        'Operations',
        'situsamcindia',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.equal(jobs.length, 4)
})

test('SitusAMC India fails closed when the verified official surfaces drift materially', async () => {
  const situs = await loadModule()

  await assert.rejects(
    situs.createSitusAmcIndiaScraper().run({
      fetchText: async (url) => {
        if (url === situs.JOB_SEARCH_URL) return '<html><body>Search Jobs</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official SitusAMC job-search page/i,
  )

  await assert.rejects(
    situs.createSitusAmcIndiaScraper().run({
      fetchText: async (url) => {
        if (url === situs.JOB_SEARCH_URL) return jobSearchHtml
        if (url === situs.CORPORATE_JOBS_URL) return '<html><body>Corporate Current Job Opportunities</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official SitusAMC corporate jobs page/i,
  )
})
