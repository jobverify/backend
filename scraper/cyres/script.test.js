import assert from 'node:assert/strict'
import test from 'node:test'

const loadCyresModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const rootRedirectPage = {
  status: 301,
  url: 'https://cyres.com/',
  location: 'https://www.cyres.com/',
  html: '',
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Cyres &#8211; Building Strong Leaders is Our Passion</title>
  </head>
  <body>
    <nav>
      <a href="https://www.cyres.com/">Home</a>
      <a href="https://www.cyres.com/who-we-help/">Who We Help</a>
      <a href="https://www.cyres.com/connect/">Connect</a>
    </nav>
    <main>
      <h1>Building Strong Leaders is Our Passion</h1>
      <p>Cyres helps leaders and teams grow through coaching, workshops, and assessments.</p>
      <p>Belgium</p>
      <p>Dubai, UAE</p>
      <a href="mailto:info@cyres.com">info@cyres.com</a>
      <a href="tel:+32497339691">+32 497 33 96 91</a>
      <a href="tel:+971503519085">+971 50 351 90 85</a>
    </main>
  </body>
</html>
`

const connectHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Connect &#8211; Cyres</title>
  </head>
  <body>
    <nav>
      <a href="https://www.cyres.com/">Home</a>
      <a href="https://www.cyres.com/who-we-help/">Who We Help</a>
      <a href="https://www.cyres.com/connect/">Connect</a>
    </nav>
    <main>
      <h1>Connect</h1>
      <p>Durmen 80, 9240 Zele, Belgium</p>
      <p>Blue Technologies Office, Gate District B04 DIFC, Dubai, UAE</p>
      <a href="tel:+32497339691">+32 497 33 96 91</a>
      <a href="tel:+971503519085">+971 50 351 90 85</a>
      <a href="mailto:info@cyres.com">info@cyres.com</a>
    </main>
  </body>
</html>
`

const privacyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Privacy Policy &#8211; Cyres</title>
    <link rel="canonical" href="https://www.cyres.com/privacy-policy/" />
  </head>
  <body>
    <main>
      <h1>Privacy Policy</h1>
      <p>Cyres respects your privacy and is committed to protecting personal data.</p>
    </main>
  </body>
</html>
`

const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://www.cyres.com/wp-sitemap-posts-post-1.xml</loc></sitemap>
  <sitemap><loc>https://www.cyres.com/wp-sitemap-posts-page-1.xml</loc></sitemap>
  <sitemap><loc>https://www.cyres.com/wp-sitemap-posts-portfolio-item-1.xml</loc></sitemap>
</sitemapindex>
`

const pageSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.cyres.com/privacy-policy/</loc></url>
  <url><loc>https://www.cyres.com/</loc></url>
  <url><loc>https://www.cyres.com/who-we-help/</loc></url>
  <url><loc>https://www.cyres.com/connect/</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://www.cyres.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>Page not found &#8211; Cyres</title></head>
      <body>
        <h1>Page not found</h1>
        <p>Cyres could not find this page.</p>
      </body>
    </html>
  `,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.cyres.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>Careers &#8211; Cyres</title></head>
      <body>
        <h1>Current Openings</h1>
        <a href="/careers/executive-coach">Apply Now</a>
      </body>
    </html>
  `,
}

