import assert from 'node:assert/strict'
import test from 'node:test'

const loadMarutAirModule = async () => {
  try {
    return await import('../../scraper/marutair/script.js')
  } catch {
    assert.fail('Expected Marut Air scraper module at ../../scraper/marutair/script.js')
  }
}

const brandPageHtml = `
  <html>
    <head>
      <title>About Marut Air | HVLS Fan manufacturer in Ahmedabad, India</title>
    </head>
    <body>
      <header>
        <a href="https://marutair.com/career/">Career</a>
      </header>
      <main>
        <h1>Marut Air: <span>Leading HVLS Fan Manufacturer</span> in Ahmedabad, India</h1>
        <p>We are a team of designers, developers, and engineers that provide solutions as per the application of the buildings.</p>
        <p>Copyrights &copy; 2024 All Rights Reserved by Marut Air</p>
      </main>
    </body>
  </html>
`
const brandPageChallengeHtml = `
  <html>
    <head>
      <title>You are being redirected...</title>
    </head>
    <body>
      <noscript>Javascript is required. Please enable javascript before you are allowed to see this page.</noscript>
      <script>
        var sucuri_cloudproxy_js = '';
      </script>
    </body>
  </html>
`
const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs | Marut Air Systems Pvt Ltd</title>
  </head>
  <body>
    <a draggable="false" href="/jobs/full-stack-developer-32" class="text-decoration-none text-reset">
      <div class="card-body p-4">
        <h3>Full Stack Developer</h3>
        <h5 class="text-reset"><span>3</span> open positions</h5>
        <div class="oe_empty text-muted mb16">
          <div>We are seeking a Full Stack Developer to join our dynamic team, bringing expertise in both front-end and back-end technologies.</div>
        </div>
        <div class="o_job_infos d-flex flex-column">
          <address class="o_portal_address mb-0">
            <span itemprop="addressLocality">AHMEDABAD</span>,
            <span itemprop="addressCountry">India</span>
          </address>
          <div class="d-inline-flex align-items-center">
            <i class="fa fa-sitemap fa-fw" title="Department"></i><span class="fw-light">Research and development</span>
          </div>
        </div>
      </div>
    </a>
    <a draggable="false" href="/jobs/hr-recruiter-35" class="text-decoration-none text-reset">
      <div class="card-body p-4">
        <h3>HR Recruiter</h3>
        <h5 class="text-reset"><span>1</span> open position</h5>
        <div class="oe_empty text-muted mb16">
          <div>Drive candidate outreach, coordinate interviews, and keep hiring pipelines moving for the Marut Air team.</div>
        </div>
        <div class="o_job_infos d-flex flex-column">
          <address class="o_portal_address mb-0">
            <span itemprop="addressLocality">AHMEDABAD</span>,
            <span itemprop="addressCountry">India</span>
          </address>
          <div class="d-inline-flex align-items-center">
            <i class="fa fa-sitemap fa-fw" title="Department"></i><span class="fw-light">Human Resources</span>
          </div>
        </div>
      </div>
    </a>
    <p>info@marutair.com</p>
  </body>
</html>
`

const fullStackDeveloperDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Full Stack Developer | Marut Air Systems Pvt Ltd</title>
  </head>
  <body>
    <a href="/jobs">All Jobs</a>
    <h1>Full Stack Developer</h1>
    <p>AHMEDABAD, India</p>
    <a href="/jobs/apply/full-stack-developer-32">Apply Now!</a>
    <p>We are seeking a Full Stack Developer to join our dynamic team, bringing expertise in both front-end and back-end technologies.</p>
    <p>The ideal candidate will have a proven track record in developing scalable web applications and delivering engaging user experiences.</p>
    <p>info@marutair.com</p>
  </body>
</html>
`

const hrRecruiterDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>HR Recruiter | Marut Air Systems Pvt Ltd</title>
  </head>
  <body>
    <a href="/jobs">All Jobs</a>
    <h1>HR Recruiter</h1>
    <p>AHMEDABAD, India</p>
    <a href="/jobs/apply/hr-recruiter-35">Apply Now!</a>
    <p>Drive candidate outreach, coordinate interviews, and keep hiring pipelines moving for the Marut Air team.</p>
    <p>info@marutair.com</p>
  </body>
