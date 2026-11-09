import assert from 'node:assert/strict'
import test from 'node:test'

const loadSmartSocSolutionsModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Career &#8211; SmartSoC Solutions</title>
    <link rel="canonical" href="https://www.smartsocs.com/career/" />
  </head>
  <body>
    <nav>
      <a href="https://www.smartsocs.com/">Home</a>
      <a href="https://www.smartsocs.com/career/">Career</a>
    </nav>
    <main>
      <h1>Career</h1>
      <h2>Fresher Hiring</h2>
      <h2>Experience Hiring</h2>
      <h2>We are ready for you. Are you too?</h2>
    </main>
  </body>
</html>
`

const jobsAjaxHtml = `
<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-16931">
  <a href="https://www.smartsocs.com/jobs/low-power-verification/" class="awsm-job-item">
    <div class="awsm-grid-left-col">
      <h2 class="awsm-job-post-title">Low power verification</h2>
    </div>
    <div class="awsm-grid-right-col">
      <div class="awsm-job-specification-wrapper">
        <div class="awsm-job-specification-item awsm-job-specification-job-category">
          <span class="awsm-job-specification-term">VLSI (Silicon engineering)</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-type">
          <span class="awsm-job-specification-term">Full Time</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-term">India: Bangalore</span>
          <span class="awsm-job-specification-term">India: Hyderabad</span>
        </div>
      </div>
    </div>
  </a>
</div>
<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-16933">
  <a href="https://www.smartsocs.com/jobs/pattern-generation/" class="awsm-job-item">
    <div class="awsm-grid-left-col">
      <h2 class="awsm-job-post-title">Pattern Generation</h2>
    </div>
    <div class="awsm-grid-right-col">
      <div class="awsm-job-specification-wrapper">
        <div class="awsm-job-specification-item awsm-job-specification-job-category">
          <span class="awsm-job-specification-term">VLSI (Silicon engineering)</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-type">
          <span class="awsm-job-specification-term">Full Time</span>
        </div>
        <div class="awsm-job-specification-item awsm-job-specification-job-location">
          <span class="awsm-job-specification-term">India: Bangalore</span>
          <span class="awsm-job-specification-term">India: Hyderabad</span>
        </div>
      </div>
    </div>
  </a>
</div>
`

const emptyJobsAjaxHtml = `
<div class="awsm-jobs-pagination awsm-load-more-main awsm-no-more-jobs-container">
  <p>Sorry! No more jobs to show.</p>
</div>
`

const mixedLocationJobsAjaxHtml = `
<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-17001">
  <a href="https://www.smartsocs.com/jobs/mixed-location-role/" class="awsm-job-item">
    <h2 class="awsm-job-post-title">Mixed Location Role</h2>
    <div class="awsm-job-specification-item awsm-job-specification-job-location">
      <span class="awsm-job-specification-term">Bangalore</span>
      <span class="awsm-job-specification-term">Sweden: Stockholm</span>
      <span class="awsm-job-specification-term">USA: Delaware</span>
      <span class="awsm-job-specification-term">India: Hyderabad</span>
    </div>
  </a>
</div>
<div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-17002">
  <a href="https://www.smartsocs.com/jobs/global-only-role/" class="awsm-job-item">
    <h2 class="awsm-job-post-title">Global Only Role</h2>
    <div class="awsm-job-specification-item awsm-job-specification-job-location">
      <span class="awsm-job-specification-term">Sweden: Stockholm</span>
      <span class="awsm-job-specification-term">USA: Delaware</span>
    </div>
  </a>
