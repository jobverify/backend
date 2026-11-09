import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => {
  try {
    return await import('../../scraper/solugenixindiaprivatelimited/catalog.js')
  } catch {
    assert.fail('Expected Solugenix India Private Limited catalog module at ../../scraper/solugenixindiaprivatelimited/catalog.js')
  }
}

const loadScript = async () => {
  try {
    return await import('../../scraper/solugenixindiaprivatelimited/script.js')
  } catch {
    assert.fail('Expected Solugenix India Private Limited scraper module at ../../scraper/solugenixindiaprivatelimited/script.js')
  }
}

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Solugenix Careers</title>
  </head>
  <body>
    <h1>Ready for the next stage of your career?</h1>
    <a href="https://www.solugenix.com/jobs">All Openings</a>
    <a href="https://careers.solugenix.com/team-referral-india">Refer a Candidate - India</a>
  </body>
</html>
`

const jobsPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Portal</title>
  </head>
  <body>
    <script
      type="text/javascript"
      src="https://jobsapi.ceipal.com/APISource/widget.js"
      data-ceipal-api-key="RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09"
      data-ceipal-career-portal-id="Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09"></script>
    <div id="example-widget-container"></div>
  </body>
</html>
`

const widgetHtml = `
<!doctype html>
<html>
  <body>
    <h1>CEIPAL Career Portal</h1>
    <div>Search Jobs</div>
    <div>Current Openings</div>
  </body>
</html>
`

const careerPortalPayloadPage1 = {
  count: 3,
  num_pages: 2,
  page_number: 1,
  next: 'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/?page=2',
  previous: null,
  results: [
    {
      id: 'req-001',
      job_id: 20581,
      public_job_title: 'Senior Java Full Stack Developer (Angular)',
      position_title: 'Senior Java Full Stack Developer (Angular)',
      public_job_desc: 'Build enterprise applications for India teams.',
      requistion_description: 'Build enterprise applications for India teams.',
      country: 'India',
      state: 'Karnataka, Telangana',
      city: '',
      multpile_job_location: '(Hyderabad, TG, 500013), (Bengaluru, KA, 560001)',
      created: '07/24/26',
      modified: '08/04/26',
      closing_date: null,
      remote_opportunities: 0,
      job_code: 'JPC - 20576',
      tax_terms: 'Contract',
      apply_job: 'https://candidateportal.ceipal.com/login/job-20581',
      apply_job_monster: 'https://candidateportal.ceipal.com/jobs/career/job-20581/apply',
      campus_portal_job_details_url: 'https://candidateportal.ceipal.com/job-details/job-20581',
      pay_rates: [],
    },
    {
      id: 'req-us',
      job_id: 20596,
      public_job_title: 'Corporate Event Planner',
      country: 'United States',
      state: 'California',
      city: 'Los Angeles',
      multpile_job_location: '(Los Angeles, CA, 90071)',
      created: '08/03/26',
      apply_job_monster: 'https://candidateportal.ceipal.com/jobs/career/job-20596/apply',
      campus_portal_job_details_url: 'https://candidateportal.ceipal.com/job-details/job-20596',
      pay_rates: [],
    },
  ],
}

const careerPortalPayloadPage2 = {
  count: 3,
  num_pages: 2,
  page_number: 2,
  next: null,
  previous: 'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/?page=1',
  results: [
    {
      id: 'req-002',
      job_id: 20597,
      public_job_title: 'RPA Developer',
      position_title: 'RPA Developer',
      public_job_desc: 'Automate business workflows for India clients.',
      country: 'India',
      state: 'Karnataka, Madhya Pradesh, Telangana',
      city: '',
      multpile_job_location: '(Hyderabad, TG, 500013), (Bengaluru, KA, 560001), (Indore, MP, 473335)',
      created: '08/04/26',
      modified: '08/04/26',
      closing_date: null,
      remote_opportunities: 2,
      job_code: 'JPC - 20592',
      tax_terms: '',
      apply_job: 'https://candidateportal.ceipal.com/login/job-20597',
      apply_job_monster: 'https://candidateportal.ceipal.com/jobs/career/job-20597/apply',
      campus_portal_job_details_url: 'https://candidateportal.ceipal.com/job-details/job-20597',
      pay_rates: [],
    },
  ],
}

test('Solugenix catalog records the verified first-party CEIPAL job postings API contract', async () => {
  const { SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG } = await loadCatalog()

  assert.equal(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.source, 'solugenixindiaprivatelimited')
  assert.equal(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.companyName, 'Solugenix India Private Limited')
  assert.equal(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.companyCareerPage, 'https://www.solugenix.com/jobs')
  assert.equal(
    SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalJobPostingsApiBaseUrl,
    'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/',
  )
  assert.equal(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalApiKey, 'RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09')
  assert.equal(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.ceipalCareerPortalId, 'Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09')
  assert.equal(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.atsPlatform, 'ceipal-careerapi')
  assert.equal(
    SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.paginationStrategy,
    'first-party-careers-landing-plus-ceipal-jobpostings-api-pagination',
  )
  assert.equal(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.verifiedOn, '2026-08-04')
  assert.match(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.verifiedSurfaceSummary, /CareerPortalJobPostings/i)
  assert.match(SOLUGENIX_INDIA_PRIVATE_LIMITED_CATALOG.verifiedSurfaceSummary, /37 India roles/i)
})

