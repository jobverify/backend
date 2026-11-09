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
<html lang="en-US">
  <head>
    <title>Home - SP Foundation</title>
    <meta name="description" content="SP Foundation, an initiative by SPC intends to cure, serve and care with an aim to from social care to human welfare." />
    <meta property="og:site_name" content="SP Foundation" />
    <link rel="canonical" href="https://spfoundation.in/" />
  </head>
  <body>
    <nav>
      <a href="https://spfoundation.in/about/">About</a>
      <a href="https://spfoundation.in/contact/">Contact</a>
    </nav>
    <main>
      <h1>SP Foundation</h1>
      <p>Care, Serve and Cure.</p>
      <p>Register to join us as a Volunteer</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact - SP Foundation</title>
    <meta name="description" content="Plot No. 284/1,2 &amp; 3 GIDC Estate, Makarpura, Vadodara - 390010, Gujarat - India. Landline: +91 265 2658894, e-mail: mili.patel@spfoundation.in" />
    <meta property="og:site_name" content="SP Foundation" />
  </head>
  <body>
    <main>
      <h1>Contact</h1>
      <p>Plot No. 284/1,2 &amp; 3 GIDC Estate, Makarpura, Vadodara - 390010, Gujarat - India.</p>
      <a href="mailto:info@spfoundation.in">info@spfoundation.in</a>
      <p>mili.patel@spfoundation.in</p>
      <p>MONDAY - SATURDAY : 9:00AM TO 6:00PM</p>
      <form aria-label="Contact form"></form>
      <p>Copyright 2022 by SP Foundation</p>
    </main>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Page not found - SP Foundation</title>
    <meta property="og:title" content="Page not found - SP Foundation" />
    <meta property="og:site_name" content="SP Foundation" />
  </head>
  <body class="error404">
    <main class="asting_404_page">
      <h1>Ohh! Page Not Found</h1>
      <form role="search" action="https://spfoundation.in/">
        <input type="search" name="s" />
      </form>
    </main>
  </body>
</html>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://spfoundation.in/</loc></url>
  <url><loc>https://spfoundation.in/projects/</loc></url>
  <url><loc>https://spfoundation.in/contact/</loc></url>
  <url><loc>https://spfoundation.in/maintenance-page/</loc></url>
