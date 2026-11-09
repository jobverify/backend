import assert from 'node:assert/strict'
import test from 'node:test'

const loadMudrexModule = async () => {
  try {
    return await import('../../scraper/mudrex/script.js')
  } catch {
    assert.fail('Expected Mudrex scraper module at ../../scraper/mudrex/script.js')
  }
}

const officialAboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://mudrex.com/about-us" />
    <title>About Mudrex</title>
  </head>
  <body>
    <section>
      <h2>Join our growing team</h2>
      <p>We're putting together a team of stellar individuals.</p>
      <a href="https://mudrex.careers-page.com/">View open roles</a>
    </section>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:site_name" content="Manatal" />
    <title>Jobs at Mudrex</title>
  </head>
  <body>
    <section id="company-banner">
      <h3>UNLEASH YOUR POTENTIAL</h3>
      <p>Ready to Build the Future of Crypto? Your Opportunity Starts Here.</p>
    </section>
    <main id="page-content">
      <h4>Jobs at Mudrex</h4>
      <article class="job-card">
        <a
          href="/jobs/19f745ba-cedd-4784-9469-ce1a25380822"
          class="job-title-link"
          data-job-id="19f745ba-cedd-4784-9469-ce1a25380822"
          data-job-title="Forward Deployed Engineer"
        >
          <h6>Forward Deployed Engineer</h6>
        </a>
        <a class="btn btn-primary" href="jobs/19f745ba-cedd-4784-9469-ce1a25380822/apply" data-type="apply">Apply now</a>
        <ul aria-label="Job details">
          <li>Bangalore, Karnataka, India</li>
        </ul>
      </article>
      <article class="job-card">
        <a
          href="/jobs/10ddbf5a-4d2e-48b3-bb38-d928e484766d"
          class="job-title-link"
          data-job-id="10ddbf5a-4d2e-48b3-bb38-d928e484766d"
          data-job-title="Customer Success Executive"
        >
          <h6>Customer Success Executive</h6>
        </a>
        <a class="btn btn-primary" href="jobs/10ddbf5a-4d2e-48b3-bb38-d928e484766d/apply" data-type="apply">Apply now</a>
        <ul aria-label="Job details">
          <li>Bangalore, Karnataka, India</li>
        </ul>
      </article>
    </main>
    <footer>Powered by <a href="https://www.manatal.com">Manatal</a></footer>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main id="page-content">
      <div class="single-job-content">
        <div class="single-job-header-row mb-0">
          <h4 class="single-job-title">Forward Deployed Engineer</h4>
        </div>
        <div class="job-location mt-4">
          <ul class="text-quarterary list-unstyled">
            <li>Bangalore, Karnataka, India</li>
            <li>Full-Time</li>
            <li>On-Site</li>
          </ul>
          <a class="btn btn-primary d-block" href="../../scraper/jobs/19f745ba-cedd-4784-9469-ce1a25380822/apply">Apply now</a>
        </div>
        <div class="job-post-description">
          <p>Own technical onboarding from first API call to production go-live.</p>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('Mudrex verifies the first-party about page plus the linked public Manatal board surface', async () => {
  const mudrex = await loadMudrexModule()

  assert.equal(mudrex.ABOUT_URL, 'https://mudrex.com/about-us')
  assert.equal(mudrex.CAREERS_BOARD_URL, 'https://mudrex.careers-page.com/')
  assert.equal(mudrex.hasOfficialAboutPageSignal(officialAboutHtml), true)
  assert.equal(mudrex.hasOfficialBoardSignal(boardHtml), true)
})

test('Mudrex extracts public India jobs from the board and detail pages', async () => {
  const mudrex = await loadMudrexModule()
  const requestedUrls = []

  assert.equal(mudrex.extractListings(boardHtml).length, 2)

  const jobs = await mudrex.createMudrexScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mudrex.ABOUT_URL) return officialAboutHtml
      if (url === mudrex.CAREERS_BOARD_URL) return boardHtml
      if (url === 'https://mudrex.careers-page.com/jobs/19f745ba-cedd-4784-9469-ce1a25380822') {
        return detailHtml
      }
      throw new Error(`Unexpected Mudrex fixture URL: ${url}`)
    },
    now: () => '2026-07-25T10:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    mudrex.ABOUT_URL,
    mudrex.CAREERS_BOARD_URL,
    'https://mudrex.careers-page.com/jobs/19f745ba-cedd-4784-9469-ce1a25380822',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Forward Deployed Engineer')
  assert.equal(jobs[0].location, 'Bangalore, Karnataka, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].remoteStatus, 'On-site')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].source, 'mudrex')
  assert.equal(jobs[0].scrapedAt, '2026-07-25T10:30:00.000Z')
})

test('Mudrex falls back to the board listing when a detail page transiently rate-limits', async () => {
  const mudrex = await loadMudrexModule()

  const jobs = await mudrex.createMudrexScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === mudrex.ABOUT_URL) return officialAboutHtml
      if (url === mudrex.CAREERS_BOARD_URL) return boardHtml
      if (url === 'https://mudrex.careers-page.com/jobs/19f745ba-cedd-4784-9469-ce1a25380822') {
        throw new Error('HTTP 429 for https://mudrex.careers-page.com/jobs/19f745ba-cedd-4784-9469-ce1a25380822')
      }
      throw new Error(`Unexpected Mudrex fixture URL: ${url}`)
    },
    now: () => '2026-07-25T10:30:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Forward Deployed Engineer')
  assert.equal(jobs[0].location, 'Bangalore, Karnataka, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.equal(jobs[0].source, 'mudrex')
})

test('Mudrex detail fallback cannot turn caller cancellation into a successful listing', async () => {
  const mudrex = await loadMudrexModule(), controller = new AbortController()
  const reason = Object.freeze(Error('caller cancelled Mudrex detail'))
  await assert.rejects(mudrex.createMudrexScraper({ maxJobs: 1 }).run({
    signal: controller.signal,
    fetchText: async url => {
      if (url === mudrex.ABOUT_URL) return officialAboutHtml
      if (url === mudrex.CAREERS_BOARD_URL) return boardHtml
      controller.abort(reason)
      throw reason
    },
  }), error => error === reason)
})
