import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Embark on a journey of Endless Possibilities - where your ambition meets our unconventional spirit</h1>
      <p>Invent. Disrupt. Repeat. Join our league of innovators!</p>
      <a href="/careers/jobs-listing">Explore Jobs</a>
      <footer>
        <p>Copyright 2026 Tanla. All rights reserved.</p>
      </footer>
    </main>
  </body>
</html>
`

const JOBS_LISTING_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Tanla Jobs</h1>
      <p>Live your best life and do your best work with us</p>
      <section class="job-card">
        <h3>Sr QA Automation Engineer</h3>
        <h5>Location</h5>
        <p>Hyderabad, Telangana IN</p>
        <h5>Department</h5>
        <p>Product & Engineering</p>
        <a href="/job-info/sr-qa-automation-engineer">Apply</a>
      </section>
      <section class="job-card">
        <h3>Data Engineer</h3>
        <h5>Location</h5>
        <p>Hyderabad, Telangana IN</p>
        <h5>Department</h5>
        <p>Product & Engineering</p>
        <a href="/job-info/data-engineer">Apply</a>
      </section>
      <section class="job-card">
        <h3>Data Analyst</h3>
        <h5>Location</h5>
        <p>Hyderabad, Telangana IN</p>
        <h5>Department</h5>
        <p>Product & Engineering</p>
        <a href="/job-info/data-analyst">Apply</a>
      </section>
      <button>Load More</button>
    </main>
  </body>
</html>
`

const DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Sr QA Automation Engineer</h1>
      <h5>Location</h5>
      <p>Hyderabad, Telangana IN</p>
      <h5>Department</h5>
      <p>Product & Engineering</p>
      <h2>Job Role</h2>
      <p>As a Software Quality Engineer you will play a critical role in ensuring the delivery of high-quality software products.</p>
      <h2>What you'll be responsible for?</h2>
      <ul>
        <li>Designing and executing manual test cases.</li>
        <li>Performing API testing.</li>
      </ul>
      <h2>Qualification and other skills</h2>
      <ul>
        <li>Microservices, Docker, Kubernetes</li>
        <li>Cloud exposure</li>
        <li>Jira exposure</li>
      </ul>
      <h2>What you'd have?</h2>
      <ul>
        <li>10+ years of hands-on experience in Quality Assurance.</li>
        <li>Comfortable to code in Python, Robot framework & Pytest.</li>
      </ul>
      <h2>Why join us?</h2>
      <p>Impactful Work. Tremendous Growth Opportunities. Innovative Environment.</p>
      <p>Tanla is an equal opportunity employer.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tanlaplatforms/script.js')
  } catch {
    assert.fail('Expected Tanla Platforms scraper module at ../../scraper/tanlaplatforms/script.js')
  }
}

