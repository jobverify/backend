import assert from 'node:assert/strict'
import test from 'node:test'

const loadShopconnectModule = async () => {
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
    <title>Shopconnect</title>
  </head>
  <body>
    <main>
      <h1>Shopconnect</h1>
      <p>Your shopping and affiliate storefront destination.</p>
      <p>Amazon Associates Program participant.</p>
    </main>
  </body>
</html>
`

const sitemapIndexXml = `
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://www.shopconnect.in/wp-sitemap-posts-page-1.xml</loc>
  </sitemap>
</sitemapindex>
`

const pageSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.shopconnect.in/</loc></url>
  <url><loc>https://www.shopconnect.in/shop/</loc></url>
  <url><loc>https://www.shopconnect.in/cart/</loc></url>
  <url><loc>https://www.shopconnect.in/checkout/</loc></url>
  <url><loc>https://www.shopconnect.in/my-account/</loc></url>
  <url><loc>https://www.shopconnect.in/blog-page/</loc></url>
</urlset>
`

const emptySearchJson = '[]'

const missingRoutePage = {
  status: 404,
  url: 'https://www.shopconnect.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Page not found - Shopconnect</title>
      </head>
      <body>
        <h1>Page not found</h1>
      </body>
    </html>
  `,
}

const liveLikeMissingRoutePage = {
  status: 404,
  url: 'https://www.shopconnect.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Page not found &#8211; Shopconnect</title>
      </head>
      <body>
        <h1>This page could not be found!</h1>
        <p>We are sorry. But the page you are looking for is not available.</p>
      </body>
    </html>
  `,
}

const blockedRoutePage = {
  status: 406,
  url: 'https://www.shopconnect.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Not Acceptable!</title>
      </head>
      <body>
        <h1>Not Acceptable!</h1>
      </body>
    </html>
  `,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.shopconnect.in/careers',
  html: `
    <html>
      <head>
        <title>Careers - Shopconnect</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <a href="/apply">Apply now</a>
      </body>
    </html>
  `,
}

test('Shopconnect sentinel recognizes the verified homepage, sitemap chain, empty WordPress search endpoints, and hard-404 careers routes', async () => {
  const shopconnect = await loadShopconnectModule()
  assert.ok(shopconnect, 'Expected scraper module at ./script.js')

  assert.equal(shopconnect.SOURCE, 'shopconnect')
  assert.equal(shopconnect.COMPANY, 'Shopconnect')
  assert.equal(shopconnect.HOMEPAGE_URL, 'https://www.shopconnect.in/')
  assert.equal(shopconnect.SITEMAP_URL, 'https://www.shopconnect.in/sitemap.xml')
  assert.equal(shopconnect.PAGE_SITEMAP_URL, 'https://www.shopconnect.in/wp-sitemap-posts-page-1.xml')
  assert.deepEqual(shopconnect.WORDPRESS_SEARCH_URLS, [
    'https://www.shopconnect.in/wp-json/wp/v2/pages?search=career&per_page=50',
    'https://www.shopconnect.in/wp-json/wp/v2/posts?search=career&per_page=50',
    'https://www.shopconnect.in/wp-json/wp/v2/pages?search=job&per_page=50',
    'https://www.shopconnect.in/wp-json/wp/v2/posts?search=job&per_page=50',
  ])
  assert.deepEqual(shopconnect.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.shopconnect.in/careers',
    'https://www.shopconnect.in/careers/',
    'https://www.shopconnect.in/career',
    'https://www.shopconnect.in/career/',
    'https://www.shopconnect.in/jobs',
    'https://www.shopconnect.in/jobs/',
    'https://www.shopconnect.in/job',
    'https://www.shopconnect.in/job/',
    'https://www.shopconnect.in/join-us',
    'https://www.shopconnect.in/join-us/',
  ])
  assert.equal(shopconnect.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(shopconnect.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(shopconnect.sitemapPointsToVerifiedPageSitemap(sitemapIndexXml), true)
  assert.equal(shopconnect.sitemapHasCareerLikeUrl(pageSitemapXml), false)
  assert.equal(shopconnect.isVerifiedEmptyWordPressSearchResult(emptySearchJson), true)
  assert.equal(shopconnect.isVerifiedMissingCareerRoute(missingRoutePage), true)
  assert.equal(shopconnect.isVerifiedMissingCareerRoute(liveLikeMissingRoutePage), true)
})

test('Shopconnect sentinel returns no jobs only while the verified public surface exposes no careers board', async () => {
  const shopconnect = await loadShopconnectModule()
  assert.ok(shopconnect, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await shopconnect.createShopconnectScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === shopconnect.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === shopconnect.SITEMAP_URL) return { status: 200, url, html: sitemapIndexXml }
      if (url === shopconnect.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
      if (shopconnect.WORDPRESS_SEARCH_URLS.includes(url)) return { status: 200, url, html: emptySearchJson }
      if (shopconnect.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    shopconnect.HOMEPAGE_URL,
    shopconnect.SITEMAP_URL,
    shopconnect.PAGE_SITEMAP_URL,
    ...shopconnect.WORDPRESS_SEARCH_URLS,
    ...shopconnect.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Shopconnect sentinel can recover with a browser-backed fetch when direct requests only return 406 block pages', async () => {
  const shopconnect = await loadShopconnectModule()
  assert.ok(shopconnect, 'Expected scraper module at ./script.js')

  const browserUrls = []
  const jobs = await shopconnect.createShopconnectScraper().run({
    fetchPage: async (url) => ({ ...blockedRoutePage, url }),
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)
      if (url === shopconnect.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === shopconnect.SITEMAP_URL) return { status: 200, url, html: sitemapIndexXml }
      if (url === shopconnect.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
      if (shopconnect.WORDPRESS_SEARCH_URLS.includes(url)) return { status: 200, url, html: emptySearchJson }
      if (shopconnect.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingRoutePage, url }
      throw new Error(`Unexpected browser URL: ${url}`)
    },
  })

  assert.deepEqual(browserUrls, [
    shopconnect.HOMEPAGE_URL,
    shopconnect.SITEMAP_URL,
    shopconnect.PAGE_SITEMAP_URL,
    ...shopconnect.WORDPRESS_SEARCH_URLS,
    ...shopconnect.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Shopconnect sentinel fails closed when the sitemap, WordPress search, or careers routes drift into a public jobs surface', async () => {
  const shopconnect = await loadShopconnectModule()
  assert.ok(shopconnect, 'Expected scraper module at ./script.js')

  await assert.rejects(
    shopconnect.createShopconnectScraper().run({
      fetchPage: async (url) => {
        if (url === shopconnect.HOMEPAGE_URL) return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    shopconnect.createShopconnectScraper().run({
      fetchPage: async (url) => {
        if (url === shopconnect.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === shopconnect.SITEMAP_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === shopconnect.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: pageSitemapXml.replace('</urlset>', '<url><loc>https://www.shopconnect.in/careers/</loc></url></urlset>'),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    shopconnect.createShopconnectScraper().run({
      fetchPage: async (url) => {
        if (url === shopconnect.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === shopconnect.SITEMAP_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === shopconnect.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
        if (url === shopconnect.WORDPRESS_SEARCH_URLS[0]) return { status: 200, url, html: '[{"id":1}]' }
        if (shopconnect.WORDPRESS_SEARCH_URLS.slice(1).includes(url)) return { status: 200, url, html: emptySearchJson }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified wordpress search surface/i,
  )

  await assert.rejects(
    shopconnect.createShopconnectScraper().run({
      fetchPage: async (url) => {
        if (url === shopconnect.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === shopconnect.SITEMAP_URL) return { status: 200, url, html: sitemapIndexXml }
        if (url === shopconnect.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
        if (shopconnect.WORDPRESS_SEARCH_URLS.includes(url)) return { status: 200, url, html: emptySearchJson }
        if (url === shopconnect.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsPage
        if (shopconnect.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingRoutePage, url }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
