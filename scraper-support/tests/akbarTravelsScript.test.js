import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Akbar Travels - Best Travel Website. Book Flights, Hotels, Holidays & more</title>
    <link rel="canonical" href="https://www.akbartravels.com/in">
  </head>
  <body>
    <nav>Flights Hotel Visa Holidays Bus Cruise Car Forex Careers</nav>
    <main>
      <h1>Book Flight Tickets</h1>
      <p>Akbar Travels is one of the leading Travel agency for online travel booking in India.</p>
    </main>
    <footer>Copyright 2026 www.akbartravels.com All Rights Reserved.</footer>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Akbartravels -</title>
    <link rel="canonical" href="https://www.akbartravels.com/in/careers">
  </head>
  <body>
    <h1>Careers</h1>
    <p>Many Exciting job Opportunities</p>
    <h2>Careers@akbartravels</h2>
    <p>
      At Akbartravels.com, we are committed to attracting and retaining the best people in our field.
    </p>
    <p>
      For a job opportunity at Akbartravels.com, email your resume to
      <a class="main" href="mailto:hr@akbartravels.com">hr@akbartravels.com</a>.
      Please include the job designation in the subject line of the email.
    </p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Akbar Travels Jobs</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Travel Consultant"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.lever.co/akbartravels/apply">Apply now</a>
  </body>
