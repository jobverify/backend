import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <link rel="icon" type="image/png" href="https://static.zeetaminds.com/explore/icons/zeetaminds.png" />
      <link rel="apple-touch-icon" href="https://static.zeetaminds.com/explore/icons/zeetaminds-touch-icon.png" />
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <script>
        ga('create', 'UA-72610722-1', 'auto');
      </script>
      <link rel="modulepreload" href="https://static.zeetaminds.com/explore/_app/immutable/entry/start.qRGzsdih.js">
      <link rel="modulepreload" href="https://static.zeetaminds.com/explore/_app/immutable/entry/app.BMmuMGWG.js">
    </head>
    <body data-sveltekit-preload-data="hover">
      <div style="display: contents">
        <script>
          {
            __sveltekit_1t92c5b = {
              base: "/explore",
              assets: "https://static.zeetaminds.com/explore"
            };

            Promise.all([
              import("https://static.zeetaminds.com/explore/_app/immutable/entry/start.qRGzsdih.js"),
              import("https://static.zeetaminds.com/explore/_app/immutable/entry/app.BMmuMGWG.js")
            ]).then(([kit, app]) => {
              kit.start(app, element);
            });
          }
        </script>
      </div>
    </body>
  </html>
`

const robotsTxt = `
  User-agent: *
  Allow: /explore/
  Sitemap: https://zeetaminds.com/sitemap.xml
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <?xml-stylesheet type="text/xsl" href="/explore/sitemap.xsl"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://zeetaminds.com/explore</loc></url>
    <url><loc>https://zeetaminds.com/explore/features</loc></url>
    <url><loc>https://zeetaminds.com/explore/pricing</loc></url>
    <url><loc>https://zeetaminds.com/explore/videos</loc></url>
    <url><loc>https://zeetaminds.com/explore/getting-started</loc></url>
    <url><loc>https://zeetaminds.com/explore/faq</loc></url>
    <url><loc>https://zeetaminds.com/explore/privacy</loc></url>
    <url><loc>https://zeetaminds.com/explore/terms</loc></url>
    <url><loc>https://zeetaminds.com/explore/refund</loc></url>
    <url><loc>https://zeetaminds.com/explore/blog</loc></url>
    <url><loc>https://zeetaminds.com/explore/blog/2024/12/31/canva-api-the-best-design-tool-integration-for-digital-signage-cms</loc></url>
  </urlset>
`

const notFoundHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Not Found</title>
      <style type="text/css">
        html, body, pre { margin: 0; padding: 0; font-family: Monaco, 'Lucida Console', monospace; background: #ECECEC; }
      </style>
    </head>
    <body>
      <h1>Not Found</h1>
      <pre>For request 'GET /careers/'</pre>
      <p id="detail">The requested URL was not found on this server.</p>
    </body>
  </html>
`

test('Zeetaminds sentinel pins the verified homepage shell, robots, sitemap, and empty careers routes', async () => {
  const zeetaminds = await loadModule()
  assert.ok(zeetaminds, 'Zeetaminds scraper module should load')

  assert.equal(zeetaminds.SOURCE, 'zeetaminds')
  assert.equal(zeetaminds.COMPANY, 'Zeetaminds')
  assert.equal(zeetaminds.HOMEPAGE_URL, 'https://zeetaminds.com/')
  assert.equal(zeetaminds.EXPLORE_URL, 'https://zeetaminds.com/explore/')
  assert.equal(zeetaminds.ROBOTS_URL, 'https://zeetaminds.com/robots.txt')
  assert.equal(zeetaminds.SITEMAP_URL, 'https://zeetaminds.com/sitemap.xml')
  assert.equal(zeetaminds.CAREERS_URL, 'https://zeetaminds.com/careers/')
  assert.equal(zeetaminds.JOBS_URL, 'https://zeetaminds.com/jobs/')
  assert.equal(zeetaminds.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(zeetaminds.hasOfficialRobotsSignal(robotsTxt), true)
  assert.equal(zeetaminds.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(zeetaminds.hasOfficialNotFoundSignal(notFoundHtml), true)
  assert.equal(zeetaminds.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(zeetaminds.hasPublicJobsSignal(sitemapXml), false)
  assert.equal(zeetaminds.hasPublicJobsSignal(notFoundHtml), true)
})

test('Zeetaminds sentinel returns no jobs only while the verified first-party marketing surface stays unchanged', async () => {
  const zeetaminds = await loadModule()
  assert.ok(zeetaminds, 'Zeetaminds scraper module should load')

  const requestedUrls = []
  const jobs = await zeetaminds.createZeetamindsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zeetaminds.HOMEPAGE_URL) {
        return { status: 200, url: zeetaminds.EXPLORE_URL.replace(/\/$/, ''), html: homepageHtml }
      }

      if (url === zeetaminds.ROBOTS_URL) {
        return { status: 200, url, html: robotsTxt }
      }

      if (url === zeetaminds.SITEMAP_URL) {
        return { status: 200, url, html: sitemapXml }
      }

      if (url === zeetaminds.CAREERS_URL || url === zeetaminds.JOBS_URL) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected Zeetaminds URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    zeetaminds.HOMEPAGE_URL,
    zeetaminds.ROBOTS_URL,
    zeetaminds.SITEMAP_URL,
    zeetaminds.CAREERS_URL,
    zeetaminds.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Zeetaminds sentinel fails closed when the verified shell, sitemap, or empty careers routes drift into a jobs surface', async () => {
  const zeetaminds = await loadModule()
  assert.ok(zeetaminds, 'Zeetaminds scraper module should load')

  await assert.rejects(
    zeetaminds.createZeetamindsScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: zeetaminds.HOMEPAGE_URL,
        html: '<html><body><h1>Unexpected homepage</h1></body></html>',
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    zeetaminds.createZeetamindsScraper().run({
      fetchPage: async (url) => {
        if (url === zeetaminds.HOMEPAGE_URL) {
          return { status: 200, url: zeetaminds.EXPLORE_URL.replace(/\/$/, ''), html: homepageHtml }
        }

        if (url === zeetaminds.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        return {
          status: 200,
          url,
          html: sitemapXml.replace(
            '</urlset>',
            '<url><loc>https://zeetaminds.com/explore/careers</loc></url></urlset>',
          ),
        }
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    zeetaminds.createZeetamindsScraper().run({
      fetchPage: async (url) => {
        if (url === zeetaminds.HOMEPAGE_URL) {
          return { status: 200, url: zeetaminds.EXPLORE_URL.replace(/\/$/, ''), html: homepageHtml }
        }

        if (url === zeetaminds.ROBOTS_URL) {
          return { status: 200, url, html: robotsTxt }
        }

        if (url === zeetaminds.SITEMAP_URL) {
          return { status: 200, url, html: sitemapXml }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Open roles</h1><a href="/apply">Apply now</a></body></html>',
        }
      },
    }),
    /verified first-party empty careers routes/i,
  )
})