test('Solugenix scraper helpers stay pinned to the verified CEIPAL widget and CareerPortalJobPostings contract', async () => {
  const solugenix = await loadScript()

  assert.equal(solugenix.hasVerifiedCareersLandingSignal(careersLandingHtml), true)
  assert.equal(solugenix.hasVerifiedJobsPortalSignal(jobsPortalHtml), true)
  assert.deepEqual(solugenix.extractWidgetConfig(jobsPortalHtml), {
    apiKey: 'RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09',
    careerPortalId: 'Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09',
  })
  assert.equal(solugenix.hasWidgetSignal(widgetHtml), true)
  assert.equal(
    solugenix.buildWidgetUrl({
      apiKey: solugenix.CEIPAL_API_KEY,
      careerPortalId: solugenix.CEIPAL_CAREER_PORTAL_ID,
    }),
    solugenix.CEIPAL_WIDGET_URL,
  )
  assert.equal(
    solugenix.buildJobPostingsApiUrl({ page: 2 }),
    'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/?page=2',
  )
  assert.equal(solugenix.hasCareerPortalResponseSignal(careerPortalPayloadPage1), true)

  const jobs = solugenix.extractIndiaJobsFromJobPostingsPayload(careerPortalPayloadPage1)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Java Full Stack Developer (Angular)',
    company: 'Solugenix India Private Limited',
    department: null,
    location: 'Hyderabad, TG, 500013; Bengaluru, KA, 560001',
    city: 'Hyderabad',
    state: 'Karnataka, Telangana',
    country: 'India',
    jobId: '20581',
    requisitionId: 'JPC - 20576',
    sourceUrl: 'https://candidateportal.ceipal.com/job-details/job-20581',
    applyUrl: 'https://candidateportal.ceipal.com/jobs/career/job-20581/apply',
    employmentType: 'Contract',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-24',
    closingDate: null,
    jobDescription: 'Build enterprise applications for India teams.',
    workplaceType: 'On-site',
  })
})

test('Solugenix scraper returns India jobs from the verified CareerPortalJobPostings feed', async () => {
  const solugenix = await loadScript()
  const requests = []

  const jobs = await solugenix.createSolugenixIndiaPrivateLimitedScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === solugenix.CAREERS_LANDING_URL) return careersLandingHtml
      if (url === solugenix.JOBS_PORTAL_URL) return jobsPortalHtml
      if (url === solugenix.CEIPAL_WIDGET_URL) return widgetHtml
      throw new Error(`Unexpected text URL ${url}`)
    },
    fetchJson: async (url) => {
      requests.push(url)
      if (url === 'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/?page=1') {
        return careerPortalPayloadPage1
      }
      if (url === 'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/?page=2') {
        return careerPortalPayloadPage2
      }
      throw new Error(`Unexpected json URL ${url}`)
    },
    now: () => '2026-08-04T12:34:56.000Z',
  })

  assert.deepEqual(requests, [
    solugenix.CAREERS_LANDING_URL,
    solugenix.JOBS_PORTAL_URL,
    solugenix.CEIPAL_WIDGET_URL,
    'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/?page=1',
    'https://careerapi.ceipal.com/RzI5YnRDNlo3OGFmQTVPcVIwcEVaUT09/CareerPortalJobPostings/?page=2',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'solugenixindiaprivatelimited')
  assert.equal(jobs[0].link, 'https://candidateportal.ceipal.com/jobs/career/job-20581/apply')
  assert.equal(jobs[0].companyCareerPage, 'https://www.solugenix.com/jobs')
  assert.equal(jobs[0].companyDomain, 'solugenix.com')
  assert.equal(jobs[0].atsPlatform, 'ceipal-careerapi')
  assert.equal(jobs[0].scrapedAt, '2026-08-04T12:34:56.000Z')
  assert.equal(jobs[1].title, 'RPA Developer')
  assert.equal(jobs[1].workplaceType, 'Hybrid')
})

test('Solugenix scraper fails closed when the verified CEIPAL widget or API contract drifts', async () => {
  const solugenix = await loadScript()

  await assert.rejects(
    solugenix.run({
      fetchText: async () => '<html><body>unexpected</body></html>',
    }),
    /verified solugenix careers landing page/i,
  )

  await assert.rejects(
    solugenix.run({
      fetchText: async (url) => {
        if (url === solugenix.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === solugenix.JOBS_PORTAL_URL) return jobsPortalHtml
        return widgetHtml
      },
      fetchJson: async () => ({ results: 'not-an-array' }),
    }),
    /verified public solugenix ceipal career portal api|careerportaljobpostings/i,
  )
})
