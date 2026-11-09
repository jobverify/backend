import assert from 'node:assert/strict'
import test from 'node:test'

const loadSundaramClaytonModule = async () => {
  try {
    return await import('../../scraper/sundaramclayton/script.js')
  } catch {
    assert.fail('Expected Sundaram Clayton scraper module at ../../scraper/sundaramclayton/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Profile</title>
    <meta
      name="Description"
      content="TVS Holdings Limited (Formerly known as Sundaram Clayton Limited)"
    />
  </head>
  <body>
    <div class="logo">
      <b>TVS Holdings Limited</b>
    </div>
    <p>TVS Holdings Limited (formerly Sundaram-Clayton Limited)</p>
    <a href="Profile.htm">Home</a>
    <a href="Reports.htm">Investors</a>
    <a href="Contact.htm">Contact us</a>
  </body>
</html>
`

test('Sundaram Clayton accepts the renamed official TVS Holdings homepage signal', async () => {
  const sundaramClayton = await loadSundaramClaytonModule()

  assert.equal(sundaramClayton.HOMEPAGE_URL, 'https://www.tvsholdings.com/')
  assert.equal(sundaramClayton.CAREERS_PAGE_URL, 'https://www.tvsholdings.com/careers/')
  assert.equal(sundaramClayton.CAREER_PAGE_URL, 'https://www.tvsholdings.com/career/')
  assert.equal(sundaramClayton.JOBS_PAGE_URL, 'https://www.tvsholdings.com/jobs/')
  assert.equal(sundaramClayton.hasOfficialSiteSignal(homepageHtml), true)
  assert.equal(sundaramClayton.hasMissingCareersRouteSignal({ status: 404 }), true)
})

test('run returns no jobs when the verified TVS Holdings site exposes no public careers routes', async () => {
  const sundaramClayton = await loadSundaramClaytonModule()
  const requestedUrls = []

  const jobs = await sundaramClayton.createSundaramClaytonScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sundaramClayton.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (
        url === sundaramClayton.CAREERS_PAGE_URL
        || url === sundaramClayton.CAREER_PAGE_URL
        || url === sundaramClayton.JOBS_PAGE_URL
      ) {
        return { status: 404, url, html: '' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sundaramClayton.HOMEPAGE_URL,
    sundaramClayton.CAREERS_PAGE_URL,
    sundaramClayton.CAREER_PAGE_URL,
    sundaramClayton.JOBS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})
