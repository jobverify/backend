import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI Supply Chain &amp; Logistics Intelligence Platform | Enmovil</title>
  </head>
  <body>
    <main>
      <h1>Build your autonomous supply chain.</h1>
      <p>The intelligence layer over ERP, TMS and WMS.</p>
      <p>Meet CADDIE.</p>
      <a href="/contact-us">Book a Demo</a>
    </main>
  </body>
</html>
`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.enmovil.ai</loc>
  </url>
  <url>
    <loc>https://www.enmovil.ai/about-us</loc>
  </url>
</urlset>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Enmovil | Enmovil</title>
    <meta name="description" content="Careers at Enmovil. We have no open roles right now, but you can write to us with a note about your work." />
    <meta name="robots" content="noindex, follow" />
    <meta
      name="description"
      content="Join Enmovil and help build the future of AI-powered supply chain orchestration. Explore open positions."
    />
    <link rel="canonical" href="https://www.enmovil.ai/careers" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>We have no open roles right now.</p>
      <a href="/contact-us">Talk to Sales</a>
    </main>
  </body>
</html>
`

const jobs404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page Not Found | Enmovil</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>Page Not Found</p>
      <a href="/contact-us">Talk to Sales</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Enmovil</title>
    <link rel="canonical" href="https://www.enmovil.ai/careers" />
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer"}
    </script>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Current Openings</p>
      <a href="https://jobs.ashbyhq.com/enmovil/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/enmovil/script.js')
  } catch {
    assert.fail('Expected Enmovil scraper module at ../../scraper/enmovil/script.js')
  }
}

test('Enmovil helpers verify the current homepage, sitemap, explicit empty careers page, and missing jobs route', async () => {
  const enmovil = await loadModule()

  assert.equal(enmovil.COMPANY, 'Enmovil')
  assert.equal(enmovil.OFFICIAL_BRAND_NAME, 'Enmovil')
  assert.equal(enmovil.SOURCE, 'enmovil')
  assert.equal(enmovil.HOMEPAGE_URL, 'https://www.enmovil.ai/')
  assert.equal(enmovil.CAREERS_URL, 'https://www.enmovil.ai/careers')
  assert.equal(enmovil.SITEMAP_URL, 'https://www.enmovil.ai/sitemap.xml')
  assert.equal(enmovil.JOBS_URL, 'https://www.enmovil.ai/jobs')
  assert.equal(enmovil.VERIFIED_ON, '2026-10-03')
  assert.match(enmovil.VERIFIED_SURFACE_SUMMARY, /no open roles right now/i)
  assert.match(enmovil.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(enmovil.hasOfficialHomepageSignal(homepageHtml), true)
  assert.deepEqual(
    enmovil.extractSitemapUrls(sitemapXml),
    [
      'https://www.enmovil.ai',
      'https://www.enmovil.ai/about-us',
    ],
  )
  assert.equal(enmovil.sitemapIncludesCareersUrl(sitemapXml), false)
  assert.equal(enmovil.sitemapIncludesHomepageUrl(sitemapXml), true)
  assert.equal(enmovil.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(enmovil.hasVerifiedEmptyCareersState(careersPageHtml), true)
  assert.equal(enmovil.pageExposesPublicJobListings(careersPageHtml), false)
  assert.equal(enmovil.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(
    enmovil.isVerifiedMissingJobsRoute({
      status: 404,
      url: 'https://www.enmovil.ai/jobs',
      html: jobs404Html,
    }),
    true,
  )
})

test('Enmovil returns no jobs while the verified first-party careers page explicitly has no open roles', async () => {
  const enmovil = await loadModule()
  const requestedUrls = []

  const jobs = await enmovil.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === enmovil.HOMEPAGE_URL) {
        return {
          status: 200,
          url: enmovil.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === enmovil.SITEMAP_URL) {
        return {
          status: 200,
          url: enmovil.SITEMAP_URL,
          html: sitemapXml,
        }
      }

      if (url === enmovil.CAREERS_URL) {
        return {
          status: 200,
          url: enmovil.CAREERS_URL,
          html: careersPageHtml,
        }
      }

      if (url === enmovil.JOBS_URL) {
        return {
          status: 404,
          url: enmovil.JOBS_URL,
          html: jobs404Html,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    enmovil.HOMEPAGE_URL,
    enmovil.SITEMAP_URL,
    enmovil.CAREERS_URL,
    enmovil.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Enmovil fails closed when the verified homepage, sitemap, careers page, or jobs-route 404 drift', async () => {
  const enmovil = await loadModule()

  await assert.rejects(
    enmovil.run({
      fetchPage: async (url) => {
        if (url === enmovil.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Enmovil</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches|official homepage/i,
  )

  await assert.rejects(
    enmovil.run({
      fetchPage: async (url) => {
        if (url === enmovil.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === enmovil.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: '<?xml version="1.0"?><urlset></urlset>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap no longer matches|careers url/i,
  )

  await assert.rejects(
    enmovil.run({
      fetchPage: async (url) => {
        if (url === enmovil.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === enmovil.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
          }
        }

        if (url === enmovil.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page changed materially|public jobs surface/i,
  )

  await assert.rejects(
    enmovil.run({
      fetchPage: async (url) => {
        if (url === enmovil.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === enmovil.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml,
          }
        }

        if (url === enmovil.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersPageHtml,
          }
        }

        if (url === enmovil.JOBS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Jobs</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /jobs route changed materially|public jobs surface/i,
  )
})