</div>
`

test('SmartSoC Solutions scraper pins the verified first-party careers surface', async () => {
  const smartSoc = await loadSmartSocSolutionsModule()
  assert.ok(smartSoc, 'Expected SmartSoC Solutions scraper module at ./script.js')

  assert.equal(smartSoc.SOURCE, 'smartsocsolutions')
  assert.equal(smartSoc.COMPANY, 'SmartSoC Solutions')
  assert.equal(smartSoc.CAREER_PAGE_URL, 'https://www.smartsocs.com/career/')
  assert.equal(smartSoc.JOBS_AJAX_URL, 'https://www.smartsocs.com/wp-admin/admin-ajax.php')
  assert.equal(smartSoc.hasOfficialCareerPageSignal(careerPageHtml), true)
  assert.deepEqual(smartSoc.extractLoadMoreRequestMetadata(careerPageHtml), {
    action: 'loadmore',
    listingsPerPage: 10,
    paginationBase: 'https://www.smartsocs.com/career/',
  })
})

test('extractJobsFromAjaxHtml parses the verified public SmartSoC job cards', async () => {
  const smartSoc = await loadSmartSocSolutionsModule()
  assert.ok(smartSoc, 'Expected SmartSoC Solutions scraper module at ./script.js')

  assert.deepEqual(smartSoc.extractJobsFromAjaxHtml(jobsAjaxHtml), [
    {
      title: 'Low power verification',
      company: 'SmartSoC Solutions',
      department: 'VLSI (Silicon engineering)',
      location: 'Bangalore; Hyderabad, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '16931',
      requisitionId: '16931',
      sourceUrl: 'https://www.smartsocs.com/jobs/low-power-verification/',
      applyUrl: 'https://www.smartsocs.com/jobs/low-power-verification/',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Pattern Generation',
      company: 'SmartSoC Solutions',
      department: 'VLSI (Silicon engineering)',
      location: 'Bangalore; Hyderabad, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '16933',
      requisitionId: '16933',
      sourceUrl: 'https://www.smartsocs.com/jobs/pattern-generation/',
      applyUrl: 'https://www.smartsocs.com/jobs/pattern-generation/',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])

  assert.deepEqual(smartSoc.extractJobsFromAjaxHtml(emptyJobsAjaxHtml), [])

  assert.deepEqual(
    smartSoc.extractJobsFromAjaxHtml(mixedLocationJobsAjaxHtml).map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
    })),
    [
      {
        title: 'Mixed Location Role',
        location: 'Bangalore; Hyderabad, India',
        city: 'Bangalore',
      },
    ],
  )
})

test('run fetches the SmartSoC career page and loadmore endpoint to return jobs', async () => {
  const smartSoc = await loadSmartSocSolutionsModule()
  assert.ok(smartSoc, 'Expected SmartSoC Solutions scraper module at ./script.js')

  const requests = []
  const jobs = await smartSoc.createSmartSocSolutionsScraper().run({
    fetchText: async (url, options = {}) => {
      requests.push({ url, options })

      if (url === smartSoc.CAREER_PAGE_URL) {
        return careerPageHtml
      }

      if (url === smartSoc.JOBS_AJAX_URL && /(?:^|&)paged=1(?:&|$)/.test(options.body)) {
        assert.match(options.body, /(?:^|&)action=loadmore(?:&|$)/)
        assert.match(options.body, /(?:^|&)listings_per_page=10(?:&|$)/)
        return jobsAjaxHtml
      }

      if (url === smartSoc.JOBS_AJAX_URL && /(?:^|&)paged=2(?:&|$)/.test(options.body)) {
        assert.match(options.body, /(?:^|&)action=loadmore(?:&|$)/)
        assert.match(options.body, /(?:^|&)listings_per_page=10(?:&|$)/)
        return emptyJobsAjaxHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.deepEqual(requests, [
    {
      url: smartSoc.CAREER_PAGE_URL,
      options: {},
    },
    {
      url: smartSoc.JOBS_AJAX_URL,
      options: {
        method: 'POST',
        body: 'action=loadmore&paged=1&listings_per_page=10',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      },
    },
    {
      url: smartSoc.JOBS_AJAX_URL,
      options: {
        method: 'POST',
        body: 'action=loadmore&paged=2&listings_per_page=10',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      },
    },
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Low power verification',
    company: 'SmartSoC Solutions',
    department: 'VLSI (Silicon engineering)',
    location: 'Bangalore; Hyderabad, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '16931',
    requisitionId: '16931',
    sourceUrl: 'https://www.smartsocs.com/jobs/low-power-verification/',
    applyUrl: 'https://www.smartsocs.com/jobs/low-power-verification/',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
    source: 'smartsocsolutions',
    link: 'https://www.smartsocs.com/jobs/low-power-verification/',
    scrapedAt: '2026-07-13T00:00:00.000Z',
    companyCareerPage: 'https://www.smartsocs.com/career/',
    companyDomain: 'www.smartsocs.com',
    atsPlatform: 'wp-job-openings',
  })
})

test('run fails closed when the verified SmartSoC careers surface drifts', async () => {
  const smartSoc = await loadSmartSocSolutionsModule()
  assert.ok(smartSoc, 'Expected SmartSoC Solutions scraper module at ./script.js')

  await assert.rejects(
    smartSoc.createSmartSocSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === smartSoc.CAREER_PAGE_URL) {
          return '<html><head><title>Career</title></head><body>Career</body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career page no longer matches/i,
  )

  await assert.rejects(
    smartSoc.createSmartSocSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === smartSoc.CAREER_PAGE_URL) {
          return careerPageHtml
        }

        if (url === smartSoc.JOBS_AJAX_URL) {
          return '<div>unexpected payload</div>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs ajax response no longer exposes trusted public job cards/i,
  )
})
