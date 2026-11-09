import assert from 'node:assert/strict'
import test from 'node:test'

const loadGoibiboModule = async () => {
  try {
    return await import('../../scraper/goibibo/script.js')
  } catch {
    assert.fail('Expected Goibibo scraper module at ../../scraper/goibibo/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Goibibo - Best Travel Website. Book Hotels, Flights, Trains, Bus and Cabs with upto 50% off</title>
  </head>
  <body>
    <header>
      <a href="/">goibibo</a>
    </header>
    <main>
      <h1>Best Travel Website</h1>
      <p>Book Hotels, Flights, Trains, Bus and Cabs with upto 50% off.</p>
    </main>
    <footer>
      <a href="/careers/">Careers</a>
    </footer>
  </body>
</html>
`

const career404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>404</h1>
    <p>The requested URL was not found on this server.</p>
  </body>
</html>
`

const career503Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>503 Service Unavailable</title>
  </head>
  <body>
    <h1>Service Unavailable</h1>
    <p>Please try again later.</p>
  </body>
</html>
`

const career504Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>504 Gateway Timeout</title>
  </head>
  <body>
    <h1>Gateway Timeout</h1>
    <p>The upstream service timed out.</p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Goibibo Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <article data-job-id="goi-001">
      <h2>Software Engineer</h2>
      <a href="https://www.goibibo.com/careers/software-engineer">Apply now</a>
    </article>
  </body>
</html>
`

test('Goibibo sentinel constants stay pinned to the verified homepage and unavailable careers route', async () => {
  const goibibo = await loadGoibiboModule()

  assert.equal(goibibo.SOURCE, 'goibibo')
  assert.equal(goibibo.COMPANY, 'Goibibo')
  assert.equal(goibibo.VERIFIED_ON, '2026-08-07')
  assert.equal(goibibo.HOMEPAGE_URL, 'https://www.goibibo.com/')
  assert.equal(goibibo.CAREER_URL, 'https://www.goibibo.com/careers/')
  assert.deepEqual(goibibo.ACCEPTED_CAREER_PAGE_STATUSES, [404, 503, 504])

  assert.equal(goibibo.pageHasOfficialGoibiboSignals(homepageHtml), true)
  assert.equal(goibibo.extractCareerUrl(homepageHtml), goibibo.CAREER_URL)
  assert.equal(goibibo.hasPublicJobSignals(career404Html), false)
  assert.equal(goibibo.hasPublicJobSignals(career503Html), false)
  assert.equal(goibibo.hasPublicJobSignals(publicJobsHtml), true)
  assert.equal(
    goibibo.isVerifiedUnavailableCareerPage({
      status: 404,
      url: goibibo.CAREER_URL,
      html: career404Html,
    }),
    true,
  )
  assert.equal(
    goibibo.isVerifiedUnavailableCareerPage({
      status: 503,
      url: goibibo.CAREER_URL,
      html: career503Html,
    }),
    true,
  )
  assert.equal(
    goibibo.isVerifiedUnavailableCareerPage({
      status: 504,
      url: goibibo.CAREER_URL,
      html: career504Html,
    }),
    true,
  )
  assert.equal(
    goibibo.isVerifiedUnavailableCareerPage({
      status: 200,
      url: goibibo.CAREER_URL,
      html: publicJobsHtml,
    }),
    false,
  )
})

test('Goibibo sentinel returns [] only while the verified broken first-party careers handoff remains unchanged', async () => {
  const goibibo = await loadGoibiboModule()
  const requestedUrls = []

  const jobs = await goibibo.createGoibiboScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === goibibo.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === goibibo.CAREER_URL) {
        return { status: 503, url, html: career503Html }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [goibibo.HOMEPAGE_URL, goibibo.CAREER_URL])
  assert.deepEqual(jobs, [])
})

test('Goibibo sentinel tolerates a homepage timeout when the verified careers route still serves the known unavailable surface', async () => {
  const goibibo = await loadGoibiboModule()
  const requestedUrls = []

  const jobs = await goibibo.createGoibiboScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === goibibo.HOMEPAGE_URL) {
        const error = new Error('The operation was aborted due to timeout')
        error.name = 'TimeoutError'
        throw error
      }

      if (url === goibibo.CAREER_URL) {
        return { status: 503, url, html: career503Html }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [goibibo.HOMEPAGE_URL, goibibo.CAREER_URL])
  assert.deepEqual(jobs, [])
})

test('Goibibo sentinel fails closed when the homepage handoff drifts or the careers route starts serving public jobs', async () => {
  const goibibo = await loadGoibiboModule()

  await assert.rejects(
    goibibo.createGoibiboScraper().run({
      fetchPage: async (url) => {
        if (url === goibibo.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('/careers/', '/jobs/'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage no longer matches the verified careers handoff/i,
  )

  await assert.rejects(
    goibibo.createGoibiboScraper().run({
      fetchPage: async (url) => {
        if (url === goibibo.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === goibibo.CAREER_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers route no longer matches the verified unavailable surface/i,
  )
})
