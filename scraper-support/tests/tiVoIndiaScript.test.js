import assert from 'node:assert/strict'
import test from 'node:test'

const TIVO_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>With TiVo, the choice is always yours.</h1>
    <p>A smart TV Powered by TiVo gives you the power to choose what you want to watch.</p>
    <a href="https://www.xperi.com/careers/">Careers</a>
    <a href="https://www.xperi.com/company/">Company</a>
    <footer>&copy;2026 Xperi Inc. All Rights Reserved.</footer>
  </body>
</html>
`

const XPERI_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>Extraordinary opportunities await.</p>
    <p>Through our brands &#8211; DTS&#174;, HD Radio&#8482;, IMAX&#174; Enhanced and TiVo&#174;</p>
    <div>Search Jobs</div>
    <div>View Openings</div>
    <div>Life @ Xperi</div>
  </body>
</html>
`

const XPERI_LOCATIONS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <div>Filter by Country Australia China India Ireland Japan Mexico Poland Singapore South Korea Sweden Taiwan United Kingdom United States</div>
    <div>Xperi Bangalore</div>
    <div>Bangalore, India 560103</div>
    <div>Xperi Pune</div>
    <div>Pune, Maharashtra, India 411014</div>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.example.com/tivoindia/senior-platform-engineer">Senior Platform Engineer</a>
    <a href="https://jobs.example.com/tivoindia/senior-platform-engineer/apply">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tivoindia/script.js')
  } catch {
    assert.fail('Expected TiVo India scraper module at ../../scraper/tivoindia/script.js')
  }
}

test('TiVo India sentinel helpers stay pinned to the verified TiVo homepage and shared Xperi careers surfaces', async () => {
  const tivoIndia = await loadModule()

  assert.equal(tivoIndia.SOURCE, 'tivoindia')
  assert.equal(tivoIndia.COMPANY, 'TiVo India')
  assert.equal(tivoIndia.OFFICIAL_BRAND_NAME, 'TiVo')
  assert.equal(tivoIndia.VERIFIED_ON, '2026-07-17')
  assert.equal(tivoIndia.BRAND_HOMEPAGE_URL, 'https://www.tivo.com/')
  assert.equal(tivoIndia.SHARED_CAREERS_URL, 'https://xperi.com/careers/')
  assert.equal(tivoIndia.LOCATIONS_URL, 'https://xperi.com/company/locations/')
  assert.match(tivoIndia.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(tivoIndia.hasOfficialTiVoHomepageSignal(TIVO_HOMEPAGE_HTML), true)
  assert.equal(tivoIndia.hasSharedXperiCareersSignal(XPERI_CAREERS_HTML), true)
  assert.equal(tivoIndia.hasIndiaLocationsSignal(XPERI_LOCATIONS_HTML), true)
  assert.equal(tivoIndia.pageExposesPublicJobListings(TIVO_HOMEPAGE_HTML), false)
  assert.equal(tivoIndia.pageExposesPublicJobListings(XPERI_CAREERS_HTML), false)
  assert.equal(tivoIndia.pageExposesPublicJobListings(XPERI_LOCATIONS_HTML), false)
  assert.equal(tivoIndia.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
})

test('TiVo India returns [] only while the verified TiVo-to-Xperi sentinel surface stays intact', async () => {
  const tivoIndia = await loadModule()
  const requestedUrls = []

  const jobs = await tivoIndia.createTiVoIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === tivoIndia.BRAND_HOMEPAGE_URL) {
        return { status: 200, url, html: TIVO_HOMEPAGE_HTML }
      }

      if (url === tivoIndia.SHARED_CAREERS_URL) {
        return { status: 200, url, html: XPERI_CAREERS_HTML }
      }

      if (url === tivoIndia.LOCATIONS_URL) {
        return { status: 200, url, html: XPERI_LOCATIONS_HTML }
      }

      throw new Error(`Unexpected TiVo India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    tivoIndia.BRAND_HOMEPAGE_URL,
    tivoIndia.SHARED_CAREERS_URL,
    tivoIndia.LOCATIONS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('TiVo India fails closed when the verified TiVo or shared Xperi surfaces drift into a public jobs board', async () => {
  const tivoIndia = await loadModule()

  await assert.rejects(
    tivoIndia.createTiVoIndiaScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected</h1></body></html>',
      }),
    }),
    /verified TiVo homepage|shared Xperi careers|India locations/i,
  )

  await assert.rejects(
    tivoIndia.createTiVoIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === tivoIndia.BRAND_HOMEPAGE_URL) {
          return { status: 200, url, html: TIVO_HOMEPAGE_HTML }
        }

        return { status: 200, url, html: PUBLIC_JOBS_HTML }
      },
    }),
    /appears to expose public jobs|no longer matches the verified/i,
  )
})
