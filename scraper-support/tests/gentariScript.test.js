import assert from 'node:assert/strict'
import test from 'node:test'

const loadGentariModule = async () => {
  try {
    return await import('../../scraper/gentari/script.js')
  } catch {
    assert.fail('Expected Gentari scraper module at ../../scraper/gentari/script.js')
  }
}

const GLOBAL_HOMEPAGE_HTML = `
  <html>
    <head>
      <title>Gentari &#x2013; Putting Clean Energy into Action</title>
      <meta property="og:url" content="https://www.gentari.com">
    </head>
    <body>
      <nav>
        <a href="/about/overview">About</a>
        <a href="/careers">Careers</a>
        <a href="/contact">Contact</a>
      </nav>
      <main>
        <h1>Putting Clean Energy into Action</h1>
        <p>Gentari is a global clean energy company focusing on renewable energy, hydrogen and green mobility solutions.</p>
        <div>Take the next step - join a team of passionate Gentarians</div>
      </main>
    </body>
  </html>
`

const GLOBAL_CAREERS_HTML = `
  <html>
    <head>
      <title>Join Gentari: Exciting Career Opportunities Await</title>
      <link rel="canonical" href="https://www.gentari.com/careers">
    </head>
    <body>
      <main>
        <h1>Join Gentari</h1>
        <p>Discover exciting career opportunities at Gentari. Join our team and be part of our mission to revolutionise sustainable energy.</p>
        <div>We are seeking passionate talents to embark with us on the next wave of clean energy</div>
        <a href="https://www.linkedin.com/company/gentari/jobs/" target="_self">Browse career openings</a>
      </main>
    </body>
  </html>
`

const INDIA_HOMEPAGE_HTML = `
  <html>
    <head>
      <title>Gentari India: Powering a Sustainable Future</title>
      <meta property="og:url" content="https://www.gentari.in">
    </head>
    <body>
      <nav>
        <a href="/businesses/overview">Businesses</a>
        <a href="https://www.gentari.com/careers" target="_blank">Careers</a>
        <a href="/contact">Contact</a>
      </nav>
      <main>
        <h1>Powering a Sustainable Future</h1>
        <p>Explore Gentari India's renewable energy projects, green hydrogen initiatives, and mobility solutions.</p>
        <div>Take the next step - join a team of passionate Gentarians</div>
      </main>
    </body>
  </html>
`

const INDIA_CAREERS_NOT_FOUND_HTML = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Not Found</title>
      <link rel="canonical" href="https://www.gentari.com/404">
    </head>
    <body>
      <main>
        <h1>Not Found</h1>
        <img src="/images/404-page-not-found.webp" alt="">
      </main>
    </body>
  </html>
`

test('Gentari recognizes the verified global and India no-first-party-jobs surfaces', async () => {
  const gentari = await loadGentariModule()

  assert.equal(gentari.SOURCE, 'gentari')
  assert.equal(gentari.COMPANY, 'Gentari')
  assert.equal(gentari.HOMEPAGE_URL, 'https://www.gentari.com/')
  assert.equal(gentari.CAREERS_URL, 'https://www.gentari.com/careers')
  assert.equal(gentari.INDIA_HOMEPAGE_URL, 'https://www.gentari.in/')
  assert.equal(gentari.INDIA_CAREERS_URL, 'https://www.gentari.in/careers')
  assert.equal(gentari.LINKEDIN_JOBS_URL, 'https://www.linkedin.com/company/gentari/jobs/')
  assert.equal(gentari.hasOfficialHomepageSignal(GLOBAL_HOMEPAGE_HTML), true)
  assert.equal(gentari.hasOfficialCareersSignal(GLOBAL_CAREERS_HTML), true)
  assert.equal(gentari.hasTrustedLinkedInJobsHandoff(GLOBAL_CAREERS_HTML), true)
  assert.equal(gentari.hasOfficialIndiaHomepageSignal(INDIA_HOMEPAGE_HTML), true)
  assert.equal(
    gentari.isVerifiedIndiaCareersNotFoundRoute({
      status: 200,
      url: 'https://www.gentari.in/404',
      html: INDIA_CAREERS_NOT_FOUND_HTML,
    }),
    true,
  )
})

test('Gentari returns no jobs only while the verified LinkedIn handoff and India 404 route remain unchanged', async () => {
  const gentari = await loadGentariModule()
  const requestedUrls = []

  const jobs = await gentari.createGentariScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === gentari.HOMEPAGE_URL) {
        return { status: 200, url, html: GLOBAL_HOMEPAGE_HTML }
      }

      if (url === gentari.CAREERS_URL) {
        return { status: 200, url, html: GLOBAL_CAREERS_HTML }
      }

      if (url === gentari.INDIA_HOMEPAGE_URL) {
        return { status: 200, url, html: INDIA_HOMEPAGE_HTML }
      }

      if (url === gentari.INDIA_CAREERS_URL) {
        return {
          status: 200,
          url: 'https://www.gentari.in/404',
          html: INDIA_CAREERS_NOT_FOUND_HTML,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    gentari.HOMEPAGE_URL,
    gentari.CAREERS_URL,
    gentari.INDIA_HOMEPAGE_URL,
    gentari.INDIA_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Gentari fails closed when the verified careers surface drifts', async () => {
  const gentari = await loadGentariModule()

  await assert.rejects(
    gentari.createGentariScraper().run({
      fetchPage: async (url) => {
        if (url === gentari.HOMEPAGE_URL) return { status: 200, url, html: GLOBAL_HOMEPAGE_HTML }
        if (url === gentari.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: GLOBAL_CAREERS_HTML.replace(
              'https://www.linkedin.com/company/gentari/jobs/',
              'https://www.linkedin.com/company/gentari/',
            ),
          }
        }
        if (url === gentari.INDIA_HOMEPAGE_URL) return { status: 200, url, html: INDIA_HOMEPAGE_HTML }
        return {
          status: 200,
          url: 'https://www.gentari.in/404',
          html: INDIA_CAREERS_NOT_FOUND_HTML,
        }
      },
    }),
    /linkedin jobs handoff/i,
  )

  await assert.rejects(
    gentari.createGentariScraper().run({
      fetchPage: async (url) => {
        if (url === gentari.HOMEPAGE_URL) return { status: 200, url, html: GLOBAL_HOMEPAGE_HTML }
        if (url === gentari.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: GLOBAL_CAREERS_HTML.replace(
              '</body>',
              '<a href="https://www.gentari.com/jobs/clean-energy-analyst">Apply now</a></body>',
            ),
          }
        }
        if (url === gentari.INDIA_HOMEPAGE_URL) return { status: 200, url, html: INDIA_HOMEPAGE_HTML }
        return {
          status: 200,
          url: 'https://www.gentari.in/404',
          html: INDIA_CAREERS_NOT_FOUND_HTML,
        }
      },
    }),
    /public jobs surface|first-party jobs/i,
  )

  await assert.rejects(
    gentari.createGentariScraper().run({
      fetchPage: async (url) => {
        if (url === gentari.HOMEPAGE_URL) return { status: 200, url, html: GLOBAL_HOMEPAGE_HTML }
        if (url === gentari.CAREERS_URL) return { status: 200, url, html: GLOBAL_CAREERS_HTML }
        if (url === gentari.INDIA_HOMEPAGE_URL) return { status: 200, url, html: INDIA_HOMEPAGE_HTML }
        return {
          status: 200,
          url: gentari.INDIA_CAREERS_URL,
          html: '<html><body><h1>Careers</h1><a href="/jobs/project-manager">Apply now</a></body></html>',
        }
      },
    }),
    /india careers route/i,
  )
})