test('CYRES sentinel recognizes the verified domain bridge, homepage, connect page, privacy page, sitemaps, and missing careers routes', async () => {
  const cyres = await loadCyresModule()
  assert.ok(cyres, 'Expected scraper module at ./script.js')

  assert.equal(cyres.SOURCE, 'cyres')
  assert.equal(cyres.COMPANY, 'CYRES')
  assert.equal(cyres.ROOT_URL, 'https://cyres.com/')
  assert.equal(cyres.HOMEPAGE_URL, 'https://www.cyres.com/')
  assert.equal(cyres.CONNECT_URL, 'https://www.cyres.com/connect/')
  assert.equal(cyres.PRIVACY_URL, 'https://www.cyres.com/privacy-policy/')
  assert.equal(cyres.SITEMAP_INDEX_URL, 'https://www.cyres.com/sitemap.xml')
  assert.equal(cyres.PAGE_SITEMAP_URL, 'https://www.cyres.com/wp-sitemap-posts-page-1.xml')
  assert.deepEqual(cyres.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.cyres.com/careers',
    'https://www.cyres.com/career',
    'https://www.cyres.com/jobs',
    'https://www.cyres.com/job',
    'https://www.cyres.com/join-us',
    'https://www.cyres.com/work-with-us',
  ])
  assert.equal(cyres.hasVerifiedRootRedirect(rootRedirectPage), true)
  assert.equal(cyres.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(cyres.hasOfficialConnectSignal(connectHtml), true)
  assert.equal(cyres.hasOfficialPrivacySignal(privacyHtml), true)
  assert.equal(cyres.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(cyres.hasPublicJobsSignal(connectHtml), false)
  assert.equal(cyres.hasPublicJobsSignal(privacyHtml), false)
  assert.equal(cyres.pageHasCareerLikeLink(homepageHtml), false)
  assert.equal(cyres.pageHasCareerLikeLink(connectHtml), false)
  assert.equal(cyres.sitemapIndexHasExpectedPageSitemap(sitemapIndexXml), true)
  assert.equal(cyres.sitemapHasUnexpectedCareerLikeUrl(sitemapIndexXml), false)
  assert.equal(cyres.sitemapHasUnexpectedCareerLikeUrl(pageSitemapXml), false)
  assert.equal(cyres.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('CYRES sentinel returns no jobs only while the verified first-party surfaces stay careers-free', async () => {
  const cyres = await loadCyresModule()
  assert.ok(cyres, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await cyres.createCyresScraper().run({
    fetchPage: async (url, options = {}) => {
      requestedUrls.push([url, options.redirect || 'follow'])
      if (url === cyres.ROOT_URL) return rootRedirectPage
      if (url === cyres.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === cyres.CONNECT_URL) return { status: 200, url, html: connectHtml }
      if (url === cyres.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
      if (url === cyres.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
      if (url === cyres.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
      if (cyres.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    [cyres.ROOT_URL, 'manual'],
    [cyres.HOMEPAGE_URL, 'follow'],
    [cyres.CONNECT_URL, 'follow'],
    [cyres.PRIVACY_URL, 'follow'],
    [cyres.SITEMAP_INDEX_URL, 'follow'],
    [cyres.PAGE_SITEMAP_URL, 'follow'],
    ...cyres.NO_PUBLIC_CAREERS_ROUTE_URLS.map((url) => [url, 'follow']),
  ])
  assert.deepEqual(jobs, [])
})

test('CYRES sentinel fails closed when the verified no-public-careers contract drifts', async () => {
  const cyres = await loadCyresModule()
  assert.ok(cyres, 'Expected scraper module at ./script.js')

  await assert.rejects(
    cyres.createCyresScraper().run({
      fetchPage: async (url) => {
        if (url === cyres.ROOT_URL) return { ...rootRedirectPage, location: 'https://example.com/' }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /root redirect/i,
  )

  await assert.rejects(
    cyres.createCyresScraper().run({
      fetchPage: async (url) => {
        if (url === cyres.ROOT_URL) return rootRedirectPage
        if (url === cyres.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === cyres.CONNECT_URL) return { status: 200, url, html: connectHtml }
        if (url === cyres.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === cyres.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === cyres.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml.replace('</urlset>', '<url><loc>https://www.cyres.com/careers</loc></url></urlset>'),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified page sitemap/i,
  )

  await assert.rejects(
    cyres.createCyresScraper().run({
      fetchPage: async (url) => {
        if (url === cyres.ROOT_URL) return rootRedirectPage
        if (url === cyres.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === cyres.CONNECT_URL) return { status: 200, url, html: connectHtml }
        if (url === cyres.PRIVACY_URL) return { status: 200, url, html: privacyHtml }
        if (url === cyres.SITEMAP_INDEX_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === cyres.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
        if (url === cyres.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsPage
        if (cyres.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
