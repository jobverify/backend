import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Sensiple | Join Our Team of Innovators</title>
  </head>
  <body>
    <h1>Explore opportunities at Sensiple and take the next step in your career.</h1>
    <h2>Current Openings</h2>
    <div id="jobListings">Loading jobs...</div>
    <script>
      fetch('https://www.sensiple.com/wp-admin/admin-ajax.php?action=get_jobs_secure')
      fetch('https://www.sensiple.com/wp-admin/admin-ajax.php?action=submit_and_link', { method: 'POST' })
    </script>
  </body>
</html>
`

const jobsPayload = {
  success: true,
  data: [
    {
      ReqIntID: 'RQ00000112',
      ReqID: 'Job-0112',
      JobTitle: 'Business Development Executive',
      JobType: 'Experienced',
      Location: 'Chennai',
      TotalExp: '4 to 8 years',
      PrimarySkills: 'US Sales,Inside Sales,Cold Calling,Cloud Sales',
      Status: 'Active',
      Description:
        '<p><strong>Role:</strong> Business Development Executive</p><p>Work timings - US EST timings (6.30 PM to 3.30 AM IST)</p>',
    },
    {
      ReqIntID: 'RQ00000110',
      ReqID: 'Job-0110',
      JobTitle: 'Technical Recruiter',
      JobType: 'Experienced',
      Location: 'Chennai',
      TotalExp: '2 to 5 years',
      PrimarySkills: 'US IT Recruitment, W2, C2C',
      Status: 'Active',
      Description:
        '<p><strong>Role:</strong> Technical Recruiter</p><p>Experience in US staffing and stakeholder coordination.</p>',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/sensiple/script.js')
  } catch {
    assert.fail('Expected Sensiple scraper module at ../../scraper/sensiple/script.js')
  }
}

test('Sensiple helpers stay pinned to the verified careers page and same-domain jobs AJAX contract', async () => {
  const sensiple = await loadModule()

  assert.equal(sensiple.SOURCE, 'sensiple')
  assert.equal(sensiple.COMPANY, 'Sensiple')
  assert.equal(sensiple.CAREERS_URL, 'https://www.sensiple.com/careers/')
  assert.equal(
    sensiple.JOBS_API_URL,
    'https://www.sensiple.com/wp-admin/admin-ajax.php?action=get_jobs_secure',
  )
  assert.equal(sensiple.VERIFIED_ON, '2026-07-17')
  assert.equal(sensiple.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(
    sensiple.extractJobsApiUrl(careersPageHtml),
    'https://www.sensiple.com/wp-admin/admin-ajax.php?action=get_jobs_secure',
  )
  assert.deepEqual(
    sensiple.normalizeJobPayload(jobsPayload.data[0], { scrapedAt: FIXED_SCRAPED_AT }),
    {
      jobId: 'RQ00000112',
      title: 'Business Development Executive',
      company: 'Sensiple',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      sourceUrl: 'https://www.sensiple.com/careers/#RQ00000112',
      applyUrl: 'https://www.sensiple.com/careers/#RQ00000112',
      employmentType: null,
      experienceRequired: '4 to 8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['US Sales', 'Inside Sales', 'Cold Calling', 'Cloud Sales'],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Role: Business Development Executive Work timings - US EST timings (6.30 PM to 3.30 AM IST)',
      requisitionId: 'Job-0112',
      source: 'sensiple',
      link: 'https://www.sensiple.com/careers/#RQ00000112',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  )
})

test('Sensiple run validates the verified careers page and returns normalized active jobs from the same-domain AJAX payload', async () => {
  const sensiple = await loadModule()
  const requestedUrls = []

  const jobs = await sensiple.createSensipleScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sensiple.CAREERS_URL) return careersPageHtml

      throw new Error(`Unexpected Sensiple text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, sensiple.JOBS_API_URL)
      return jobsPayload
    },
  })

  assert.deepEqual(requestedUrls, [
    sensiple.CAREERS_URL,
    sensiple.JOBS_API_URL,
  ])
  assert.deepEqual(jobs, [
    {
      jobId: 'RQ00000112',
      title: 'Business Development Executive',
      company: 'Sensiple',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      sourceUrl: 'https://www.sensiple.com/careers/#RQ00000112',
      applyUrl: 'https://www.sensiple.com/careers/#RQ00000112',
      employmentType: null,
      experienceRequired: '4 to 8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['US Sales', 'Inside Sales', 'Cold Calling', 'Cloud Sales'],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Role: Business Development Executive Work timings - US EST timings (6.30 PM to 3.30 AM IST)',
      requisitionId: 'Job-0112',
      source: 'sensiple',
      link: 'https://www.sensiple.com/careers/#RQ00000112',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.sensiple.com/careers/',
      companyDomain: 'sensiple.com',
      atsPlatform: 'official-company-careers',
    },
    {
      jobId: 'RQ00000110',
      title: 'Technical Recruiter',
      company: 'Sensiple',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      sourceUrl: 'https://www.sensiple.com/careers/#RQ00000110',
      applyUrl: 'https://www.sensiple.com/careers/#RQ00000110',
      employmentType: null,
      experienceRequired: '2 to 5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['US IT Recruitment', 'W2', 'C2C'],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Role: Technical Recruiter Experience in US staffing and stakeholder coordination.',
      requisitionId: 'Job-0110',
      source: 'sensiple',
      link: 'https://www.sensiple.com/careers/#RQ00000110',
      scrapedAt: FIXED_SCRAPED_AT,
      companyCareerPage: 'https://www.sensiple.com/careers/',
      companyDomain: 'sensiple.com',
      atsPlatform: 'official-company-careers',
    },
  ])
})

test('Sensiple fails closed when the verified careers page or jobs payload drifts materially', async () => {
  const sensiple = await loadModule()

  await assert.rejects(
    sensiple.createSensipleScraper().run({
      fetchText: async (url) => {
        if (url === sensiple.CAREERS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        throw new Error(`Unexpected Sensiple text URL: ${url}`)
      },
      fetchJson: async () => jobsPayload,
    }),
    /verified Sensiple careers page/i,
  )

  await assert.rejects(
    sensiple.createSensipleScraper().run({
      fetchText: async (url) => {
        if (url === sensiple.CAREERS_URL) return careersPageHtml
        throw new Error(`Unexpected Sensiple text URL: ${url}`)
      },
      fetchJson: async () => ({ success: false }),
    }),
    /verified Sensiple jobs payload/i,
  )
})
