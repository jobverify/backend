import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T00:00:00.000Z'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers in AI &amp; Agentic AI | Transform Enterprise Change – HTC</title>
    <link rel="canonical" href="https://www.htcinc.com/careers/" />
    <meta
      name="description"
      content="Join HTC in shaping enterprise transformation through AI and Agentic AI. Explore careers where intelligent automation, claims processing agents, and conversational AI agents drive change"
    />
  </head>
  <body>
    <main>
      <p>Join HTC in shaping enterprise transformation through AI and Agentic AI.</p>
      <a href="https://www.htcinc.com/career-job-listing/">Explore Open Roles</a>
    </main>
  </body>
</html>
`

const jobsListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at HTC Global | Work on AI &amp; Agentic AI Innovation</title>
    <link rel="canonical" href="https://www.htcinc.com/career-job-listing/" />
  </head>
  <body>
    <h2 class="career_job_listing_title">All Jobs</h2>
    <div id="job-list">Loading...</div>
    <script>
      fetch("https://www.htcinc.com/wp-content/themes/himalayas-child/job-api-proxy.php")
        .then(response => response.json())
    </script>
  </body>
</html>
`

const jobsProxyPayload = {
  status: 'OK',
  data: {
    jobs: [
      {
        requisition_number: '243561',
        job_title: 'Accounts Payable / Travel & Expenses (Night Shift)',
        location_name: 'Chennai',
        state_code: 'TN',
        posted_date: '07/14/2026',
        employment_type: null,
        job_description: 'About the Role:\\nWe are seeking a Cash Application Specialist with 2 to 5 years of experience.',
      },
      {
        requisition_number: '241094',
        job_title: 'Technical Project Manager',
        location_name: 'Pune',
        state_code: 'MH',
        posted_date: '07/09/2026',
        employment_type: null,
        job_description: 'About the Role:\\nLead the planning, execution, and delivery of complex technical projects.',
      },
      {
        requisition_number: '243458',
        job_title: 'AI Engineer (Innovation)',
        location_name: 'Abu Dhabi',
        state_code: 'Abu Dhabi',
        posted_date: '06/22/2026',
        employment_type: null,
        job_description: 'About the Role:\\nWe are seeking an AI Engineer (Innovation).',
      },
    ],
  },
}

const loadHtcModule = async () => {
  try {
    return await import('../../scraper/htcglobalservices/script.js')
  } catch {
    assert.fail('Expected HTC Global Services scraper module at ../../scraper/htcglobalservices/script.js')
  }
}

