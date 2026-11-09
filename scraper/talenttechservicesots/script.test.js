import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Talent Tech Services</title>
    </head>
    <body>
      <header>
        <nav>
          <a href="https://talenttechservices.com/">Home</a>
          <a href="https://talenttechservices.com/about-us/">About us</a>
          <a href="https://talenttechservices.com/services/">Services</a>
          <a href="https://talenttechservices.com/contact/">Contact</a>
        </nav>
      </header>
      <main>
        <h1>Best IT Recruitment Services</h1>
        <h2>Smart IT Recruitment for a Digital World</h2>
        <p>
          Talent Techservices specializes in sourcing, screening, and placing high-quality IT
          professionals across technologies.
        </p>
        <p>
          We provide end-to-end IT recruitment solutions, connecting businesses with skilled
          professionals across all technology domains.
        </p>
      </main>
      <footer>
        <p>Feel free to contact &amp; reach us !</p>
        <p>Address : 30 N Gould St Ste R Sheridan, WY 82801</p>
        <p>Email : info@talenttechservices.com</p>
        <p>Phone : +1213_451_5496</p>
      </footer>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Contact - Talent Tech Services</title>
    </head>
    <body>
      <main>
        <h1>GET IN TOUCH</h1>
        <p>Contact &amp; Reach Us For More Information</p>
        <p>
          Connect with Talent Techservices today to hire top IT talent or boost your digital
          presence.
        </p>
        <section>
          <h2>Location Address</h2>
          <p>30 N Gould St Ste R</p>
          <p>Sheridan, WY 82801</p>
        </section>
        <section>
          <h2>Phone Numbers</h2>
          <p>Phone : +1213-451-5496</p>
        </section>
        <section>
          <h2>Email Address</h2>
          <p>info@talenttechservices.com</p>
        </section>
      </main>
    </body>
  </html>