test('Tanla Platforms helpers stay pinned to the verified first-party careers, listing, and detail surfaces', async () => {
  const tanla = await loadModule()

  assert.equal(tanla.SOURCE, 'tanlaplatforms')
  assert.equal(tanla.COMPANY_NAME, 'Tanla Platforms')
  assert.equal(tanla.OFFICIAL_BRAND_NAME, 'Tanla Platforms Limited')
  assert.equal(tanla.VERIFIED_AT, '2026-08-05')
  assert.equal(tanla.HOMEPAGE_URL, 'https://www.tanla.com/')
  assert.equal(tanla.OFFICIAL_CAREERS_URL, 'https://www.tanla.com/careers')
  assert.equal(tanla.OFFICIAL_JOBS_HANDOFF_URL, 'https://www.tanla.com/careers/jobs-listing')
  assert.equal(tanla.VERIFIED_SAMPLE_JOB_URL, 'https://www.tanla.com/job-info/sr-qa-automation-engineer')
  assert.equal(tanla.hasOfficialCareersPageSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(
    tanla.extractOfficialJobsListingUrl(OFFICIAL_CAREERS_HTML),
    'https://www.tanla.com/careers/jobs-listing',
  )
  assert.equal(tanla.hasOfficialJobsListingSignal(JOBS_LISTING_HTML), true)
  assert.equal(tanla.pageExposesPublicJobListings(JOBS_LISTING_HTML), true)

  const cards = tanla.extractListingCards(JOBS_LISTING_HTML)
  assert.equal(cards.length, 3)
  assert.deepEqual(cards[0], {
    title: 'Sr QA Automation Engineer',
    department: 'Product & Engineering',
    location: 'Hyderabad, Telangana IN',
    sourceUrl: 'https://www.tanla.com/job-info/sr-qa-automation-engineer',
  })

  const detail = tanla.extractJobDetail(DETAIL_HTML, cards[0])
  assert.equal(detail.title, 'Sr QA Automation Engineer')
  assert.equal(detail.company, 'Tanla Platforms')
  assert.equal(detail.department, 'Product & Engineering')
  assert.equal(detail.location, 'Hyderabad, Telangana, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.country, 'India')
  assert.equal(detail.sourceUrl, 'https://www.tanla.com/job-info/sr-qa-automation-engineer')
  assert.equal(detail.applyUrl, 'https://www.tanla.com/job-info/sr-qa-automation-engineer')
  assert.equal(detail.experienceRequired, '10+ years')
  assert.deepEqual(detail.requiredSkills, [
    'Microservices, Docker, Kubernetes',
    'Cloud exposure',
    'Jira exposure',
  ])
  assert.match(detail.jobDescription, /Software Quality Engineer/i)
  assert.match(detail.jobDescription, /Designing and executing manual test cases/i)
  assert.match(detail.jobDescription, /Tanla is an equal opportunity employer/i)
})

test('Tanla Platforms run validates the careers handoff, listing page, and detail page before returning jobs', async () => {
  const tanla = await loadModule()
  const requestedUrls = []

  const jobs = await tanla.createTanlaPlatformsScraper({
    maxJobs: 1,
    now: () => '2026-08-05T00:00:00.000Z',
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tanla.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === tanla.OFFICIAL_JOBS_HANDOFF_URL) return JOBS_LISTING_HTML
      if (url === tanla.VERIFIED_SAMPLE_JOB_URL) return DETAIL_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [
    tanla.OFFICIAL_CAREERS_URL,
    tanla.OFFICIAL_JOBS_HANDOFF_URL,
    tanla.VERIFIED_SAMPLE_JOB_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'tanlaplatforms')
  assert.equal(jobs[0].company, 'Tanla Platforms')
  assert.equal(jobs[0].jobId, 'sr-qa-automation-engineer')
  assert.equal(jobs[0].link, tanla.VERIFIED_SAMPLE_JOB_URL)
  assert.equal(jobs[0].scrapedAt, '2026-08-05T00:00:00.000Z')
})

test('Tanla Platforms fails closed when the verified careers page, listing page, or detail contract drifts materially', async () => {
  const tanla = await loadModule()

  await assert.rejects(
    tanla.createTanlaPlatformsScraper({
      fetchText: async (url) => {
        if (url === tanla.OFFICIAL_CAREERS_URL) {
          return OFFICIAL_CAREERS_HTML.replace('Explore Jobs', 'Learn More')
        }
        return JOBS_LISTING_HTML
      },
    }).run(),
    /verified Tanla careers page/i,
  )

  await assert.rejects(
    tanla.createTanlaPlatformsScraper({
      fetchText: async (url) => {
        if (url === tanla.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === tanla.OFFICIAL_JOBS_HANDOFF_URL) {
          return '<html><body><h1>Tanla Jobs</h1><p>No roles today.</p></body></html>'
        }
        return DETAIL_HTML
      },
    }).run(),
    /verified Tanla jobs listing page/i,
  )

  await assert.rejects(
    tanla.createTanlaPlatformsScraper({
      maxJobs: 1,
      fetchText: async (url) => {
        if (url === tanla.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
        if (url === tanla.OFFICIAL_JOBS_HANDOFF_URL) return JOBS_LISTING_HTML
        return DETAIL_HTML.replace('Product & Engineering', 'Corporate Functions')
      },
    }).run(),
    /verified Tanla detail page/i,
  )
})

test('Tanla Platforms returns an empty result when the live first-party host times out', async () => {
  const tanla = await loadModule()

  const jobs = await tanla.createTanlaPlatformsScraper({
    fetchText: async () => {
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: www.tanla.com:443, timeout: 10000ms)',
      }
      throw error
    },
  }).run()

  assert.deepEqual(jobs, [])
})

test('Tanla Platforms keeps listing-level jobs when a detail page times out after the verified listing has loaded', async () => {
  const tanla = await loadModule()

  const jobs = await tanla.createTanlaPlatformsScraper({
    maxJobs: 1,
    now: () => '2026-08-05T00:00:00.000Z',
    fetchText: async (url) => {
      if (url === tanla.OFFICIAL_CAREERS_URL) return OFFICIAL_CAREERS_HTML
      if (url === tanla.OFFICIAL_JOBS_HANDOFF_URL) return JOBS_LISTING_HTML
      if (url === tanla.VERIFIED_SAMPLE_JOB_URL) {
        const error = new TypeError('fetch failed')
        error.cause = {
          code: 'UND_ERR_CONNECT_TIMEOUT',
          message: 'Connect Timeout Error (attempted address: www.tanla.com:443, timeout: 10000ms)',
        }
        throw error
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }).run()

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Sr QA Automation Engineer')
  assert.equal(jobs[0].sourceUrl, tanla.VERIFIED_SAMPLE_JOB_URL)
  assert.equal(jobs[0].applyUrl, tanla.VERIFIED_SAMPLE_JOB_URL)
  assert.equal(jobs[0].department, 'Product & Engineering')
  assert.equal(jobs[0].location, 'Hyderabad, Telangana, India')
  assert.equal(jobs[0].jobDescription, null)
  assert.deepEqual(jobs[0].requiredSkills, [])
})
