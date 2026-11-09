import assert from 'node:assert/strict'
import test from 'node:test'

const loadHotfootModule = async () => {
  try {
    return await import('../../scraper/hotfoottechnology/script.js')
  } catch {
    assert.fail('Expected Hotfoot Technology scraper module at ../../scraper/hotfoottechnology/script.js')
  }
}

const jobsPageHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Job Openings - Hotfoot Technology Solutions</title>
    <meta name="description" content="Explore the Job Opportunities at Hotfoot. Join our Team of Talented Professionals and dive into the Dynamic World of Fintech Innovation." />
    <link rel="canonical" href="https://hotfoot.co.in/job-openings/" />
  </head>
  <body>
    <main>
      <h1>Job Openings</h1>
      <p>Explore Job Opportunities</p>
      <p>[awsmjobs]</p>
      <p>View Open Positions</p>
      <p>Game changers are welcome!</p>
      <p>careers@hotfoot.co.in</p>
    </main>
  </body>
</html>
`

const liveBoardHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Job Openings - Hotfoot Technology Solutions</title>
    <link rel="canonical" href="https://hotfoot.co.in/job-openings/" />
  </head>
  <body>
    <main>
      <h1>Job Openings</h1>
      <div class="awsm-job-listing-item">
        <a href="https://hotfoot.co.in/blog/job-openings/devops-engineer/">More Details</a>
      </div>
      <p>careers@hotfoot.co.in</p>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>Page not found - Hotfoot Technology Solutions</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <p>Return to home</p>
  </body>
</html>
`

const liveDetailHtml = `
<!doctype html>
<html lang="en-GB">
  <head>
    <title>DevOps Engineer - Hotfoot Technology Solutions</title>
    <link rel="canonical" href="https://hotfoot.co.in/blog/job-openings/devops-engineer/" />
  </head>
  <body>
    <article>
      <h1>DevOps Engineer</h1>
      <p>Job Category: DevOps</p>
      <p>Job Type: Full Time</p>
      <p>Job Location: Chennai</p>
      <h2>Apply for this position</h2>
    </article>
  </body>
</html>
`

test('Hotfoot Technology sentinel pins the verified placeholder jobs page and stale first-party routes', async () => {
  const hotfoot = await loadHotfootModule()

  assert.equal(hotfoot.SOURCE, 'hotfoottechnology')
  assert.equal(hotfoot.COMPANY, 'Hotfoot Technology')
  assert.equal(hotfoot.VERIFIED_ON, '2026-07-16')
  assert.equal(hotfoot.JOBS_PAGE_URL, 'https://hotfoot.co.in/job-openings/')
  assert.deepEqual(hotfoot.STALE_JOB_DETAIL_ROUTE_URLS, [
    'https://hotfoot.co.in/blog/job-openings/devops-engineer/',
    'https://hotfoot.co.in/blog/job-openings/senior-business-analyst/',
  ])
  assert.deepEqual(hotfoot.STALE_JOB_ARCHIVE_ROUTE_URLS, [
    'https://hotfoot.co.in/blog/category/job-openings/',
  ])

  assert.equal(hotfoot.hasOfficialJobsPageSignal(jobsPageHtml), true)
  assert.equal(hotfoot.hasRenderablePublicJobsSignal(jobsPageHtml), false)
  assert.equal(hotfoot.hasRenderablePublicJobsSignal(liveBoardHtml), true)
  assert.equal(
    hotfoot.isVerifiedMissingJobRoute({
      status: 404,
      url: hotfoot.STALE_JOB_DETAIL_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
  assert.equal(
    hotfoot.isVerifiedMissingJobRoute({
      status: 200,
      url: hotfoot.STALE_JOB_DETAIL_ROUTE_URLS[0],
      html: liveDetailHtml,
    }),
    false,
  )
})

test('Hotfoot Technology sentinel returns [] only while the verified placeholder page and stale routes remain unchanged', async () => {
  const hotfoot = await loadHotfootModule()
  const requestedUrls = []

  const jobs = await hotfoot.createHotfootTechnologyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === hotfoot.JOBS_PAGE_URL) {
        return { status: 200, url, html: jobsPageHtml }
      }

      if (
        hotfoot.STALE_JOB_DETAIL_ROUTE_URLS.includes(url)
        || hotfoot.STALE_JOB_ARCHIVE_ROUTE_URLS.includes(url)
      ) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    hotfoot.JOBS_PAGE_URL,
    ...hotfoot.STALE_JOB_DETAIL_ROUTE_URLS,
    ...hotfoot.STALE_JOB_ARCHIVE_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Hotfoot Technology sentinel fails closed when the placeholder page starts exposing live public jobs or stale routes come back', async () => {
  const hotfoot = await loadHotfootModule()

  await assert.rejects(
    hotfoot.createHotfootTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === hotfoot.JOBS_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /job openings page/i,
  )

  await assert.rejects(
    hotfoot.createHotfootTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === hotfoot.JOBS_PAGE_URL) {
          return { status: 200, url, html: liveBoardHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /job openings page now exposes a live public jobs surface/i,
  )

  await assert.rejects(
    hotfoot.createHotfootTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === hotfoot.JOBS_PAGE_URL) {
          return { status: 200, url, html: jobsPageHtml }
        }

        if (url === hotfoot.STALE_JOB_DETAIL_ROUTE_URLS[0]) {
          return { status: 200, url, html: liveDetailHtml }
        }

        if (
          hotfoot.STALE_JOB_DETAIL_ROUTE_URLS.slice(1).includes(url)
          || hotfoot.STALE_JOB_ARCHIVE_ROUTE_URLS.includes(url)
        ) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /stale first-party job route changed materially or now exposes public jobs/i,
  )
})
