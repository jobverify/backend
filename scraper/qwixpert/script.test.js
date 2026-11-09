import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Qwixpert Consulting &#8211; Operational Excellence</title>
    <meta name="application-name" content="Qwixpert Consulting" />
  </head>
  <body>
    <nav>
      <a href="https://qwixpert.com/">Home</a>
      <a href="https://qwixpert.com/about-qwixpert/">About Us</a>
      <a href="https://qwixpert.com/services/">Services</a>
      <a href="https://qwixpert.com/technology/">Technology</a>
      <a href="https://qwixpert.com/contact-us/">Contact Us</a>
    </nav>
    <main>
      <h1><strong>We fix what slows you down</strong></h1>
      <h3>Your partner in unlocking Operational Excellence</h3>
      <p>Not sure where to start?</p>
      <p>Let's discuss your current bottlenecks and design a solution roadmap.</p>
      <a href="https://qwixpert.com/contact-us/">Connect with us</a>
    </main>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://qwixpert.com/wp-sitemap-posts-post-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-posts-page-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-posts-portfolio-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-posts-testimonial-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-posts-area-item-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-taxonomies-category-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-taxonomies-post_tag-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-taxonomies-post_format-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-taxonomies-portfolio_category-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-taxonomies-portfolio_field-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-taxonomies-testimonial_category-1.xml</loc></sitemap>
  <sitemap><loc>https://qwixpert.com/wp-sitemap-users-1.xml</loc></sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://qwixpert.com/blog/blog-small-media-ws/</loc></url>
  <url><loc>https://qwixpert.com/technology/</loc></url>
  <url><loc>https://qwixpert.com/contact-us/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-industry/header-sliding-area/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-insight/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-industry/qwixpert-industries-dairy/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-industry/qwixpert-industries-packaged-foods/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-industry/qwixpert-industries-cement/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-industry/qwixpert-industries-chemicals/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-industry/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-industry/qwixpert-industries-auto/</loc></url>
  <url><loc>https://qwixpert.com/qwixpert-blog/</loc></url>
  <url><loc>https://qwixpert.com/about-qwixpert/</loc></url>
  <url><loc>https://qwixpert.com/services/</loc></url>
  <url><loc>https://qwixpert.com/services/strategy-and-performance/</loc></url>
  <url><loc>https://qwixpert.com/</loc></url>
  <url><loc>https://qwixpert.com/services/qwixpert-operational-efficiency/</loc></url>
  <url><loc>https://qwixpert.com/services/supply-chain-design/</loc></url>
</urlset>
`

const missingRoutePage = {
  status: 404,
  url: 'https://qwixpert.com/careers',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <title>Page not found &#8211; Qwixpert Consulting</title>
        <meta name="application-name" content="Qwixpert Consulting" />
      </head>
      <body>
        <main>
          <h1>Hey there mate!</h1>
          <h2>Your lost treasure is not found here...</h2>
          <p>Sorry! The page you are looking for wasn't found!</p>
          <span>Qwixpert Consulting</span>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Qwixpert sentinel recognizes the verified homepage, sitemap surfaces, and missing careers routes', async () => {
  const qwixpert = await loadModule()
  assert.ok(qwixpert, 'Expected scraper module at ./script.js')

  assert.equal(qwixpert.SOURCE, 'qwixpert')
  assert.equal(qwixpert.COMPANY, 'Qwixpert')
  assert.equal(qwixpert.HOMEPAGE_URL, 'https://qwixpert.com/')
  assert.equal(qwixpert.SITEMAP_URL, 'https://qwixpert.com/sitemap.xml')
  assert.equal(qwixpert.SITEMAP_INDEX_URL, 'https://qwixpert.com/wp-sitemap.xml')
  assert.equal(qwixpert.PAGE_SITEMAP_URL, 'https://qwixpert.com/wp-sitemap-posts-page-1.xml')
  assert.deepEqual(qwixpert.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://qwixpert.com/careers',
    'https://qwixpert.com/career',
    'https://qwixpert.com/jobs',
    'https://qwixpert.com/job-openings',
  ])

  assert.equal(qwixpert.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(qwixpert.hasUnexpectedCareerLikeLink(homepageHtml), false)
  assert.equal(qwixpert.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    qwixpert.isVerifiedSitemapIndex({
      status: 200,
      url: qwixpert.SITEMAP_INDEX_URL,
      html: sitemapIndexXml,
    }),
    true,
  )
  assert.equal(
    qwixpert.isVerifiedPageSitemap({
      status: 200,
      url: qwixpert.PAGE_SITEMAP_URL,
      html: pageSitemapXml,
    }),
    true,
  )
  assert.equal(qwixpert.isVerifiedMissingCareerRoute(missingRoutePage), true)
})

test('Qwixpert sentinel returns no jobs only while the verified first-party surface exposes no public careers board', async () => {
  const qwixpert = await loadModule()
  assert.ok(qwixpert, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await qwixpert.createQwixpertScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === qwixpert.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === qwixpert.SITEMAP_URL) {
        return {
          status: 200,
          url: qwixpert.SITEMAP_INDEX_URL,
          html: sitemapIndexXml,
        }
      }

      if (url === qwixpert.PAGE_SITEMAP_URL) {
        return {
          status: 200,
          url,
          html: pageSitemapXml,
        }
      }

      if (qwixpert.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { ...missingRoutePage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    qwixpert.HOMEPAGE_URL,
    qwixpert.SITEMAP_URL,
    qwixpert.PAGE_SITEMAP_URL,
    ...qwixpert.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Qwixpert sentinel fails closed when the verified public surface drifts', async () => {
  const qwixpert = await loadModule()
  assert.ok(qwixpert, 'Expected scraper module at ./script.js')

  await assert.rejects(
    qwixpert.createQwixpertScraper().run({
      fetchPage: async (url) => {
        if (url === qwixpert.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    qwixpert.createQwixpertScraper().run({
      fetchPage: async (url) => {
        if (url === qwixpert.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('</nav>', '<a href="/careers">Careers</a></nav>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers path/i,
  )

  await assert.rejects(
    qwixpert.createQwixpertScraper().run({
      fetchPage: async (url) => {
        if (url === qwixpert.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === qwixpert.SITEMAP_URL) {
          return {
            status: 200,
            url: qwixpert.SITEMAP_INDEX_URL,
            html: sitemapIndexXml.replace(
              '</sitemapindex>',
              '<sitemap><loc>https://qwixpert.com/careers</loc></sitemap></sitemapindex>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap index/i,
  )

  await assert.rejects(
    qwixpert.createQwixpertScraper().run({
      fetchPage: async (url) => {
        if (url === qwixpert.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === qwixpert.SITEMAP_URL) {
          return {
            status: 200,
            url: qwixpert.SITEMAP_INDEX_URL,
            html: sitemapIndexXml,
          }
        }

        if (url === qwixpert.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://qwixpert.com/careers</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap/i,
  )

  await assert.rejects(
    qwixpert.createQwixpertScraper().run({
      fetchPage: async (url) => {
        if (url === qwixpert.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === qwixpert.SITEMAP_URL) {
          return {
            status: 200,
            url: qwixpert.SITEMAP_INDEX_URL,
            html: sitemapIndexXml,
          }
        }

        if (url === qwixpert.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml,
          }
        }

        if (url === qwixpert.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current Openings</p></body></html>',
          }
        }

        if (qwixpert.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { ...missingRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers routes changed materially or now expose a public careers surface/i,
  )
})