test('HTC Global Services pins the verified first-party careers pages and jobs proxy constants', async () => {
  const htc = await loadHtcModule()

  assert.equal(htc.SOURCE, 'htcglobalservices')
  assert.equal(htc.COMPANY_NAME, 'HTC Global Services')
  assert.equal(htc.OFFICIAL_BRAND_NAME, 'HTC Global Services')
  assert.equal(htc.OFFICIAL_CAREERS_URL, 'https://www.htcinc.com/careers/')
  assert.equal(htc.JOBS_LISTING_URL, 'https://www.htcinc.com/career-job-listing/')
  assert.equal(
    htc.JOBS_PROXY_URL,
    'https://www.htcinc.com/wp-content/themes/himalayas-child/job-api-proxy.php',
  )
  assert.equal(htc.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(htc.hasOfficialJobsListingSignal(jobsListingHtml), true)
  assert.equal(htc.buildJobDetailUrl('243561'), 'https://www.htcinc.com/job-detail/?jobcode=243561')
  assert.equal(htc.buildJobApplyUrl('243561'), 'https://www.htcinc.com/apply-now/?jobcode=243561')
})

test('HTC Global Services keeps only India jobs from the verified first-party proxy payload', async () => {
  const htc = await loadHtcModule()

  const jobs = htc.extractIndiaJobsFromProxyPayload(jobsProxyPayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Accounts Payable / Travel & Expenses (Night Shift)',
      company: 'HTC Global Services',
      department: null,
      location: 'Chennai, Tamil Nadu, India',
      city: 'Chennai',
      country: 'India',
      jobId: '243561',
      requisitionId: '243561',
      sourceUrl: 'https://www.htcinc.com/job-detail/?jobcode=243561',
      applyUrl: 'https://www.htcinc.com/apply-now/?jobcode=243561',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-14',
      closingDate: null,
      jobDescription: 'About the Role:\\nWe are seeking a Cash Application Specialist with 2 to 5 years of experience.',
      source: 'htcglobalservices',
      link: 'https://www.htcinc.com/apply-now/?jobcode=243561',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Technical Project Manager',
      company: 'HTC Global Services',
      department: null,
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      country: 'India',
      jobId: '241094',
      requisitionId: '241094',
      sourceUrl: 'https://www.htcinc.com/job-detail/?jobcode=241094',
      applyUrl: 'https://www.htcinc.com/apply-now/?jobcode=241094',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-09',
      closingDate: null,
      jobDescription: 'About the Role:\\nLead the planning, execution, and delivery of complex technical projects.',
      source: 'htcglobalservices',
      link: 'https://www.htcinc.com/apply-now/?jobcode=241094',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('HTC Global Services run validates the official careers pages before reading the first-party jobs proxy', async () => {
  const htc = await loadHtcModule()
  const requested = []

  const jobs = await htc.createHtcGlobalServicesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === htc.OFFICIAL_CAREERS_URL) return careersLandingHtml
      if (url === htc.JOBS_LISTING_URL) return jobsListingHtml
      throw new Error(`Unexpected HTC URL: ${url}`)
    },
    fetchJson: async (url) => {
      requested.push({ type: 'json', url })
      return jobsProxyPayload
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: 'https://www.htcinc.com/careers/' },
    { type: 'text', url: 'https://www.htcinc.com/career-job-listing/' },
    {
      type: 'json',
      url: 'https://www.htcinc.com/wp-content/themes/himalayas-child/job-api-proxy.php',
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'htcglobalservices')
  assert.equal(jobs[0].company, 'HTC Global Services')
  assert.equal(jobs[0].link, 'https://www.htcinc.com/apply-now/?jobcode=243561')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('HTC Global Services fails closed when the verified careers surfaces or proxy payload drift', async () => {
  const htc = await loadHtcModule()

  await assert.rejects(
    htc.createHtcGlobalServicesScraper().run({
      fetchText: async (url) => {
        if (url === htc.OFFICIAL_CAREERS_URL) {
          return careersLandingHtml.replace(
            'https://www.htcinc.com/career-job-listing/',
            'https://example.com/jobs',
          )
        }
        throw new Error(`Unexpected HTC URL: ${url}`)
      },
      fetchJson: async () => jobsProxyPayload,
    }),
    /verified official careers landing/i,
  )

  await assert.rejects(
    htc.createHtcGlobalServicesScraper().run({
      fetchText: async (url) => {
        if (url === htc.OFFICIAL_CAREERS_URL) return careersLandingHtml
        if (url === htc.JOBS_LISTING_URL) {
          return jobsListingHtml.replace(
            'https://www.htcinc.com/wp-content/themes/himalayas-child/job-api-proxy.php',
            'https://example.com/proxy.json',
          )
        }
        throw new Error(`Unexpected HTC URL: ${url}`)
      },
      fetchJson: async () => jobsProxyPayload,
    }),
    /verified jobs listing page/i,
  )

  await assert.rejects(
    htc.createHtcGlobalServicesScraper().run({
      fetchText: async (url) => {
        if (url === htc.OFFICIAL_CAREERS_URL) return careersLandingHtml
        if (url === htc.JOBS_LISTING_URL) return jobsListingHtml
        throw new Error(`Unexpected HTC URL: ${url}`)
      },
      fetchJson: async () => ({ data: { jobs: null } }),
    }),
    /jobs proxy response/i,
  )
})