</html>
`

const emptyJobsPageHtml = `
  <html><head><title>Jobs | Marut Air</title></head><body>
    <h1>Our Job Opportunities</h1>
    <p>There are currently no open job opportunities, but feel free to contact us for a spontaneous application.</p>
    <footer>Copyright MARUT AIR SYSTEMS PRIVATE LIMITED</footer>
  </body></html>
`

test('Marut Air returns zero only for the verified official empty jobs state', async () => {
  const marutAir = await loadMarutAirModule()
  assert.equal(marutAir.hasVerifiedEmptyJobsPageSignal(emptyJobsPageHtml), true)
  assert.equal(marutAir.hasVerifiedEmptyJobsPageSignal(emptyJobsPageHtml.replace('MARUT AIR SYSTEMS PRIVATE LIMITED', 'Other Company')), false)
  assert.equal(marutAir.hasVerifiedEmptyJobsPageSignal(`${emptyJobsPageHtml}<a href="/jobs/new-role-99">New role</a>`), false)

  const jobs = await marutAir.createMarutAirScraper().run({
    fetchText: async (url) => url === marutAir.BRAND_PAGE_URL ? brandPageHtml : emptyJobsPageHtml,
  })
  assert.deepEqual(jobs, [])
})

test('Marut Air verifies the current first-party brand page and public jobs board signals', async () => {
  const marutAir = await loadMarutAirModule()

  assert.equal(marutAir.BRAND_PAGE_URL, 'https://marutair.com/about-us/')
  assert.equal(marutAir.JOBS_PAGE_URL, 'https://crm.marutair.com/jobs')
  assert.equal(marutAir.hasBrandPageSignal(brandPageHtml), true)
  assert.equal(marutAir.hasJobsPageSignal(jobsPageHtml), true)
})

test('Marut Air extracts job cards from the first-party Odoo jobs board', async () => {
  const marutAir = await loadMarutAirModule()
  const cards = marutAir.extractJobCards(jobsPageHtml)

  assert.equal(cards.length, 2)
  assert.deepEqual(
    cards.map((card) => ({
      title: card.title,
      detailUrl: card.detailUrl,
      openingsLabel: card.openingsLabel,
      department: card.department,
      location: card.location,
      jobId: card.jobId,
    })),
    [
      {
        title: 'Full Stack Developer',
        detailUrl: 'https://crm.marutair.com/jobs/full-stack-developer-32',
        openingsLabel: '3 open positions',
        department: 'Research and development',
        location: 'Ahmedabad, India',
        jobId: '32',
      },
      {
        title: 'HR Recruiter',
        detailUrl: 'https://crm.marutair.com/jobs/hr-recruiter-35',
        openingsLabel: '1 open position',
        department: 'Human Resources',
        location: 'Ahmedabad, India',
        jobId: '35',
      },
    ],
  )
})

test('Marut Air enriches listing cards from a public first-party detail page and apply URL', async () => {
  const marutAir = await loadMarutAirModule()
  const cards = marutAir.extractJobCards(jobsPageHtml)
  const fullStackDeveloper = marutAir.extractJobDetail(fullStackDeveloperDetailHtml, cards[0])

  assert.equal(fullStackDeveloper.title, 'Full Stack Developer')
  assert.equal(fullStackDeveloper.company, 'Marut Air')
  assert.equal(fullStackDeveloper.department, 'Research and development')
  assert.equal(fullStackDeveloper.location, 'Ahmedabad, India')
  assert.equal(fullStackDeveloper.city, 'Ahmedabad')
  assert.equal(fullStackDeveloper.country, 'India')
  assert.equal(fullStackDeveloper.jobId, '32')
  assert.equal(fullStackDeveloper.requisitionId, '32')
  assert.equal(fullStackDeveloper.sourceUrl, 'https://crm.marutair.com/jobs/full-stack-developer-32')
  assert.equal(fullStackDeveloper.applyUrl, 'https://crm.marutair.com/jobs/apply/full-stack-developer-32')
  assert.match(fullStackDeveloper.jobDescription, /scalable web applications/i)
})

test('run returns India jobs from the verified Marut Air jobs board and detail pages', async () => {
  const marutAir = await loadMarutAirModule()
  const requestedUrls = []

  const jobs = await marutAir.createMarutAirScraper({ maxJobs: 2 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === marutAir.BRAND_PAGE_URL) {
        return brandPageHtml
      }
      if (url === marutAir.JOBS_PAGE_URL) return jobsPageHtml
      if (url === 'https://crm.marutair.com/jobs/full-stack-developer-32') {
        return fullStackDeveloperDetailHtml
      }
      if (url === 'https://crm.marutair.com/jobs/hr-recruiter-35') return hrRecruiterDetailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-15T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    marutAir.BRAND_PAGE_URL,
    marutAir.JOBS_PAGE_URL,
    'https://crm.marutair.com/jobs/full-stack-developer-32',
    'https://crm.marutair.com/jobs/hr-recruiter-35',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'marutair')
  assert.equal(jobs[0].scrapedAt, '2026-08-15T00:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('run accepts the verified Marut Air brand-page challenge shell when the jobs board remains live', async () => {
  const marutAir = await loadMarutAirModule()
  const requestedUrls = []
  const requestedBrandFallbackUrls = []

  const jobs = await marutAir.createMarutAirScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === marutAir.BRAND_PAGE_URL) {
        const error = new Error(`HTTP 307 for ${url}`)
        error.status = 307
        throw error
      }

      if (url === marutAir.JOBS_PAGE_URL) return jobsPageHtml
      if (url === 'https://crm.marutair.com/jobs/full-stack-developer-32') {
        return fullStackDeveloperDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchBrandPageText: async (url) => {
      requestedBrandFallbackUrls.push(url)
      return brandPageChallengeHtml
    },
    now: () => '2026-08-17T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    marutAir.BRAND_PAGE_URL,
    marutAir.JOBS_PAGE_URL,
    'https://crm.marutair.com/jobs/full-stack-developer-32',
  ])
  assert.deepEqual(requestedBrandFallbackUrls, [marutAir.BRAND_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Full Stack Developer')
  assert.equal(jobs[0].scrapedAt, '2026-08-17T00:00:00.000Z')
})

test('run also accepts the wrapped retry error when the verified Marut Air brand page is challenge-gated', async () => {
  const marutAir = await loadMarutAirModule()
  const requestedBrandFallbackUrls = []

  const jobs = await marutAir.createMarutAirScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === marutAir.BRAND_PAGE_URL) {
        const cause = new Error(`HTTP 307 for ${url}`)
        cause.status = 307

        const error = new Error(`[marutair] All 3 attempts failed. Last error: HTTP 307 for ${url}`, { cause })
        error.abortRetries = true
        throw error
      }

      if (url === marutAir.JOBS_PAGE_URL) return jobsPageHtml
      if (url === 'https://crm.marutair.com/jobs/full-stack-developer-32') {
        return fullStackDeveloperDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchBrandPageText: async (url) => {
      requestedBrandFallbackUrls.push(url)
      return brandPageChallengeHtml
    },
    now: () => '2026-08-17T00:00:00.000Z',
  })

  assert.deepEqual(requestedBrandFallbackUrls, [marutAir.BRAND_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Full Stack Developer')
})

test('Marut Air fails closed when the verified jobs board drifts materially', async () => {
  const marutAir = await loadMarutAirModule()

  await assert.rejects(
    marutAir.createMarutAirScraper().run({
      fetchText: async (url) => {
        if (url === marutAir.BRAND_PAGE_URL) return brandPageHtml
        if (url === marutAir.JOBS_PAGE_URL) return '<html><body><h1>Jobs</h1><p>No public roles here.</p></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Marut Air jobs page/i,
  )
})

test('createMarutAirFetchText retries with the curl-style user agent after a transport timeout', async () => {
  const marutAir = await loadMarutAirModule()
  const requestedUserAgents = []

  const fetchText = marutAir.createMarutAirFetchText({
    fetchTextImpl: async (_url, options = {}) => {
      requestedUserAgents.push(options.headers?.['User-Agent'] ?? null)

      if (requestedUserAgents.length === 1) {
        throw new Error(
          'fetch failed | Connect Timeout Error (attempted address: marutair.com:443, timeout: 10000ms)',
        )
      }

      return brandPageHtml
    },
  })

  const html = await fetchText(marutAir.BRAND_PAGE_URL)

  assert.equal(html, brandPageHtml)
  assert.deepEqual(requestedUserAgents, [
    marutAir.PRIMARY_USER_AGENT,
    marutAir.FALLBACK_USER_AGENT,
  ])
})
