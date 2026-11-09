import assert from 'node:assert/strict'
import test from 'node:test'

const BRAND_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Reliance Retail</title>
  </head>
  <body>
    <section class="page-title">
      <h2 class="text-uppercase">Reliance SMART</h2>
    </section>
    <section id="breadcrumb">
      <ol class="breadcrumb">
        <li><a href="index.html">Home</a></li>
        <li><a href="#">Our Brands</a></li>
        <li class="active">Reliance Smart</li>
      </ol>
    </section>
    <section id="page-content">
      <p>Reliance SMART is one of the largest & fastest growing Grocery retail chains in India.</p>
      <p>Synonymous to its name, SMART is a new age supermarket serving the needs of today’s smart and value seeking customers.</p>
      <p><strong>Smart Point</strong> is a neighbourhood small format store of Reliance Retail.</p>
    </section>
  </body>
</html>
`

const MISSING_ROUTE_HTML = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"/>
<title>404 - File or directory not found.</title>
</head>
<body>
<div id="header"><h1>Server Error</h1></div>
<div id="content">
 <div class="content-container"><fieldset>
  <h2>404 - File or directory not found.</h2>
  <h3>The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.</h3>
 </fieldset></div>
</div>
</body>
</html>
`

const PAGE_WITH_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Reliance Retail</title>
  </head>
  <body>
    <h2>Reliance SMART</h2>
    <h3>Current Openings</h3>
    <a href="https://careers.ril.com/rilcareers/frmJobSearch.aspx">Apply now</a>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/reliancesmart/script.js')
  } catch {
    assert.fail('Expected Reliance Smart scraper module at ../../scraper/reliancesmart/script.js')
  }
}

test('Reliance Smart sentinel helpers stay pinned to the verified official brand page and missing careers routes', async () => {
  const relianceSmart = await loadScriptModule()

  assert.equal(relianceSmart.SOURCE, 'reliancesmart')
  assert.equal(relianceSmart.COMPANY, 'Reliance Smart')
  assert.equal(relianceSmart.OFFICIAL_BRAND_NAME, 'Reliance SMART')
  assert.equal(relianceSmart.VERIFIED_ON, '2026-07-17')
  assert.equal(relianceSmart.HOMEPAGE_URL, 'https://www.relianceretail.com/')
  assert.equal(relianceSmart.BRAND_PAGE_URL, 'https://www.relianceretail.com/reliance-smart.html')
  assert.deepEqual(relianceSmart.NO_PUBLIC_CAREER_ROUTE_URLS, [
    'https://www.relianceretail.com/careers',
    'https://www.relianceretail.com/careers/',
    'https://www.relianceretail.com/jobs',
    'https://www.relianceretail.com/jobs/',
  ])
  assert.equal(relianceSmart.hasOfficialBrandPageSignal(BRAND_PAGE_HTML), true)
  assert.equal(relianceSmart.hasPublicJobsSignal(BRAND_PAGE_HTML), false)
  assert.equal(relianceSmart.hasPublicJobsSignal(PAGE_WITH_JOBS_HTML), true)
  assert.equal(
    relianceSmart.isVerifiedMissingCareerRoute({
      status: 404,
      url: 'https://www.relianceretail.com/careers',
      html: MISSING_ROUTE_HTML,
    }),
    true,
  )
})

test('Reliance Smart returns [] only while the official brand page stays informational and the first-party careers routes remain 404', async () => {
  const relianceSmart = await loadScriptModule()
  const requestedUrls = []

  const jobs = await relianceSmart.createRelianceSmartScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === relianceSmart.BRAND_PAGE_URL) {
        return { status: 200, url, html: BRAND_PAGE_HTML }
      }

      if (relianceSmart.NO_PUBLIC_CAREER_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: MISSING_ROUTE_HTML }
      }

      throw new Error(`Unexpected Reliance Smart URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    relianceSmart.BRAND_PAGE_URL,
    ...relianceSmart.NO_PUBLIC_CAREER_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Reliance Smart fails closed when the verified brand page drifts or starts exposing public jobs', async () => {
  const relianceSmart = await loadScriptModule()

  await assert.rejects(
    relianceSmart.createRelianceSmartScraper().run({
      fetchPage: async (url) => {
        if (url === relianceSmart.BRAND_PAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /verified official brand page/i,
  )

  await assert.rejects(
    relianceSmart.createRelianceSmartScraper().run({
      fetchPage: async (url) => {
        if (url === relianceSmart.BRAND_PAGE_URL) {
          return { status: 200, url, html: PAGE_WITH_JOBS_HTML }
        }

        return { status: 404, url, html: MISSING_ROUTE_HTML }
      },
    }),
    /brand page now appears to expose public jobs/i,
  )

  await assert.rejects(
    relianceSmart.createRelianceSmartScraper().run({
      fetchPage: async (url) => {
        if (url === relianceSmart.BRAND_PAGE_URL) {
          return { status: 200, url, html: BRAND_PAGE_HTML }
        }

        return { status: 200, url, html: '<html><body><h1>Open roles</h1></body></html>' }
      },
    }),
    /no-public-careers surface changed/i,
  )
})
