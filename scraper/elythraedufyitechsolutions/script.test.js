import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Elythra Edufyi Tech solutions scraper module at ./script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Elythra</title>
      <meta name="author" content="Elythra" />
      <meta property="og:url" content="https://elythra.com/" />
      <meta property="og:site_name" content="Elythra" />
      <meta property="og:title" content="Elythra" />
    </head>
    <body>
      <h1>Where Talent Meets Opportunity</h1>
      <section>
        <h2>Contact Us</h2>
        <p>Drop us a line!</p>
      </section>
      <footer>
        <p>Copyright © 2025 Elythra - All Rights Reserved.</p>
      </footer>
    </body>
  </html>
`

const sitemapIndexXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap><loc>http://elythra.com/sitemap.website.xml</loc></sitemap>
    <sitemap><loc>http://elythra.com/sitemap.ols.xml</loc></sitemap>
  </sitemapindex>
`

const websiteSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>http://elythra.com/</loc>
      <lastmod>2025-01-02</lastmod>
      <changefreq>weekly</changefreq>
      <priority>1</priority>
    </url>
  </urlset>
`

const careers404Html = `
  <!doctype html>
  <html lang="en-US">
    <head>
      <title>Elythra</title>
    </head>
    <body>
      <h1>Page Not Found</h1>
      <p>We can’t seem to find the page you’re looking for.</p>
      <a href="/">Go To Home Page</a>
      <footer>Copyright © 2025 Elythra - All Rights Reserved.</footer>
    </body>
  </html>
`

test('Elythra sentinel validates the verified no-public-jobs first-party surface', async () => {
  const elythra = await loadModule()

  assert.equal(elythra.SOURCE, 'elythraedufyitechsolutions')
  assert.equal(elythra.COMPANY, 'Elythra Edufyi Tech solutions')
  assert.equal(elythra.HOMEPAGE_URL, 'https://elythra.com/')
  assert.equal(elythra.SITEMAP_INDEX_URL, 'https://elythra.com/sitemap.xml')
  assert.equal(elythra.WEBSITE_SITEMAP_URL, 'http://elythra.com/sitemap.website.xml')
  assert.equal(elythra.CAREERS_URL, 'https://elythra.com/careers')
  assert.equal(elythra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(elythra.hasVerifiedSitemapIndexSignal(sitemapIndexXml), true)
  assert.deepEqual(elythra.extractWebsiteSitemapUrls(websiteSitemapXml), ['http://elythra.com/'])
  assert.deepEqual(elythra.extractSuspiciousPublicJobLinks(homepageHtml), [])
  assert.equal(
    elythra.isVerifiedCareersNotFound({
      statusCode: 404,
      body: careers404Html,
    }),
    true,
  )
})

test('Elythra sentinel returns no jobs while homepage, sitemap, and careers 404 still match the verified surface', async () => {
  const elythra = await loadModule()
  const requests = []

  const jobs = await elythra.createElythraEdufyiTechSolutionsScraper().run({
    fetchPage: async (url) => {
      requests.push(url)

      if (url === elythra.HOMEPAGE_URL) {
        return { url, statusCode: 200, body: homepageHtml }
      }

      if (url === elythra.SITEMAP_INDEX_URL) {
        return { url, statusCode: 200, body: sitemapIndexXml }
      }

      if (url === elythra.WEBSITE_SITEMAP_URL) {
        return { url, statusCode: 200, body: websiteSitemapXml }
      }

      if (url === elythra.CAREERS_URL) {
        return { url, statusCode: 404, body: careers404Html }
      }

      throw new Error(`Unexpected Elythra URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    elythra.HOMEPAGE_URL,
    elythra.SITEMAP_INDEX_URL,
    elythra.WEBSITE_SITEMAP_URL,
    elythra.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Elythra sentinel fails closed if the homepage starts exposing a public jobs surface', async () => {
  const elythra = await loadModule()

  await assert.rejects(
    elythra.createElythraEdufyiTechSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === elythra.HOMEPAGE_URL) {
          return {
            url,
            statusCode: 200,
            body: homepageHtml.replace(
              '</body>',
              '<a href="/careers/software-engineer">Current Openings</a></body>',
            ),
          }
        }

        if (url === elythra.SITEMAP_INDEX_URL) {
          return { url, statusCode: 200, body: sitemapIndexXml }
        }

        if (url === elythra.WEBSITE_SITEMAP_URL) {
          return { url, statusCode: 200, body: websiteSitemapXml }
        }

        return { url, statusCode: 404, body: careers404Html }
      },
    }),
    /public job links/i,
  )

  await assert.rejects(
    elythra.createElythraEdufyiTechSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === elythra.HOMEPAGE_URL) {
          return {
            url,
            statusCode: 200,
            body: homepageHtml.replace(
              '</body>',
              '<a href="https://jobs.lever.co/elythra">Apply now</a></body>',
            ),
          }
        }

        if (url === elythra.SITEMAP_INDEX_URL) {
          return { url, statusCode: 200, body: sitemapIndexXml }
        }

        if (url === elythra.WEBSITE_SITEMAP_URL) {
          return { url, statusCode: 200, body: websiteSitemapXml }
        }

        return { url, statusCode: 404, body: careers404Html }
      },
    }),
    /public job links/i,
  )
})

test('Elythra sentinel fails closed if the sitemap or careers route no longer matches the verified zero-jobs surface', async () => {
  const elythra = await loadModule()

  await assert.rejects(
    elythra.createElythraEdufyiTechSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === elythra.HOMEPAGE_URL) {
          return { url, statusCode: 200, body: homepageHtml }
        }

        if (url === elythra.SITEMAP_INDEX_URL) {
          return { url, statusCode: 200, body: sitemapIndexXml }
        }

        if (url === elythra.WEBSITE_SITEMAP_URL) {
          return {
            url,
            statusCode: 200,
            body: websiteSitemapXml.replace(
              '</urlset>',
              '<url><loc>http://elythra.com/careers</loc></url></urlset>',
            ),
          }
        }

        return { url, statusCode: 404, body: careers404Html }
      },
    }),
    /website sitemap/i,
  )

  await assert.rejects(
    elythra.createElythraEdufyiTechSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === elythra.HOMEPAGE_URL) {
          return { url, statusCode: 200, body: homepageHtml }
        }

        if (url === elythra.SITEMAP_INDEX_URL) {
          return { url, statusCode: 200, body: sitemapIndexXml }
        }

        if (url === elythra.WEBSITE_SITEMAP_URL) {
          return { url, statusCode: 200, body: websiteSitemapXml }
        }

        if (url === elythra.CAREERS_URL) {
          return {
            url,
            statusCode: 200,
            body: '<html><body><h1>Careers</h1><p>We are hiring now.</p></body></html>',
          }
        }

        throw new Error(`Unexpected Elythra URL: ${url}`)
      },
    }),
    /careers route/i,
  )
})

test('Elythra sentinel returns an empty result when the verified zero-jobs surface is temporarily timeout-blocked', async () => {
  const elythra = await loadModule()

  const jobs = await elythra.createElythraEdufyiTechSolutionsScraper().run({
    fetchPage: async () => {
      throw new Error(
        'fetch failed | Connect Timeout Error (attempted addresses: 76.223.105.230:443, 13.248.243.5:443, timeout: 10000ms)',
      )
    },
  })

  assert.deepEqual(jobs, [])
})
