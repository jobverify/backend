import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLICATION_FORM_URL,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  VERIFIED_404_ROUTE_URLS,
  createDroomScraper,
  extractHomepageCareerUrl,
  extractJobCards,
  hasOfficialCareersPageSignal,
  hasOfficialHomepageSignal,
  hasSharedApplicationFormSignal,
  isMissingCareerRoute,
} from './script.js'

const legacyHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Droom: Automotive E-Commerce Platform to Buy and Sell Vehicles</title>
    <link rel="canonical" href="https://droom.in/">
  </head>
  <body>
    <a href="/career">Career</a>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Droom: Automotive E-Commerce Platform to Buy and Sell Vehicles</title>
    <link rel="canonical" href="https://droom.in">
  </head>
  <body>
    <a href="/career"><span class="icon-briefcase"></span></a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career</title>
    <link rel="canonical" href="https://droom.in/career">
  </head>
  <body>
    <nav>
      <a href="#careerAtDroom">Career</a>
      <a href="#jobsAtDroom">Jobs</a>
      <a href="#campushiring">Campus Hiring</a>
    </nav>
    <div id="jobsAtDroom" class="tab-pane fade">
      <h2 class="d-font-size-22">Now Hiring</h2>
      <div class="card d-border-gray-light">
        <div class="card-body">
          <h3 class="d-font-size-16 d-margin-top-10">Senior Backend Engineer</h3>
          <ul class="list-inline d-text-gray">
            <li><i class="career-pin"></i> <span>Gurgaon</span></li>
            <li><i class="career-xperience"></i> <span>5-8 Years</span></li>
            <li><i class="career-time"></i> <span>Full Time</span></li>
          </ul>
          <a href="#job-1">Read more</a>
        </div>
      </div>
      <div id="job-1" class="panel-collapse collapse in">
        <div class="panel-body d-font-size-12">
          <p>Build backend services for the marketplace.</p>
        </div>
        <p>Posted Date: July 10, 2026</p>
      </div>
    </div>
    <div class="career-form form-main" id="career-form">
      <h2>Apply at Droom</h2>
      <form action="https://droom.in/career" class="career_form" id="careerForm">
        <select id="career_position" name="career_position"></select>
      </form>
    </div>
  </body>
</html>
`

const missingRoutePage = {
  status: 404,
  url: 'https://droom.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Error 404</title>
        <script>window.__noise = "Now Hiring";</script>
      </head>
      <body>
        <h1>Error 404</h1>
        <p>Buy Automobile</p>
        <a href="https://droom.in/credit/apply-loan">Apply for a loan</a>
      </body>
    </html>
  `,
}

test('Droom homepage contract accepts both the legacy and current careers-link shapes', () => {
  assert.equal(SOURCE, 'droom')
  assert.equal(COMPANY, 'Droom')
  assert.equal(HOMEPAGE_URL, 'https://droom.in/')
  assert.equal(CAREERS_URL, 'https://droom.in/career')
  assert.equal(APPLICATION_FORM_URL, 'https://droom.in/career#career-form')
  assert.deepEqual(VERIFIED_404_ROUTE_URLS, [
    'https://droom.in/careers',
    'https://droom.in/jobs',
    'https://droom.in/join-us',
    'https://droom.in/openings',
  ])
  assert.equal(extractHomepageCareerUrl(legacyHomepageHtml), CAREERS_URL)
  assert.equal(extractHomepageCareerUrl(currentHomepageHtml), CAREERS_URL)
  assert.equal(extractHomepageCareerUrl('<html><body><a href="/about">About</a></body></html>'), null)
  assert.equal(hasOfficialHomepageSignal(legacyHomepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(currentHomepageHtml), true)
})

test('Droom careers contract recognizes the verified inline jobs surface and 404 routes', () => {
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasSharedApplicationFormSignal(careersHtml), true)
  assert.equal(extractJobCards(careersHtml).length, 1)
  assert.equal(isMissingCareerRoute(missingRoutePage), true)
})

test('Droom scraper returns normalized jobs from the verified first-party careers page', async () => {
  const jobs = await createDroomScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL) return { status: 200, url, html: currentHomepageHtml }
      if (url === CAREERS_URL) return { status: 200, url, html: careersHtml }
      if (VERIFIED_404_ROUTE_URLS.includes(url)) return { ...missingRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Backend Engineer')
  assert.equal(jobs[0].location, 'Gurgaon')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].postingDate, 'July 10, 2026')
  assert.equal(jobs[0].applyUrl, APPLICATION_FORM_URL)
})