`

const contactHtmlWithEntityTitle = contactHtml.replace(
  'Contact - Talent Tech Services',
  'Contact &#8211; Talent Tech Services',
)

const robotsTxt = `
  User-agent: *
  Disallow: /wp-content/uploads/wc-logs/
  Disallow: /wp-content/uploads/woocommerce_transient_files/
  Disallow: /wp-content/uploads/woocommerce_uploads/
  Disallow: /*?add-to-cart=
  Disallow: /*?*add-to-cart=
  Disallow: /wp-admin/
  Allow: /wp-admin/admin-ajax.php

  Sitemap: https://talenttechservices.com/wp-sitemap.xml
`

const sitemapIndexXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <?xml-stylesheet type="text/xsl" href="https://talenttechservices.com/wp-sitemap-index.xsl" ?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap><loc>https://talenttechservices.com/wp-sitemap-posts-post-1.xml</loc></sitemap>
    <sitemap><loc>https://talenttechservices.com/wp-sitemap-posts-page-1.xml</loc></sitemap>
    <sitemap><loc>https://talenttechservices.com/wp-sitemap-taxonomies-category-1.xml</loc></sitemap>
    <sitemap><loc>https://talenttechservices.com/wp-sitemap-users-1.xml</loc></sitemap>
  </sitemapindex>
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <?xml-stylesheet type="text/xsl" href="https://talenttechservices.com/wp-sitemap.xsl" ?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://talenttechservices.com/contact/</loc></url>
    <url><loc>https://talenttechservices.com/blog/</loc></url>
    <url><loc>https://talenttechservices.com/testimonial/</loc></url>
    <url><loc>https://talenttechservices.com/case-studies/</loc></url>
    <url><loc>https://talenttechservices.com/services/</loc></url>
    <url><loc>https://talenttechservices.com/about-us/</loc></url>
    <url><loc>https://talenttechservices.com/</loc></url>
  </urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://talenttechservices.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Page not found - Talent Tech Services</title>
      </head>
      <body>
        <main>
          <h1>404</h1>
          <p>Oops! that page can't be found.</p>
          <p>Maybe try one of the links below or a search?</p>
        </main>
        <footer>
          <p>Feel free to contact &amp; reach us !</p>
          <p>Address : 30 N Gould St Ste R Sheridan, WY 82801</p>
          <p>Email : info@talenttechservices.com</p>
          <p>Phone : +1213_451_5496</p>
        </footer>
      </body>
    </html>
  `,
}

const publicJobsRoutePage = {
  status: 200,
  url: 'https://talenttechservices.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Careers - Talent Tech Services</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <a href="https://jobs.lever.co/talenttechservices/platform-recruiter">Apply now</a>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Talent Tech Services (OTS) scraper module at ./script.js')
  }
}

test('Talent Tech Services (OTS) sentinel recognizes the verified official homepage, contact page, robots, sitemaps, and missing careers routes', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'talenttechservicesots')
  assert.equal(scraper.COMPANY, 'Talent Tech Services (OTS)')
  assert.equal(scraper.HOMEPAGE_URL, 'https://talenttechservices.com/')
  assert.equal(scraper.CONTACT_URL, 'https://talenttechservices.com/contact/')
  assert.equal(scraper.ROBOTS_URL, 'https://talenttechservices.com/robots.txt')
  assert.equal(scraper.SITEMAP_INDEX_URL, 'https://talenttechservices.com/wp-sitemap.xml')
  assert.equal(
    scraper.PAGE_SITEMAP_URL,
    'https://talenttechservices.com/wp-sitemap-posts-page-1.xml',
  )
  assert.deepEqual(scraper.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://talenttechservices.com/careers',
    'https://talenttechservices.com/career',
    'https://talenttechservices.com/jobs',
    'https://talenttechservices.com/join-us',
    'https://talenttechservices.com/openings',
  ])
  assert.deepEqual(scraper.EXPECTED_PAGE_SITEMAP_URLS, [
    'https://talenttechservices.com/contact/',
    'https://talenttechservices.com/blog/',
    'https://talenttechservices.com/testimonial/',
    'https://talenttechservices.com/case-studies/',
    'https://talenttechservices.com/services/',
    'https://talenttechservices.com/about-us/',
    'https://talenttechservices.com/',
  ])

  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasOfficialContactSignal(contactHtml), true)
  assert.equal(scraper.hasOfficialContactSignal(contactHtmlWithEntityTitle), true)
  assert.equal(scraper.hasOfficialRobotsSignal(robotsTxt), true)
  assert.equal(scraper.hasOfficialSitemapIndexSignal(sitemapIndexXml), true)
  assert.equal(scraper.hasExpectedPageSitemapSignal(pageSitemapXml), true)
  assert.deepEqual(scraper.extractSitemapUrls(pageSitemapXml), scraper.EXPECTED_PAGE_SITEMAP_URLS)
  assert.equal(scraper.hasUnexpectedCareerLikeLink(homepageHtml), false)
  assert.equal(scraper.hasUnexpectedCareerLikeLink(contactHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(contactHtml), false)
  assert.equal(scraper.hasPublicJobsSignal(pageSitemapXml), false)
  assert.equal(scraper.hasOfficialMissingCareersRouteSignal(missingCareerRoutePage), true)
})

test('Talent Tech Services (OTS) sentinel returns no jobs only while the verified first-party surface exposes no public careers board', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createTalentTechServicesOtsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === scraper.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === scraper.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
      if (url === scraper.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
      if (url === scraper.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
      if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.CONTACT_URL,
    scraper.ROBOTS_URL,
    scraper.SITEMAP_INDEX_URL,
    scraper.PAGE_SITEMAP_URL,
    ...scraper.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Talent Tech Services (OTS) sentinel fails closed when the verified first-party no-public-careers surface drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createTalentTechServicesOtsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    scraper.createTalentTechServicesOtsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === scraper.CONTACT_URL) {
          return {
            status: 200,
            url,
            html: contactHtml.replace('Contact &amp; Reach Us For More Information', 'Current Openings'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact page|public jobs surface/i,
  )

  await assert.rejects(
    scraper.createTalentTechServicesOtsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === scraper.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === scraper.ROBOTS_URL) {
          return {
            status: 200,
            url,
            html: robotsTxt.replace(
              'Sitemap: https://talenttechservices.com/wp-sitemap.xml',
              'Sitemap: https://talenttechservices.com/careers.xml',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /robots\.txt/i,
  )

  await assert.rejects(
    scraper.createTalentTechServicesOtsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === scraper.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === scraper.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
        if (url === scraper.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === scraper.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://talenttechservices.com/careers/</loc></url></urlset>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /page sitemap/i,
  )

  await assert.rejects(
    scraper.createTalentTechServicesOtsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === scraper.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === scraper.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
        if (url === scraper.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === scraper.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
        if (url === scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsRoutePage
        if (scraper.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /missing careers route|public careers surface/i,
  )
})
