import assert from 'node:assert/strict'
import test from 'node:test'

const loadBharatSerumsAndVaccinesModule = async () => {
  try {
    return await import('../../scraper/bharatserumsandvaccines/script.js')
  } catch {
    assert.fail('Expected Bharat Serums and Vaccines scraper module at ../../scraper/bharatserumsandvaccines/script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>BSV Group</title>
      <link rel="canonical" href="https://bsvgroup.com/">
    </head>
    <body>
      <main>
        <h1>BSV Group</h1>
        <p>BSV (A Mankind Group Company)</p>
        <a href="https://bsvgroup.com/life-at-bsv/">Life at BSV</a>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Work at BSV - BSV - A Mankind Group Company</title>
      <link rel="canonical" href="https://bsvgroup.com/work-at-bsv/">
    </head>
    <body>
      <h1>Work at BSV</h1>
      <p>BSV - A Mankind Group Company</p>
    </body>
  </html>
`

test('Bharat Serums and Vaccines recognizes the verified homepage, careers page, and missing jobs routes', async () => {
  const bsv = await loadBharatSerumsAndVaccinesModule()

  assert.equal(bsv.SOURCE, 'bharatserumsandvaccines')
  assert.equal(bsv.COMPANY, 'Bharat Serums and Vaccines')
  assert.equal(bsv.HOMEPAGE_URL, 'https://bsvgroup.com/')
  assert.equal(bsv.CAREERS_URL, 'https://bsvgroup.com/work-at-bsv/')
  assert.deepEqual(bsv.CHECKED_NO_JOBS_ROUTE_URLS, [
    'https://bsvgroup.com/careers',
    'https://bsvgroup.com/jobs',
    'https://bsvgroup.com/join-us',
    'https://bsvgroup.com/current-openings',
  ])
  assert.equal(bsv.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bsv.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(bsv.pageExposesPublicJobListings(careersHtml), false)
  assert.equal(bsv.isVerifiedMissingJobsRoute({ status: 404 }), true)
})

test('Bharat Serums and Vaccines returns no jobs only while the verified first-party careers surface remains nonlisting', async () => {
  const bsv = await loadBharatSerumsAndVaccinesModule()
  const requestedUrls = []

  const jobs = await bsv.createBharatSerumsAndVaccinesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === bsv.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === bsv.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: careersHtml,
        }
      }

      return {
        status: 404,
        url,
        html: '<html><body><h1>404</h1><p>Page not found</p></body></html>',
      }
    },
  })

  assert.deepEqual(
    requestedUrls,
    [bsv.HOMEPAGE_URL, bsv.CAREERS_URL, ...bsv.CHECKED_NO_JOBS_ROUTE_URLS],
  )
  assert.deepEqual(jobs, [])
})

test('Bharat Serums and Vaccines fails closed when the careers page starts exposing public jobs', async () => {
  const bsv = await loadBharatSerumsAndVaccinesModule()

  await assert.rejects(
    bsv.createBharatSerumsAndVaccinesScraper().run({
      fetchPage: async (url) => {
        if (url === bsv.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bsv.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace('</body>', '<a href="/jobs/qa-manager">Apply now</a></body>'),
          }
        }

        return {
          status: 404,
          url,
          html: '<html><body><h1>404</h1></body></html>',
        }
      },
    }),
    /official careers surface now exposes public job listings|public job listings/i,
  )
})
