import assert from 'node:assert/strict'
import test from 'node:test'

const CULTURE_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sona Comstar - Our Culture</title>
  </head>
  <body>
    <main>
      <h2>Sona Comstar Team Spirit.</h2>
      <h3>Life @Sona Comstar</h3>
      <p>
        We are an innovation led, product-centric company. Our culture revolves around making newer,
        better and more economical systems and components.
      </p>
      <h2>Explore a career with <b>sona comstar</b>.</h2>
      <a href="/career" class="btn-curve btn-lit"><span>Join Us</span></a>
    </main>
  </body>
</html>
`

const ABOUT_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sona Comstar - India's leading Auto Components Manufacturer</title>
  </head>
  <body>
    <footer>
      <p>Sona BLW Precision Forgings Limited</p>
      <p>CIN: L27300HR1995PLC083037</p>
      <p>Email : enquiry@sonacomstar.com</p>
      <a href="https://sonacomstar.com/files/policy/Cautionary_Notice_Against_Fake_Employment_Offers_etc.pdf">
        Cautionary Notice against fake employment or offers etc.
      </a>
    </footer>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"EV Engineer"}
    </script>
    <a href="https://jobs.example.com/sona/ev-engineer">Apply now</a>
  </body>
</html>
`

const TIMEOUT_ERROR = Object.assign(new TypeError('fetch failed'), {
  cause: {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: 'Connect Timeout Error',
  },
})

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sonablwprecision/script.js')
  } catch {
    assert.fail('Expected Sona BLW Precision scraper module at ../../scraper/sonablwprecision/script.js')
  }
}

test('Sona BLW Precision helpers stay pinned to the verified culture page, linked 404 route, and legal-entity footer', async () => {
  const sonaBlwPrecision = await loadScriptModule()

  assert.equal(sonaBlwPrecision.SOURCE, 'sonablwprecision')
  assert.equal(sonaBlwPrecision.COMPANY_NAME, 'Sona BLW Precision')
  assert.equal(
    sonaBlwPrecision.OFFICIAL_BRAND_NAME,
    'Sona BLW Precision Forgings Limited (Sona Comstar)',
  )
  assert.equal(sonaBlwPrecision.VERIFIED_ON, '2026-07-26')
  assert.equal(sonaBlwPrecision.CAREER_PAGE_URL, 'https://sonacomstar.com/our-culture')
  assert.equal(sonaBlwPrecision.ABOUT_PAGE_URL, 'https://sonacomstar.com/pages/about-us')
  assert.equal(sonaBlwPrecision.CULTURE_PAGE_URL, 'https://sonacomstar.com/our-culture')
  assert.equal(sonaBlwPrecision.LINKED_CAREER_ROUTE_URL, 'https://sonacomstar.com/career')
  assert.equal(
    sonaBlwPrecision.CAUTION_NOTICE_URL,
    'https://sonacomstar.com/files/policy/Cautionary_Notice_Against_Fake_Employment_Offers_etc.pdf',
  )
  assert.equal(sonaBlwPrecision.hasOfficialCareerPageSignal(CULTURE_PAGE_HTML), true)
  assert.equal(sonaBlwPrecision.hasOfficialAboutPageSignal(ABOUT_PAGE_HTML), true)
  assert.equal(
    sonaBlwPrecision.extractCareerRouteUrl(CULTURE_PAGE_HTML),
    'https://sonacomstar.com/career',
  )
  assert.equal(
    sonaBlwPrecision.extractCautionNoticeUrl(ABOUT_PAGE_HTML),
    'https://sonacomstar.com/files/policy/Cautionary_Notice_Against_Fake_Employment_Offers_etc.pdf',
  )
  assert.equal(
    sonaBlwPrecision.isVerifiedCareerRoute404Error(
      new Error(`HTTP 404 for ${sonaBlwPrecision.LINKED_CAREER_ROUTE_URL}`),
    ),
    true,
  )
  assert.equal(sonaBlwPrecision.pageExposesPublicJobListings(CULTURE_PAGE_HTML), false)
  assert.equal(sonaBlwPrecision.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(sonaBlwPrecision.isExpectedTimeoutError(TIMEOUT_ERROR), true)
})

test('Sona BLW Precision returns [] while the verified culture page still points to a broken /career route and no public jobs', async () => {
  const sonaBlwPrecision = await loadScriptModule()
  const requestedUrls = []

  const jobs = await sonaBlwPrecision.createSonaBlwPrecisionScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sonaBlwPrecision.CAREER_PAGE_URL) return CULTURE_PAGE_HTML
      if (url === sonaBlwPrecision.LINKED_CAREER_ROUTE_URL) {
        throw new Error(`HTTP 404 for ${url}`)
      }
      if (url === sonaBlwPrecision.ABOUT_PAGE_URL) return ABOUT_PAGE_HTML
      throw new Error(`Unexpected Sona BLW Precision URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sonaBlwPrecision.CAREER_PAGE_URL,
    sonaBlwPrecision.LINKED_CAREER_ROUTE_URL,
    sonaBlwPrecision.ABOUT_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Sona BLW Precision also returns [] on the verified timeout path and fails closed if public jobs or a live /career route appear', async () => {
  const sonaBlwPrecision = await loadScriptModule()

  const jobs = await sonaBlwPrecision.createSonaBlwPrecisionScraper().run({
    fetchText: async () => {
      throw TIMEOUT_ERROR
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    sonaBlwPrecision.createSonaBlwPrecisionScraper().run({
      fetchText: async (url) => {
        if (url === sonaBlwPrecision.CAREER_PAGE_URL) return PUBLIC_JOBS_HTML
        throw new Error(`Unexpected Sona BLW Precision URL: ${url}`)
      },
    }),
    /culture page now appears to expose public jobs/i,
  )

  await assert.rejects(
    sonaBlwPrecision.createSonaBlwPrecisionScraper().run({
      fetchText: async (url) => {
        if (url === sonaBlwPrecision.CAREER_PAGE_URL) return CULTURE_PAGE_HTML
        if (url === sonaBlwPrecision.LINKED_CAREER_ROUTE_URL) {
          return '<html><head><title>Careers</title></head><body><h1>Careers</h1></body></html>'
        }
        throw new Error(`Unexpected Sona BLW Precision URL: ${url}`)
      },
    }),
    /linked \/career route no longer matches the verified public 404 surface/i,
  )
})