</urlset>
`

const publishedPages = [
  { slug: 'maintenance-page', link: 'https://spfoundation.in/maintenance-page/', title: { rendered: 'Maintenance Page' } },
  { slug: 'financial', link: 'https://spfoundation.in/financial/', title: { rendered: 'Financial' } },
  { slug: 'projects', link: 'https://spfoundation.in/projects/', title: { rendered: 'Projects' } },
  { slug: 'contact', link: 'https://spfoundation.in/contact/', title: { rendered: 'Contact' } },
  { slug: 'about', link: 'https://spfoundation.in/about/', title: { rendered: 'About' } },
  { slug: 'home-1', link: 'https://spfoundation.in/', title: { rendered: 'Home' } },
  { slug: 'blog', link: 'https://spfoundation.in/blog/', title: { rendered: 'Blog' } },
]

test('SP Foundation sentinel pins the verified official first-party surfaces', async () => {
  const spFoundation = await loadModule()
  assert.ok(spFoundation, 'SP Foundation scraper module should load')

  assert.equal(spFoundation.SOURCE, 'spfoundationpvtltd')
  assert.equal(spFoundation.COMPANY, 'S&P Foundation Pvt. Ltd.')
  assert.equal(spFoundation.HOMEPAGE_URL, 'https://spfoundation.in/')
  assert.equal(spFoundation.CONTACT_URL, 'https://spfoundation.in/contact/')
  assert.equal(spFoundation.PAGE_SITEMAP_URL, 'https://spfoundation.in/page-sitemap.xml')
  assert.equal(spFoundation.PAGES_API_URL, 'https://spfoundation.in/wp-json/wp/v2/pages?per_page=100')
  assert.deepEqual(spFoundation.CHECKED_ROUTE_URLS, [
    'https://spfoundation.in/careers',
    'https://spfoundation.in/careers/',
    'https://spfoundation.in/career',
    'https://spfoundation.in/career/',
    'https://spfoundation.in/jobs',
    'https://spfoundation.in/jobs/',
    'https://spfoundation.in/job',
    'https://spfoundation.in/job/',
    'https://spfoundation.in/work-with-us',
    'https://spfoundation.in/work-with-us/',
    'https://spfoundation.in/join-us',
    'https://spfoundation.in/join-us/',
  ])

  assert.equal(spFoundation.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(spFoundation.hasOfficialContactSignal(contactHtml), true)
  assert.equal(spFoundation.hasUnexpectedPublicJobsSignal(homepageHtml), false)
  assert.equal(spFoundation.hasUnexpectedPublicJobsSignal(contactHtml), false)
  assert.equal(spFoundation.hasVerifiedMissingHiringRoute({ status: 404, html: notFoundHtml }), true)
  assert.equal(spFoundation.pageInventoryHasExpectedSurface(publishedPages), true)
  assert.equal(spFoundation.pageInventoryExposesHiringSurface(publishedPages), false)
  assert.equal(spFoundation.pageSitemapHasExpectedSurface(pageSitemapXml), true)
  assert.equal(spFoundation.pageSitemapExposesHiringSurface(pageSitemapXml), false)
})

test('SP Foundation sentinel returns no jobs while the verified public no-listings surface remains unchanged', async () => {
  const spFoundation = await loadModule()
  assert.ok(spFoundation, 'SP Foundation scraper module should load')

  const requestedUrls = []
  const jobs = await spFoundation.createSpFoundationScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === spFoundation.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === spFoundation.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (url === spFoundation.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: pageSitemapXml }
      }

      if (spFoundation.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, spFoundation.PAGES_API_URL)
      return publishedPages
    },
  })

  assert.deepEqual(requestedUrls, [
    spFoundation.HOMEPAGE_URL,
    spFoundation.CONTACT_URL,
    spFoundation.PAGES_API_URL,
    spFoundation.PAGE_SITEMAP_URL,
    ...spFoundation.CHECKED_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('SP Foundation sentinel fails closed when the official public surface drifts or exposes hiring', async () => {
  const spFoundation = await loadModule()
  assert.ok(spFoundation, 'SP Foundation scraper module should load')

   await assert.rejects(
     spFoundation.createSpFoundationScraper().run({
      fetchPage: async () => ({ status: 200, url: spFoundation.HOMEPAGE_URL, html: '<html><body>Placeholder</body></html>' }),
      fetchJson: async () => publishedPages,
    }),
    /official homepage/i,
  )

  await assert.rejects(
    spFoundation.createSpFoundationScraper().run({
      fetchPage: async (url) => {
        if (url === spFoundation.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === spFoundation.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === spFoundation.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
        if (spFoundation.CHECKED_ROUTE_URLS.includes(url)) {
          if (url.endsWith('/careers') || url.endsWith('/careers/')) {
            return {
              status: 200,
              url,
              html: '<html><head><title>Careers - SP Foundation</title></head><body><h1>Current Openings</h1></body></html>',
            }
          }
          return { status: 404, url, html: notFoundHtml }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => publishedPages,
    }),
    /hiring route no longer matches|exposes public jobs/i,
  )

  await assert.rejects(
    spFoundation.createSpFoundationScraper().run({
      fetchPage: async (url) => {
        if (url === spFoundation.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === spFoundation.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === spFoundation.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
        if (spFoundation.CHECKED_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchJson: async () => [
        ...publishedPages,
        { slug: 'careers', link: 'https://spfoundation.in/careers/', title: { rendered: 'Careers' } },
      ],
    }),
    /page inventory/i,
  )
})
