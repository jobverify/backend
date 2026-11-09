import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Matrix Labs &#8211; Matrix Labs Pvt Ltd</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about-us/">About Us</a>
      <a href="/career/">Career</a>
      <a href="/contact/">Contact</a>
    </nav>
    <main>
      <h1>About Us</h1>
      <p>Matrix Labs Pvt Ltd, established in 2014 as a supplier of IVD kits and instruments.</p>
      <p>Our quality management system is ISO 13485:2016 certified.</p>
    </main>
  </body>
</html>
`

const careersResumeOnlyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>career &#8211; Matrix Labs</title>
  </head>
  <body>
    <nav>
      <a href="/career/">Career</a>
      <a href="/contact/">Contact</a>
    </nav>
    <main>
      <h2>Career Opportunities at Matrix Labs Pvt Ltd - Innovators in IVD Solutions</h2>
      <p>At Matrix Labs Pvt Ltd, we create a supportive workplace where you can grow.</p>
      <p>Share your resume with us at <a href="mailto:hr@matrixlabs.co.in">hr@matrixlabs.co.in</a></p>
      <h3>Our Strengths</h3>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found &#8211; Matrix Labs</title>
  </head>
  <body>
    <h1>Not Found</h1>
    <p>The page could not be found.</p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>career - Matrix Labs</title>
  </head>
  <body>
    <main>
      <h2>Current Openings</h2>
      <a href="/jobs/junior-qa-ra-specialist">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/matrixlabs/script.js')
  } catch {
    assert.fail('Expected Matrix Labs scraper module at ../../scraper/matrixlabs/script.js')
  }
}

test('Matrix Labs scraper constants stay pinned to the verified first-party resume-only careers surface from Monday, August 3, 2026', async () => {
  const matrixLabs = await loadModule()

  assert.equal(matrixLabs.SOURCE, 'matrixlabs')
  assert.equal(matrixLabs.COMPANY, 'Matrix Labs')
  assert.equal(matrixLabs.OFFICIAL_BRAND_NAME, 'Matrix Labs Pvt Ltd')
  assert.equal(matrixLabs.VERIFIED_ON, '2026-08-03')
  assert.equal(matrixLabs.HOMEPAGE_URL, 'https://matrixlabs.co.in/')
  assert.equal(matrixLabs.CAREERS_URL, 'https://matrixlabs.co.in/career/')
  assert.equal(matrixLabs.APPLICATION_EMAIL, 'hr@matrixlabs.co.in')
  assert.equal(matrixLabs.APPLICATION_URL, 'mailto:hr@matrixlabs.co.in')
  assert.deepEqual(matrixLabs.NO_PUBLIC_CAREER_ROUTE_URLS, [
    'https://matrixlabs.co.in/careers/',
    'https://matrixlabs.co.in/jobs/',
    'https://matrixlabs.co.in/join-us/',
  ])
  assert.match(matrixLabs.VERIFIED_SURFACE_SUMMARY, /resume-only/i)
  assert.match(matrixLabs.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(matrixLabs.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(matrixLabs.hasOfficialCareersSignal(careersResumeOnlyHtml), true)
  assert.equal(matrixLabs.pageExposesPublicJobListings(careersResumeOnlyHtml), false)
  assert.equal(matrixLabs.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(
    matrixLabs.isVerifiedMissingCareerRoute({
      status: 404,
      url: matrixLabs.NO_PUBLIC_CAREER_ROUTE_URLS[0],
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Matrix Labs returns no jobs only while the verified official careers page remains resume-only', async () => {
  const matrixLabs = await loadModule()
  const requestedUrls = []

  const jobs = await matrixLabs.createMatrixLabsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === matrixLabs.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === matrixLabs.CAREERS_URL) {
        return { status: 200, url, html: careersResumeOnlyHtml }
      }

      if (matrixLabs.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Matrix Labs URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    matrixLabs.HOMEPAGE_URL,
    matrixLabs.CAREERS_URL,
    ...matrixLabs.NO_PUBLIC_CAREER_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Matrix Labs fails closed when the homepage, careers page, or checked missing routes drift into a public jobs surface', async () => {
  const matrixLabs = await loadModule()

  await assert.rejects(
    matrixLabs.createMatrixLabsScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === matrixLabs.HOMEPAGE_URL
          ? '<html><body>Unexpected</body></html>'
          : careersResumeOnlyHtml,
      }),
    }),
    /official Matrix Labs homepage/i,
  )

  await assert.rejects(
    matrixLabs.createMatrixLabsScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: url === matrixLabs.HOMEPAGE_URL ? homepageHtml : publicJobsHtml,
      }),
    }),
    /public job listings|resume-only/i,
  )

  await assert.rejects(
    matrixLabs.createMatrixLabsScraper().run({
      fetchPage: async (url) => {
        if (url === matrixLabs.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === matrixLabs.CAREERS_URL) {
          return { status: 200, url, html: careersResumeOnlyHtml }
        }

        return { status: 200, url, html: publicJobsHtml }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
