import assert from 'node:assert/strict'
import test from 'node:test'

const ubsUsHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our financial services in the United States of America | UBS United States of America</title>
  </head>
  <body>
    <a aria-label="UBS home">UBS home</a>
    <div>Credit Suisse Individuals</div>
    <a href="https://www.ubs.com/global/en/careers.html">Careers</a>
    <div>Careers at UBS</div>
    <h1>UBS United States of America</h1>
  </body>
</html>
`

const currentUbsUsHomepageHtml = ubsUsHomepageHtml
  .replaceAll('UBS United States of America', 'UBS United States')

const ubsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | UBS Global</title>
    <link rel="canonical" href="https://www.ubs.com/global/en/careers.html" />
  </head>
  <body>
    <h1>You’ve got what it takes. We’ll take you further.</h1>
    <h2>A career at UBS</h2>
    <a href="https://www.ubs.com/global/en/careers/search-jobs.html">Search and apply</a>
  </body>
</html>
`

const ubsSearchJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search jobs | UBS Global</title>
  </head>
  <body>
    <h1>Search jobs</h1>
    <p>Looking for a change? Explore your next big move and search our global job board.</p>
    <a href="https://jobs.ubs.com/TGnewUI/Search/Home/Home?partnerid=25008&siteid=5012">Professionals</a>
    <a href="https://jobs.ubs.com/TGnewUI/Search/Home/Home?partnerid=25008&siteid=5012">Students and graduates</a>
    <a href="https://jobs.ubs.com/TGnewUI/Search/Home/Home?partnerid=25008&siteid=5012">Swiss pupils</a>
  </body>
</html>
`

const loadCreditSuisseModule = async () => {
  try {
    return await import('../../scraper/creditsuisse/script.js')
  } catch {
    assert.fail('Expected Credit Suisse scraper module at ../../scraper/creditsuisse/script.js')
  }
}

test('Credit Suisse sentinel pins the verified legacy-to-UBS handoff surfaces', async () => {
  const creditSuisse = await loadCreditSuisseModule()

  assert.equal(creditSuisse.SOURCE, 'creditsuisse')
  assert.equal(creditSuisse.COMPANY, 'Credit Suisse')
  assert.equal(creditSuisse.LEGACY_HOMEPAGE_URL, 'https://www.credit-suisse.com/us/en.html')
  assert.equal(creditSuisse.LEGACY_CAREERS_URL, 'https://www.credit-suisse.com/careers/en.html')
  assert.equal(creditSuisse.UBS_HOMEPAGE_URL, 'https://www.ubs.com/us/en.html')
  assert.equal(creditSuisse.UBS_CAREERS_URL, 'https://www.ubs.com/global/en/careers.html')
  assert.equal(
    creditSuisse.UBS_SEARCH_JOBS_URL,
    'https://www.ubs.com/global/en/careers/search-jobs.html',
  )
  assert.equal(creditSuisse.UBS_JOBS_BOARD_HOST, 'https://jobs.ubs.com')

  assert.equal(creditSuisse.hasUbsHomepageSignal(ubsUsHomepageHtml), true)
  assert.equal(creditSuisse.hasUbsHomepageSignal(currentUbsUsHomepageHtml), true)
  assert.equal(creditSuisse.hasUbsCareersSignal(ubsCareersHtml), true)
  assert.equal(creditSuisse.hasUbsSearchJobsSignal(ubsSearchJobsHtml), true)

  assert.equal(
    creditSuisse.isVerifiedLegacyHomepageRedirect({
      status: 200,
      url: creditSuisse.UBS_HOMEPAGE_URL,
      html: ubsUsHomepageHtml,
    }),
    true,
  )
  assert.equal(
    creditSuisse.isVerifiedLegacyCareersRedirect({
      status: 200,
      url: creditSuisse.UBS_CAREERS_URL,
      html: ubsCareersHtml,
    }),
    true,
  )
  assert.equal(
    creditSuisse.isVerifiedUbsSearchJobsSurface({
      status: 200,
      url: creditSuisse.UBS_SEARCH_JOBS_URL,
      html: ubsSearchJobsHtml,
    }),
    true,
  )
})

test('Credit Suisse run returns no jobs only while the verified legacy surface continues handing off to UBS careers', async () => {
  const creditSuisse = await loadCreditSuisseModule()
  const requestedUrls = []

  const jobs = await creditSuisse.createCreditSuisseScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === creditSuisse.LEGACY_HOMEPAGE_URL) {
        return {
          status: 200,
          url: creditSuisse.UBS_HOMEPAGE_URL,
          html: ubsUsHomepageHtml,
        }
      }

      if (url === creditSuisse.LEGACY_CAREERS_URL) {
        return {
          status: 200,
          url: creditSuisse.UBS_CAREERS_URL,
          html: ubsCareersHtml,
        }
      }

      if (url === creditSuisse.UBS_SEARCH_JOBS_URL) {
        return {
          status: 200,
          url,
          html: ubsSearchJobsHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    creditSuisse.LEGACY_HOMEPAGE_URL,
    creditSuisse.LEGACY_CAREERS_URL,
    creditSuisse.UBS_SEARCH_JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Credit Suisse run fails closed when the verified UBS handoff changes materially', async () => {
  const creditSuisse = await loadCreditSuisseModule()

  await assert.rejects(
    creditSuisse.createCreditSuisseScraper().run({
      fetchPage: async (url) => {
        if (url === creditSuisse.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Credit Suisse Careers</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy homepage no longer matches the verified UBS handoff surface/i,
  )

  await assert.rejects(
    creditSuisse.createCreditSuisseScraper().run({
      fetchPage: async (url) => {
        if (url === creditSuisse.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: creditSuisse.UBS_HOMEPAGE_URL,
            html: ubsUsHomepageHtml,
          }
        }

        if (url === creditSuisse.LEGACY_CAREERS_URL) {
          return {
            status: 200,
            url: creditSuisse.UBS_CAREERS_URL,
            html: '<html><body><h1>Careers</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy careers page no longer matches the verified UBS careers redirect/i,
  )

  await assert.rejects(
    creditSuisse.createCreditSuisseScraper().run({
      fetchPage: async (url) => {
        if (url === creditSuisse.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: creditSuisse.UBS_HOMEPAGE_URL,
            html: ubsUsHomepageHtml,
          }
        }

        if (url === creditSuisse.LEGACY_CAREERS_URL) {
          return {
            status: 200,
            url: creditSuisse.UBS_CAREERS_URL,
            html: ubsCareersHtml,
          }
        }

        if (url === creditSuisse.UBS_SEARCH_JOBS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Search jobs</h1><p>Temporary maintenance window.</p></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /UBS search jobs handoff no longer matches the verified official surface/i,
  )
})
