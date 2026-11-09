import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home - SP Foundation</title>
    <meta
      name="description"
      content="SP Foundation, an initiative by SPC intends to cure, serve and care for communities."
    >
    <meta property="og:site_name" content="SP Foundation">
  </head>
  <body>
    <nav>
      <a href="https://spfoundation.in/about/">About</a>
      <a href="https://spfoundation.in/contact/">Contact</a>
    </nav>
    <p>Register to join us as a Volunteer</p>
    <h2>Care, Serve and Cure.</h2>
  </body>
</html>
`

const CONTACT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact - SP Foundation</title>
    <meta property="og:site_name" content="SP Foundation">
  </head>
  <body>
    <p>Plot No. 284/1,2 &amp; 3 GIDC Estate, Makarpura, Vadodara &#8211; 390010, Gujarat &#8211; India.</p>
    <p>info@spfoundation.in</p>
    <p>MONDAY - SATURDAY : 9:00AM TO 6:00PM</p>
    <p>© Copyright 2022 by SP Foundation</p>
  </body>
</html>
`

const PAGE_SITEMAP_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://spfoundation.in/</loc></url>
  <url><loc>https://spfoundation.in/projects/</loc></url>
  <url><loc>https://spfoundation.in/contact/</loc></url>
</urlset>
`

const PAGE_INVENTORY = [
  { slug: 'maintenance-page', link: 'https://spfoundation.in/maintenance-page/', title: { rendered: 'Maintenance Page' } },
  { slug: 'financial', link: 'https://spfoundation.in/financial/', title: { rendered: 'Financial' } },
  { slug: 'projects', link: 'https://spfoundation.in/projects/', title: { rendered: 'Projects' } },
  { slug: 'contact', link: 'https://spfoundation.in/contact/', title: { rendered: 'Contact' } },
  { slug: 'about', link: 'https://spfoundation.in/about/', title: { rendered: 'About' } },
  { slug: 'home-1', link: 'https://spfoundation.in/', title: { rendered: 'Home' } },
]

const VERIFIED_404_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found - SP Foundation</title>
    <meta property="og:title" content="Page not found - SP Foundation">
  </head>
  <body class="error404">
    <h1>Ohh! Page Not Found</h1>
    <form role="search" action="https://spfoundation.in/">
      <input type="search" name="s">
    </form>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/spfoundationpvtltd/script.js')
  } catch {
    assert.fail('Expected SP Foundation scraper module at ../../scraper/spfoundationpvtltd/script.js')
  }
}

test('SP Foundation helpers stay pinned to the verified homepage, contact page, inventory, sitemap, and hiring-route 404 contract', async () => {
  const spFoundation = await loadScriptModule()

  assert.equal(spFoundation.SOURCE, 'spfoundationpvtltd')
  assert.equal(spFoundation.COMPANY, 'S&P Foundation Pvt. Ltd.')
  assert.equal(spFoundation.HOMEPAGE_URL, 'https://spfoundation.in/')
  assert.equal(spFoundation.CONTACT_URL, 'https://spfoundation.in/contact/')
  assert.equal(spFoundation.PAGES_API_URL, 'https://spfoundation.in/wp-json/wp/v2/pages?per_page=100')
  assert.equal(spFoundation.PAGE_SITEMAP_URL, 'https://spfoundation.in/page-sitemap.xml')
  assert.equal(spFoundation.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(spFoundation.hasOfficialContactSignal(CONTACT_HTML), true)
  assert.equal(spFoundation.pageInventoryHasExpectedSurface(PAGE_INVENTORY), true)
  assert.equal(spFoundation.pageSitemapHasExpectedSurface(PAGE_SITEMAP_XML), true)
  assert.equal(
    spFoundation.hasVerifiedMissingHiringRoute({ status: 404, html: VERIFIED_404_HTML }),
    true,
  )
})

test('SP Foundation returns [] while its public first-party surfaces still expose no hiring pages', async () => {
  const spFoundation = await loadScriptModule()
  const requestedPageUrls = []
  const requestedJsonUrls = []

  const jobs = await spFoundation.createSpFoundationScraper().run({
    fetchPage: async (url) => {
      requestedPageUrls.push(url)
      if (url === spFoundation.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }
      if (url === spFoundation.CONTACT_URL) {
        return { status: 200, url, html: CONTACT_HTML }
      }
      if (url === spFoundation.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: PAGE_SITEMAP_XML }
      }
      if (spFoundation.CHECKED_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: VERIFIED_404_HTML }
      }
      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === spFoundation.PAGES_API_URL) return PAGE_INVENTORY
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedJsonUrls, [spFoundation.PAGES_API_URL])
  assert.equal(requestedPageUrls[0], spFoundation.HOMEPAGE_URL)
  assert.equal(requestedPageUrls[1], spFoundation.CONTACT_URL)
  assert.ok(requestedPageUrls.includes(spFoundation.PAGE_SITEMAP_URL))
  assert.deepEqual(jobs, [])
})

test('SP Foundation fails closed when its contact page or public page inventory starts exposing hiring drift', async () => {
  const spFoundation = await loadScriptModule()

  await assert.rejects(
    spFoundation.createSpFoundationScraper().run({
      fetchPage: async (url) => {
        if (url === spFoundation.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
        if (url === spFoundation.CONTACT_URL) {
          return { status: 200, url, html: '<html><head><title>Contact - SP Foundation</title></head><body>Placeholder</body></html>' }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => PAGE_INVENTORY,
    }),
    /official contact page no longer matches the verified public surface/i,
  )

  await assert.rejects(
    spFoundation.createSpFoundationScraper().run({
      fetchPage: async (url) => {
        if (url === spFoundation.HOMEPAGE_URL) return { status: 200, url, html: HOMEPAGE_HTML }
        if (url === spFoundation.CONTACT_URL) return { status: 200, url, html: CONTACT_HTML }
        if (url === spFoundation.PAGE_SITEMAP_URL) return { status: 200, url, html: PAGE_SITEMAP_XML }
        if (spFoundation.CHECKED_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: VERIFIED_404_HTML }
        }
        throw new Error(`Unexpected page URL: ${url}`)
      },
      fetchJson: async () => [
        ...PAGE_INVENTORY,
        { slug: 'careers', link: 'https://spfoundation.in/careers/', title: { rendered: 'Careers' } },
      ],
    }),
    /official page inventory no longer matches the verified public no-listings surface/i,
  )
})
