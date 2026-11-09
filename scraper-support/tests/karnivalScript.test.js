import assert from 'node:assert/strict'
import test from 'node:test'

const loadKarnivalModule = async () => {
  try {
    return await import('../../scraper/karnival/script.js')
  } catch {
    assert.fail('Expected Karnival scraper module at ../../scraper/karnival/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Customer marketing and smarter receipts for brands</title>
  </head>
  <body>
    <nav>
      <a href="#solutions">Solutions</a>
      <a href="#success">Success</a>
      <a href="/blogs">Resources</a>
      <a href="/contact">Contact us</a>
    </nav>
    <main>
      <h1>Customer marketing platform for brands and retail image</h1>
      <a href="/contact">Get a demo</a>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://karnival.com</loc></url>
  <url><loc>https://karnival.com/contact</loc></url>
  <url><loc>https://karnival.com/blogs</loc></url>
  <url><loc>https://karnival.com/terms-and-conditions</loc></url>
  <url><loc>https://karnival.com/privacy-policy</loc></url>
  <url><loc>https://karnival.com/dpa</loc></url>
  <url><loc>https://karnival.com/blog/why-is-customer-feedback-important-for-brands</loc></url>
</urlset>
`

const jobsLinkedSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://karnival.com/</loc></url>
  <url><loc>https://karnival.com/careers</loc></url>
</urlset>
`

const mixedHostSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.karnival.com/</loc></url>
  <url><loc>https://karnival.com/contact</loc></url>
  <url><loc>https://www.karnival.com/blogs</loc></url>
  <url><loc>https://karnival.com/terms-and-conditions</loc></url>
  <url><loc>https://www.karnival.com/privacy-policy</loc></url>
</urlset>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Not Found</title>
  </head>
  <body>
    <section class="modal-section">
      <h1>Oops! 404 Error</h1>
      <p>The page you are looking for does not exist.</p>
    </section>
  </body>
</html>
`

const liveJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Karnival Careers</title>
  </head>
  <body>
    <main>
      <h1>Join our team</h1>
      <a href="https://jobs.example.com/karnival/account-executive">Apply now</a>
    </main>
  </body>
</html>
`

test('Karnival pins the verified official homepage, sitemap without careers routes, and missing jobs routes', async () => {
  const karnival = await loadKarnivalModule()

  assert.equal(karnival.SOURCE, 'karnival')
  assert.equal(karnival.COMPANY, 'Karnival')
  assert.equal(karnival.VERIFIED_ON, '2026-08-15')
  assert.equal(karnival.HOMEPAGE_URL, 'https://www.karnival.com/')
  assert.equal(karnival.SITEMAP_URL, 'https://karnival.com/sitemap.xml')
  assert.deepEqual(karnival.MISSING_JOBS_ROUTE_URLS, [
    'https://karnival.com/careers',
    'https://karnival.com/jobs',
  ])

  assert.equal(karnival.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(karnival.hasRenderablePublicJobsSignal(homepageHtml), false)
  assert.equal(karnival.hasRenderablePublicJobsSignal(liveJobsHtml), true)
  assert.deepEqual(karnival.extractSitemapUrls(sitemapXml), [
    'https://karnival.com',
    'https://karnival.com/contact',
    'https://karnival.com/blogs',
    'https://karnival.com/terms-and-conditions',
    'https://karnival.com/privacy-policy',
    'https://karnival.com/dpa',
    'https://karnival.com/blog/why-is-customer-feedback-important-for-brands',
  ])
  assert.equal(karnival.hasVerifiedSitemapSignal(sitemapXml), true)
  assert.equal(karnival.hasVerifiedSitemapSignal(mixedHostSitemapXml), true)
  assert.equal(karnival.hasVerifiedSitemapSignal(jobsLinkedSitemapXml), false)
  assert.equal(
    karnival.isVerifiedMissingJobsRoute({
      status: 404,
      url: karnival.MISSING_JOBS_ROUTE_URLS[0],
      html: notFoundHtml,
    }),
    true,
  )
})

test('Karnival sentinel returns [] only while the verified homepage, sitemap, and missing routes remain unchanged', async () => {
  const karnival = await loadKarnivalModule()
  const requestedUrls = []

  const jobs = await karnival.createKarnivalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === karnival.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === karnival.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (karnival.MISSING_JOBS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    karnival.HOMEPAGE_URL,
    karnival.SITEMAP_URL,
    ...karnival.MISSING_JOBS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Karnival sentinel fails closed when the homepage starts linking jobs, the sitemap adds careers routes, or missing routes revive', async () => {
  const karnival = await loadKarnivalModule()

  await assert.rejects(
    karnival.createKarnivalScraper().run({
      fetchPage: async (url) => {
        if (url === karnival.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    karnival.createKarnivalScraper().run({
      fetchPage: async (url) => {
        if (url === karnival.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === karnival.SITEMAP_URL) {
          return { status: 200, url, html: jobsLinkedSitemapXml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap no longer matches the verified public page inventory/i,
  )

  await assert.rejects(
    karnival.createKarnivalScraper().run({
      fetchPage: async (url) => {
        if (url === karnival.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === karnival.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        if (url === karnival.MISSING_JOBS_ROUTE_URLS[0]) {
          return { status: 200, url, html: liveJobsHtml }
        }

        if (url === karnival.MISSING_JOBS_ROUTE_URLS[1]) {
          return { status: 404, url, html: notFoundHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing first-party jobs route changed materially/i,
  )
})
