import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Brysa AI | Salesforce Consulting, AI &amp; Digital Transformation Experts</title>
    <link rel="canonical" href="https://brysa.ai" />
  </head>
  <body>
    <nav><a href="/about-us">About</a><a href="/contact-us">Contact</a></nav>
    <h1>Helping you find your flow</h1>
    <p>Salesforce Consulting Services and AI transformation experts.</p>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Brysa | Salesforce, AI &amp; Digital Transformation Experts</title>
    <link rel="canonical" href="https://brysa.ai/about-us" />
  </head>
  <body>
    <h1>Blending domain expertise with tech to help you unlock your team's true potential and find your flow</h1>
    <p>We are a people-first Salesforce Consulting Company.</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Get in Touch with Brysa for Crm and Salesforce Support Today</title>
    <link rel="canonical" href="https://brysa.ai/contact-us" />
  </head>
  <body>
    <h1>Get in touch with us</h1>
    <p>Contact Us</p>
  </body>
</html>
`

const sitemapXml = `
<urlset>
  <url><loc>https://brysa.ai/</loc></url>
  <url><loc>https://brysa.ai/about-us</loc></url>
  <url><loc>https://brysa.ai/contact-us</loc></url>
</urlset>
`

const missingRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Error 404 | Page not found</title>
    <link rel="canonical" href="https://brysa.ai/404" />
  </head>
  <body>
    <h1>Page not found</h1>
    <p>We can't find the page you were looking for.</p>
  </body>
</html>
`

const loadBrysaModule = async () => {
  try {
    return await import('../../scraper/brysa/script.js')
  } catch {
    assert.fail('Expected Brysa scraper module at ../../scraper/brysa/script.js')
  }
}

test('Brysa recognizes the current official pages and missing careers route sentinel', async () => {
  const brysa = await loadBrysaModule()

  assert.equal(brysa.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(brysa.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(brysa.hasOfficialContactSignal(contactHtml), true)
  assert.equal(brysa.sitemapHasCareerLikeUrl(sitemapXml), false)
  assert.equal(brysa.isVerifiedMissingCareersRoute({
    status: 404,
    url: 'https://brysa.ai/careers',
    html: missingRouteHtml,
  }), true)
})

test('Brysa returns no jobs only after validating official no-public-careers surfaces', async () => {
  const brysa = await loadBrysaModule()
  const requested = []

  const jobs = await brysa.createBrysaScraper().run({
    fetchPage: async (url) => {
      requested.push(url)
      if (url === brysa.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === brysa.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === brysa.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === brysa.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      return { status: 404, url, html: missingRouteHtml }
    },
  })

  assert.deepEqual(requested, [
    brysa.HOMEPAGE_URL,
    brysa.ABOUT_URL,
    brysa.CONTACT_URL,
    brysa.SITEMAP_URL,
    ...brysa.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})
