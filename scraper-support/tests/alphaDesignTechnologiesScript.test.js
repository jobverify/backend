import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About Alpha</a>
      <a href="/careers">Careers</a>
      <a href="/contact">Contact Us</a>
    </nav>
    <main>
      <h1>Home</h1>
      <p>
        Alpha Design Technologies Pvt Ltd., has been established with a view to put into action
        &quot; MAKE IN INDIA &quot; policy of the Government of India.
      </p>
      <p>Established in Bangalore during 2004.</p>
      <p>For General Enquiries : contact@adtl.co.in</p>
    </main>
    <footer>
      Copyright © 2025 ALPHA DESIGN TECHNOLOGIES PVT LTD All Rights Reserved.
    </footer>
  </body>
</html>
`

const careersResumeOnlyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | adtl</title>
  </head>
  <body>
    <nav>
      <a href="/careers">Careers</a>
      <a href="/contact">Contact Us</a>
    </nav>
    <main>
      <h1>Careers</h1>
      <p>
        At Alpha Design Technologies, we are dedicated to building a team that reflects the
        diversity and talent of our communities.
      </p>
      <p>
        To apply for any of the positions, please submit your resume to
        <a href="mailto:careers@adtl.co.in">careers@adtl.co.in</a>
      </p>
      <div>career-detail</div>
      <div>careers</div>
      <p>For General Enquiries : contact@adtl.co.in</p>
    </main>
    <footer>
      Copyright © 2025 ALPHA DESIGN TECHNOLOGIES PVT LTD All Rights Reserved.
    </footer>
  </body>
</html>
`

const missingCareerRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 - File or directory not found.</title>
  </head>
  <body>
    <h1>Server Error</h1>
    <h2>404 - File or directory not found.</h2>
    <p>
      The resource you are looking for might have been removed, had its name changed, or is
      temporarily unavailable.
    </p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | adtl</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="/jobs/senior-rf-engineer">Apply now</a>
  </body>
</html>
`

const loadAlphaDesignTechnologiesModule = async () => {
  try {
    return await import('../../scraper/alphadesigntechnologies/script.js')
  } catch {
    assert.fail('Expected Alpha Design Technologies scraper module at ../../scraper/alphadesigntechnologies/script.js')
  }
}

test('Alpha Design Technologies scraper constants stay pinned to the verified first-party resume-only careers surface from July 15, 2026', async () => {
  const alpha = await loadAlphaDesignTechnologiesModule()

  assert.equal(alpha.SOURCE, 'alphadesigntechnologies')
  assert.equal(alpha.COMPANY, 'Alpha Design Technologies')
  assert.equal(alpha.OFFICIAL_BRAND_NAME, 'Alpha Design Technologies Pvt Ltd')
  assert.equal(alpha.VERIFIED_ON, '2026-07-15')
  assert.equal(alpha.HOMEPAGE_URL, 'https://www.adtl.co.in/')
  assert.equal(alpha.CAREERS_URL, 'https://www.adtl.co.in/careers')
  assert.equal(alpha.APPLICATION_EMAIL, 'careers@adtl.co.in')
  assert.equal(alpha.APPLICATION_URL, 'mailto:careers@adtl.co.in')
  assert.deepEqual(alpha.NO_PUBLIC_CAREER_ROUTE_URLS, [
    'https://www.adtl.co.in/career',
    'https://www.adtl.co.in/jobs',
    'https://www.adtl.co.in/join-us',
    'https://www.adtl.co.in/openings',
    'https://www.adtl.co.in/work-with-us',
  ])
  assert.match(alpha.VERIFIED_SURFACE_SUMMARY, /resume-only/i)
  assert.match(alpha.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(alpha.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(alpha.hasOfficialCareersSignal(careersResumeOnlyHtml), true)
  assert.equal(alpha.pageExposesPublicJobListings(careersResumeOnlyHtml), false)
  assert.equal(alpha.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(
    alpha.isVerifiedMissingCareerRoute({
      status: 404,
      url: alpha.NO_PUBLIC_CAREER_ROUTE_URLS[0],
      html: missingCareerRouteHtml,
    }),
    true,
  )
})

test('Alpha Design Technologies returns no jobs only while the verified official careers page remains resume-only', async () => {
  const alpha = await loadAlphaDesignTechnologiesModule()
  const requestedUrls = []

  const jobs = await alpha.createAlphaDesignTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === alpha.HOMEPAGE_URL) {
        return {
          ok: true,
          status: 200,
          url,
          text: homepageHtml,
        }
      }

      if (url === alpha.CAREERS_URL) {
        return {
          ok: true,
          status: 200,
          url,
          text: careersResumeOnlyHtml,
        }
      }

      if (alpha.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
        return {
          ok: false,
          status: 404,
          url,
          text: missingCareerRouteHtml,
        }
      }

      throw new Error(`Unexpected Alpha Design Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    alpha.HOMEPAGE_URL,
    alpha.CAREERS_URL,
    ...alpha.NO_PUBLIC_CAREER_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Alpha Design Technologies fails closed when the homepage, careers page, or checked missing routes drift into a public jobs surface', async () => {
  const alpha = await loadAlphaDesignTechnologiesModule()

  await assert.rejects(
    alpha.createAlphaDesignTechnologiesScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === alpha.HOMEPAGE_URL
          ? '<html><head><title>Placeholder</title></head><body>Welcome</body></html>'
          : careersResumeOnlyHtml,
      }),
    }),
    /official Alpha Design Technologies homepage/i,
  )

  await assert.rejects(
    alpha.createAlphaDesignTechnologiesScraper().run({
      fetchPage: async (url) => ({
        ok: true,
        status: 200,
        url,
        text: url === alpha.HOMEPAGE_URL ? homepageHtml : publicJobsHtml,
      }),
    }),
    /public job listings|resume-only/i,
  )

  await assert.rejects(
    alpha.createAlphaDesignTechnologiesScraper().run({
      fetchPage: async (url) => {
        if (url === alpha.HOMEPAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: homepageHtml,
          }
        }

        if (url === alpha.CAREERS_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: careersResumeOnlyHtml,
          }
        }

        return {
          ok: true,
          status: 200,
          url,
          text: publicJobsHtml,
        }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})


const currentMissingCareerRouteHtml = '<html><head><title>404 Error Page</title></head><body><h2>404</h2><h4>We couldn\'t find the page</h4><a href="/">Go Back to Home Page</a></body></html>'

test('Alpha Design Technologies accepts its official custom missing-page redirect while checking resume-only careers', async () => {
  const alpha = await loadAlphaDesignTechnologiesModule()
  const jobs = await alpha.createAlphaDesignTechnologiesScraper().run({
    fetchPage: async (url) => ({
      ok: true, status: 200,
      url: [alpha.HOMEPAGE_URL, alpha.CAREERS_URL].includes(url) ? url : 'https://www.adtl.co.in/404error',
      text: url === alpha.HOMEPAGE_URL ? homepageHtml : url === alpha.CAREERS_URL ? careersResumeOnlyHtml : currentMissingCareerRouteHtml,
    }),
  })
  assert.deepEqual(jobs, [])
  assert.equal(alpha.isVerifiedMissingCareerRoute({ status: 200, url: 'https://unrelated.example/404error', text: currentMissingCareerRouteHtml }), false)
  assert.equal(alpha.isVerifiedMissingCareerRoute({ status: 200, url: 'https://www.adtl.co.in/404error', text: currentMissingCareerRouteHtml + publicJobsHtml }), false)
})
