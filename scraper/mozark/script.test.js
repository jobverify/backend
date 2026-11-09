import assert from 'node:assert/strict'
import test from 'node:test'

const loadMozarkModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Mozark scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mozark.ai</title>
    <meta
      name="description"
      content="Digital experience intelligence across user, application and network layers."
    >
  </head>
  <body>
    <main>
      <nav>
        <a href="/application-experience">Application Experience</a>
        <a href="/network-experience">Network Experience</a>
        <a href="/about-us">About Us</a>
        <a href="/contact-us">Contact Us</a>
      </nav>
      <p>DIGITAL EXPERIENCE ASSURANCE</p>
      <h1>Experience Is All</h1>
      <p>Digital experience assurance across user, application and network layers.</p>
      <p>Great User Experience Requires Great Apps and Great Networks. Mozark Assures That.</p>
      <p>Ready to elevate your digital experience? Join hundreds of enterprises using Mozark AI.</p>
    </main>
  </body>
</html>
`

const officialMissingSurfaceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404: This page could not be found.</title>
  </head>
  <body>
    <main>
      <a href="/">Mozark.ai</a>
      <h1>404</h1>
      <p>This page could not be found.</p>
    </main>
  </body>
</html>
`

test('Mozark scraper constants stay pinned to the verified homepage and missing public-surface endpoints', async () => {
  const mozark = await loadMozarkModule()

  assert.equal(mozark.SOURCE, 'mozark')
  assert.equal(mozark.COMPANY, 'Mozark')
  assert.equal(mozark.HOMEPAGE_URL, 'https://www.mozark.ai/')
  assert.equal(mozark.SITEMAP_INDEX_URL, 'https://www.mozark.ai/sitemap.xml')
  assert.equal(mozark.PAGES_SITEMAP_URL, 'https://www.mozark.ai/pages-sitemap.xml')
  assert.deepEqual(mozark.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.mozark.ai/careers',
    'https://www.mozark.ai/careers/',
    'https://www.mozark.ai/career',
    'https://www.mozark.ai/career/',
    'https://www.mozark.ai/jobs',
    'https://www.mozark.ai/jobs/',
    'https://www.mozark.ai/join-us',
    'https://www.mozark.ai/openings',
  ])
  assert.equal(mozark.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(mozark.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(
    mozark.isVerifiedMissingCareersRoute({
      status: 404,
      url: mozark.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: officialMissingSurfaceHtml,
    }),
    true,
  )
  assert.equal(
    mozark.isVerifiedMissingCareersRoute({
      status: 404,
      url: mozark.SITEMAP_INDEX_URL,
      html: officialMissingSurfaceHtml,
    }),
    true,
  )
  assert.equal(
    mozark.isVerifiedMissingCareersRoute({
      status: 200,
      url: mozark.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: '<html><body><h1>Careers</h1><a href="/jobs/platform-engineer">Apply now</a></body></html>',
    }),
    false,
  )
})

test('Mozark returns no jobs only while the verified homepage and missing public-surface endpoints stay unchanged', async () => {
  const mozark = await loadMozarkModule()
  const requestedUrls = []

  const jobs = await mozark.createMozarkScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mozark.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === mozark.SITEMAP_INDEX_URL || url === mozark.PAGES_SITEMAP_URL) {
        return { status: 404, url, html: officialMissingSurfaceHtml }
      }

      if (mozark.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: officialMissingSurfaceHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mozark.HOMEPAGE_URL,
    mozark.SITEMAP_INDEX_URL,
    mozark.PAGES_SITEMAP_URL,
    ...mozark.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Mozark fails closed when the verified no-public-careers contract drifts', async () => {
  const mozark = await loadMozarkModule()

  await assert.rejects(
    mozark.createMozarkScraper().run({
      fetchPage: async (url) => {
        if (url === mozark.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    mozark.createMozarkScraper().run({
      fetchPage: async (url) => {
        if (url === mozark.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === mozark.SITEMAP_INDEX_URL) {
          return {
            status: 200,
            url,
            html: '<?xml version="1.0"?><urlset><url><loc>https://www.mozark.ai/careers</loc></url></urlset>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap endpoint/i,
  )

  await assert.rejects(
    mozark.createMozarkScraper().run({
      fetchPage: async (url) => {
        if (url === mozark.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === mozark.SITEMAP_INDEX_URL || url === mozark.PAGES_SITEMAP_URL) {
          return { status: 404, url, html: officialMissingSurfaceHtml }
        }

        if (url === mozark.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="https://jobs.ashbyhq.com/mozark">Open positions</a></body></html>',
          }
        }

        return { status: 404, url, html: officialMissingSurfaceHtml }
      },
    }),
    /careers routes changed materially|public jobs/i,
  )
})