</html>
`

const loadAkbarTravelsModule = async () => {
  try {
    return await import('../../scraper/akbartravels/script.js')
  } catch {
    assert.fail('Expected Akbar Travels scraper module at ../../scraper/akbartravels/script.js')
  }
}

test('known Akbar routes may redirect to the verified resume-only careers page', async () => {
  const akbar = await loadAkbarTravelsModule()
  const page = { status: 200, url: 'https://www.akbartravels.com/in/careers', html: careersPageHtml }
  assert.equal(akbar.isKnownMissingJobRoute(page, 'https://www.akbartravels.com/in/career'), true)
  assert.equal(akbar.isKnownMissingJobRoute(page, 'https://example.com/careers'), false)
  assert.equal(akbar.isKnownMissingJobRoute({ ...page, html: publicJobsHtml }, 'https://www.akbartravels.com/in/career'), false)
  assert.equal(akbar.isKnownMissingJobRoute({ ...page, html: '<h1>Careers</h1>' }, 'https://www.akbartravels.com/in/career'), false)
})

test('known localized Akbar routes may redirect to the branded WordPress error response', async () => {
  const akbar = await loadAkbarTravelsModule()
  const page = { status: 403, url: 'https://www.akbartravels.com/in/wordpress/jobs',
    html: '<title>Error - Akbar Travels</title><h1>Page not found</h1>' }
  assert.equal(akbar.isKnownMissingJobRoute(page, 'https://www.akbartravels.com/in/jobs'), true)
  assert.equal(akbar.isKnownMissingJobRoute({ ...page, html: publicJobsHtml }, 'https://www.akbartravels.com/in/jobs'), false)
  assert.equal(akbar.isKnownMissingJobRoute({ ...page, url: 'https://example.com/jobs' }, 'https://www.akbartravels.com/in/jobs'), false)
  assert.equal(akbar.isKnownMissingJobRoute({ ...page, html: '<title>Access denied</title>' }, 'https://www.akbartravels.com/in/jobs'), false)
})

test('Akbar Travels scraper constants stay pinned to the verified first-party careers copy and adjacent dead-end routes', async () => {
  const akbarTravels = await loadAkbarTravelsModule()

  assert.equal(akbarTravels.SOURCE, 'akbartravels')
  assert.equal(akbarTravels.COMPANY, 'Akbar Travels')
  assert.equal(akbarTravels.ROOT_URL, 'https://www.akbartravels.com/')
  assert.equal(akbarTravels.HOME_URL, 'https://www.akbartravels.com/in')
  assert.equal(akbarTravels.CAREERS_ROUTE_URL, 'https://www.akbartravels.com/careers')
  assert.equal(akbarTravels.LOCALIZED_CAREERS_URL, 'https://www.akbartravels.com/in/careers')
  assert.deepEqual(akbarTravels.ROOT_MISSING_JOB_ROUTE_URLS, [
    'https://www.akbartravels.com/career',
    'https://www.akbartravels.com/jobs',
    'https://www.akbartravels.com/join-us',
    'https://www.akbartravels.com/openings',
    'https://www.akbartravels.com/current-openings',
  ])
  assert.deepEqual(akbarTravels.LOCALIZED_MISSING_JOB_ROUTE_URLS, [
    'https://www.akbartravels.com/in/career',
    'https://www.akbartravels.com/in/jobs',
    'https://www.akbartravels.com/in/join-us',
    'https://www.akbartravels.com/in/openings',
  ])
  assert.equal(akbarTravels.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(akbarTravels.hasResumeOnlyCareersSignal(careersPageHtml), true)
  assert.equal(akbarTravels.hasPublicJobListingSignal(careersPageHtml), false)
  assert.equal(akbarTravels.hasPublicJobListingSignal(publicJobsHtml), true)
  assert.equal(
    akbarTravels.isKnownMissingJobRoute(
      {
        status: 403,
        url: 'https://www.akbartravels.com/Error/PageNotFound?aspxerrorpath=/jobs',
        html: '',
      },
      'https://www.akbartravels.com/jobs',
    ),
    true,
  )
  assert.equal(
    akbarTravels.isKnownMissingJobRoute(
      {
        status: 403,
        url: 'https://www.akbartravels.com/in/jobs',
        html: '',
      },
      'https://www.akbartravels.com/in/jobs',
    ),
    true,
  )
})

test('Akbar Travels returns no jobs only while the verified first-party careers page stays resume-only and adjacent routes stay missing', async () => {
  const akbarTravels = await loadAkbarTravelsModule()
  const requestedUrls = []

  const jobs = await akbarTravels.createAkbarTravelsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === akbarTravels.ROOT_URL) {
        return { status: 200, url: akbarTravels.HOME_URL, html: homepageHtml }
      }

      if (url === akbarTravels.CAREERS_ROUTE_URL) {
        return { status: 200, url: akbarTravels.LOCALIZED_CAREERS_URL, html: careersPageHtml }
      }

      if (akbarTravels.ROOT_MISSING_JOB_ROUTE_URLS.includes(url)) {
        const routePath = new URL(url).pathname
        return {
          status: 403,
          url: `https://www.akbartravels.com/Error/PageNotFound?aspxerrorpath=${routePath}`,
          html: '',
        }
      }

      if (akbarTravels.LOCALIZED_MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 403, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    akbarTravels.ROOT_URL,
    akbarTravels.CAREERS_ROUTE_URL,
    ...akbarTravels.ROOT_MISSING_JOB_ROUTE_URLS,
    ...akbarTravels.LOCALIZED_MISSING_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Akbar Travels fails closed when the homepage redirect, careers page, or adjacent missing routes drift', async () => {
  const akbarTravels = await loadAkbarTravelsModule()

  await assert.rejects(
    akbarTravels.createAkbarTravelsScraper().run({
      fetchPage: async (url) => {
        if (url === akbarTravels.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage redirect/i,
  )

  await assert.rejects(
    akbarTravels.createAkbarTravelsScraper().run({
      fetchPage: async (url) => {
        if (url === akbarTravels.ROOT_URL) {
          return { status: 200, url: akbarTravels.HOME_URL, html: homepageHtml }
        }

        if (url === akbarTravels.CAREERS_ROUTE_URL) {
          return { status: 200, url: akbarTravels.CAREERS_ROUTE_URL, html: careersPageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers route/i,
  )

  await assert.rejects(
    akbarTravels.createAkbarTravelsScraper().run({
      fetchPage: async (url) => {
        if (url === akbarTravels.ROOT_URL) {
          return { status: 200, url: akbarTravels.HOME_URL, html: homepageHtml }
        }

        if (url === akbarTravels.CAREERS_ROUTE_URL) {
          return { status: 200, url: akbarTravels.LOCALIZED_CAREERS_URL, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now appears to expose a public jobs board/i,
  )

  await assert.rejects(
    akbarTravels.createAkbarTravelsScraper().run({
      fetchPage: async (url) => {
        if (url === akbarTravels.ROOT_URL) {
          return { status: 200, url: akbarTravels.HOME_URL, html: homepageHtml }
        }

        if (url === akbarTravels.CAREERS_ROUTE_URL) {
          return { status: 200, url: akbarTravels.LOCALIZED_CAREERS_URL, html: careersPageHtml }
        }

        if (url === akbarTravels.ROOT_MISSING_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Open roles</body></html>' }
        }

        if (akbarTravels.ROOT_MISSING_JOB_ROUTE_URLS.slice(1).includes(url)) {
          const routePath = new URL(url).pathname
          return {
            status: 403,
            url: `https://www.akbartravels.com/Error/PageNotFound?aspxerrorpath=${routePath}`,
            html: '',
          }
        }

        if (akbarTravels.LOCALIZED_MISSING_JOB_ROUTE_URLS.includes(url)) {
          return { status: 403, url, html: '' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-job route changed/i,
  )
})


test('Akbar Travels recognizes same-route HTTP 404 responses without accepting new jobs or redirects', async () => {
  const source = await loadAkbarTravelsModule()
  const url = source.LOCALIZED_MISSING_JOB_ROUTE_URLS[0]
  assert.equal(source.isKnownMissingJobRoute({status:404,url,html:'<html>Not Found</html>'}, url), true)
  assert.equal(source.isKnownMissingJobRoute({status:404,url,html:publicJobsHtml}, url), false)
  assert.equal(source.isKnownMissingJobRoute({status:404,url:'https://unrelated.example/jobs',html:''}, url), false)
  assert.equal(source.isKnownMissingJobRoute({status:404,url,html:''}, 'https://www.akbartravels.com/unverified'), false)
})
