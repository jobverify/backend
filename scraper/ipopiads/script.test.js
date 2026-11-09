import assert from 'node:assert/strict'
import test from 'node:test'

const loadIpopiModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const legacyRedirectPage = {
  status: 302,
  url: 'https://ipopiads.com',
  location: 'https://www.ipopi.in/',
  html: '',
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Leading Digital Marketing Agency in Mysore & Bangalore | Expert SEO & Social Media Marketing</title>
  </head>
  <body>
    <nav>
      <a href="https://www.ipopi.in/">Home</a>
      <a href="https://www.ipopi.in/blog/">Our Blog</a>
    </nav>
    <main>
      <h1>#1 Digital Marketing Company</h1>
      <p>#AllRound Digital Marketing for 350+ Companies Pan India</p>
      <p>We collaborate with ambitious brands and people; we'd love to build something great together.</p>
      <p>sales@ipopi.in | +91 963 272 4344 | 08031 404 407</p>
      <p>Corporate Office 42/10, 11th Main, Padmanabhanagar, Bangalore, Karnataka 560070</p>
      <p>Delivery Office #4575, Second Floor, High Tension Double Rd, Vijay Nagar 2nd Stage, Mysuru, Karnataka 570017</p>
      <a href="https://www.ipopi.in/terms-and-conditions.php">T &amp; C</a>
      <a href="https://www.ipopi.in/privacy-policy.php">Privacy Policy</a>
      <p>&copy; 2024 ipopi Ads. All rights reserved.</p>
    </main>
  </body>
</html>
`

const privacyHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Privacy Policy</h2>
    <p>Company (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to Ipopi Ads, #4575, Second Floor, High Tension Double Rd, Vijay Nagar 2nd Stage, Mysuru, Karnataka 570017.</p>
    <p>Website refers to Ipopi Ads, accessible from https://www.ipopi.in/</p>
    <p>Country refers to: Karnataka, India</p>
  </body>
</html>
`

const termsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Terms and Conditions - Ipopi Ads</title>
  </head>
  <body>
    <p>Last updated: June 13, 2024</p>
    <h2>Terms and Conditions</h2>
    <p><strong>Country</strong> refers to: Kerala, India</p>
    <p><strong>Company</strong> (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to Ipopi Ads, #4575, Second Floor, High Tension Double Rd, Vijay Nagar 2nd Stage, Mysuru, Karnataka 570017.</p>
    <p>If you have any questions about these Terms and Conditions, You can contact us: info@ipopi.in</p>
    <p>&copy; 2024 ipopi Ads. All rights reserved.</p>
  </body>
</html>
`

const blogHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ipopi Ads Blog -</title>
  </head>
  <body>
    <nav>
      <a href="https://www.ipopi.in/">Home</a>
      <a href="https://www.ipopi.in/blog/">Our Blog</a>
    </nav>
    <h1>Ipopi Ads Blog</h1>
    <h2>Latest Posts</h2>
    <p>Digital marketing insights, automotive growth stories, and campaign updates.</p>
  </body>
</html>
`

const robotsTxt = `
User-agent: *
Disallow: /alr/
Disallow: /_extra/

Sitemap: http://ipopi.in/sitemap.xml
`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ipopi.in/</loc></url>
  <url><loc>https://www.ipopi.in/</loc></url>
  <url><loc>https://www.ipopi.in/index.html</loc></url>
  <url><loc>https://www.ipopi.in/blog/</loc></url>
  <url><loc>https://www.ipopi.in/blog/category/digital-marketing/</loc></url>
  <url><loc>https://www.ipopi.in/blog/author/ipopiads/</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://www.ipopi.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>404 Not Found</title></head>
      <body><h1>404 Not Found</h1></body>
    </html>
  `,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.ipopi.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>Careers | Ipopi Ads</title></head>
      <body>
        <h1>Current Openings</h1>
        <a href="/careers/seo-specialist">Apply Now</a>
      </body>
    </html>
  `,
}

test('Ipopi Ads sentinel recognizes the verified domain bridge, legal pages, sitemap, and missing careers routes', async () => {
  const ipopi = await loadIpopiModule()
  assert.ok(ipopi, 'Expected scraper module at ./script.js')

  assert.equal(ipopi.SOURCE, 'ipopiads')
  assert.equal(ipopi.COMPANY, 'Ipopi Ads')
  assert.equal(ipopi.VERIFIED_ON, '2026-08-07')
  assert.equal(ipopi.LEGACY_COMPANY_URL, 'https://ipopiads.com')
  assert.equal(ipopi.HOMEPAGE_URL, 'https://www.ipopi.in/')
  assert.equal(ipopi.PRIVACY_URL, 'https://www.ipopi.in/privacy-policy.php')
  assert.equal(ipopi.TERMS_URL, 'https://www.ipopi.in/terms-and-conditions.php')
  assert.equal(ipopi.BLOG_URL, 'https://www.ipopi.in/blog/')
  assert.equal(ipopi.ROBOTS_URL, 'https://www.ipopi.in/robots.txt')
  assert.equal(ipopi.SITEMAP_URL, 'https://www.ipopi.in/sitemap.xml')
  assert.deepEqual(ipopi.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.ipopi.in/careers',
    'https://www.ipopi.in/career',
    'https://www.ipopi.in/jobs',
    'https://www.ipopi.in/job',
    'https://www.ipopi.in/work-with-us',
    'https://www.ipopi.in/join-us',
  ])
  assert.equal(ipopi.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ipopi.hasOfficialPrivacySignal(privacyHtml), true)
  assert.equal(ipopi.hasOfficialTermsSignal(termsHtml), true)
  assert.equal(ipopi.hasOfficialBlogSignal(blogHtml), true)
  assert.equal(ipopi.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(ipopi.homepageHasCareerLikeLink(homepageHtml), false)
  assert.equal(ipopi.robotsHasExpectedSitemapSignal(robotsTxt), true)
  assert.equal(ipopi.sitemapHasCareerLikeUrl(sitemapXml), false)
  assert.equal(ipopi.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('Ipopi Ads sentinel returns no jobs only while the verified first-party surfaces stay careers-free', async () => {
  const ipopi = await loadIpopiModule()
  assert.ok(ipopi, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await ipopi.createIpopiAdsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === ipopi.LEGACY_COMPANY_URL) return legacyRedirectPage
      if (url === ipopi.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === ipopi.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
      if (url === ipopi.TERMS_URL) return { status: 200, url, html: termsHtml }
      if (url === ipopi.BLOG_URL) return { status: 200, url, html: blogHtml }
      if (url === ipopi.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
      if (url === ipopi.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (ipopi.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ipopi.LEGACY_COMPANY_URL,
    ipopi.HOMEPAGE_URL,
    ipopi.PRIVACY_URL,
    ipopi.TERMS_URL,
    ipopi.BLOG_URL,
    ipopi.ROBOTS_URL,
    ipopi.SITEMAP_URL,
    ...ipopi.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Ipopi Ads sentinel fails closed when the verified careers-free contract drifts', async () => {
  const ipopi = await loadIpopiModule()
  assert.ok(ipopi, 'Expected scraper module at ./script.js')

  await assert.rejects(
    ipopi.createIpopiAdsScraper().run({
      fetchPage: async (url) => {
        if (url === ipopi.LEGACY_COMPANY_URL) return { ...legacyRedirectPage, location: 'https://example.com/' }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy domain bridge/i,
  )

  await assert.rejects(
    ipopi.createIpopiAdsScraper().run({
      fetchPage: async (url) => {
        if (url === ipopi.LEGACY_COMPANY_URL) return legacyRedirectPage
        if (url === ipopi.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ipopi.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === ipopi.TERMS_URL) return { status: 200, url, html: termsHtml }
        if (url === ipopi.BLOG_URL) return { status: 200, url, html: blogHtml }
        if (url === ipopi.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
        if (url === ipopi.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace('</urlset>', '<url><loc>https://www.ipopi.in/careers</loc></url></urlset>'),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    ipopi.createIpopiAdsScraper().run({
      fetchPage: async (url) => {
        if (url === ipopi.LEGACY_COMPANY_URL) return legacyRedirectPage
        if (url === ipopi.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ipopi.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === ipopi.TERMS_URL) return { status: 200, url, html: termsHtml }
        if (url === ipopi.BLOG_URL) return { status: 200, url, html: blogHtml }
        if (url === ipopi.ROBOTS_URL) return { status: 200, url, html: robotsTxt }
        if (url === ipopi.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === ipopi.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsPage
        if (ipopi.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
