import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  JOBS_URL,
  MISSING_ROUTE_URLS,
  SOURCE,
  createG10XScraper,
  extractJobs,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasOfficialJobsSignal,
  hasVerifiedCareersLink,
  hasVerifiedJobsLink,
  isVerifiedMissingRoute,
} from './script.js'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>G10X | End-to-end digital and AI solutions</title>
    <meta
      name="description"
      content="Driven by customer obsession, G10X partners with enterprises to enhance experiences, strengthen performance, and deliver reliable, long-term business value."
    />
  </head>
  <body>
    <nav>
      <a href="/who-we-are">Who we are</a>
      <a href="/careers">Careers</a>
    </nav>
    <section>
      <h1>End-to-end digital and AI solutions</h1>
      <p>
        Driven by Customer Obsession, G10X partners with enterprises to enhance experiences, strengthen performance,
        and deliver reliable, long-term business value.
      </p>
    </section>
    <footer>Copyright &copy; 2025 G10X | All rights reserved</footer>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <meta
      name="description"
      content="Join G10X, a Great Place to Work Certified company. Work on AI and digital transformation projects with global brands. Explore opportunities."
    />
  </head>
  <body>
    <section>
      <h1>Let's GROW together</h1>
      <p>We move fast, think bold, and never settle for ordinary.</p>
      <p>If you're ready to grow your skills, G10X is ready to grow with you.</p>
    </section>
    <section>
      <h2>Why G10X</h2>
      <h3>Grow with purpose</h3>
      <h3>Work with global brands</h3>
      <h2>Find your place at G10X</h2>
      <a href="/jobs">See job openings</a>
    </section>
  </body>
</html>
`

const JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs</title>
    <meta
      name="description"
      content="Explore opportunities that challenge you, support you, and help you build a career that lasts."
    />
  </head>
  <body>
    <section>
      <h1>Your career STARTS here</h1>
      <p>Explore opportunities that challenge you, support you, and help you build a career that lasts.</p>
      <div>0 Job Openings For You</div>
      <h2>Our job offerings</h2>
    </section>
    <nav>
      <a href="/careers">Careers</a>
      <a href="https://in.linkedin.com/company/g10xtech">LinkedIn</a>
    </nav>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>404 - Page not found</title>
    <meta content="The page you are looking for doesn't exist or has been moved." name="description" />
  </head>
  <body>
    <div class="utility-wrapper">
      <div class="utility-container">
        <div class="text-mono">404</div>
        <div class="utility-content">
          <h1>Page not found</h1>
          <p>The page you are looking for doesn't exist or has been moved.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('G10X recognizes the verified homepage, careers page, jobs page, and missing-route shell', () => {
  assert.equal(SOURCE, 'g10x')
  assert.equal(COMPANY, 'G10X')
  assert.equal(HOMEPAGE_URL, 'https://www.g10x.com/')
  assert.equal(CAREERS_URL, 'https://www.g10x.com/careers')
  assert.equal(JOBS_URL, 'https://www.g10x.com/jobs')
  assert.deepEqual(MISSING_ROUTE_URLS, [
    'https://www.g10x.com/career',
    'https://www.g10x.com/join-us',
    'https://www.g10x.com/current-openings',
    'https://www.g10x.com/openings',
    'https://www.g10x.com/work-with-us',
  ])
  assert.equal(hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(hasVerifiedCareersLink(HOMEPAGE_HTML), true)
  assert.equal(hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(hasVerifiedJobsLink(CAREERS_HTML), true)
  assert.equal(hasOfficialJobsSignal(JOBS_HTML), true)
  assert.equal(
    isVerifiedMissingRoute({
      status: 404,
      html: MISSING_ROUTE_HTML,
      url: MISSING_ROUTE_URLS[0],
    }),
    true,
  )
})

test('G10X returns no jobs only while the verified first-party jobs page still exposes a zero-opening state', () => {
  assert.deepEqual(extractJobs(JOBS_HTML), [])
})

test('G10X fails closed when the verified jobs page starts exposing openings or apply links', () => {
  assert.throws(
    () => extractJobs(JOBS_HTML.replace('0 Job Openings For You', '1 Job Opening For You')),
    /public openings changed materially/i,
  )

  assert.throws(
    () => extractJobs(
      JOBS_HTML.replace(
        '</nav>',
        '<a href="/jobs/senior-data-engineer">Senior Data Engineer</a></nav>',
      ),
    ),
    /public openings changed materially/i,
  )
})

test('G10X run() validates the verified public route chain and returns an empty list for the current zero-opening state', async () => {
  const requestedUrls = []

  const jobs = await createG10XScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
      if (url === CAREERS_URL) return { status: 200, url, html: CAREERS_HTML }
      if (url === JOBS_URL) return { status: 200, url, html: JOBS_HTML }
      if (MISSING_ROUTE_URLS.includes(url)) return { status: 404, url, html: MISSING_ROUTE_HTML }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    JOBS_URL,
    ...MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
