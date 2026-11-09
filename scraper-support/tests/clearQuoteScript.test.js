import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Reducing fleet damage for commercial and rental fleets | ClearQuote</title>
      <link rel="canonical" href="https://clearquote.io/" />
    </head>
    <body>
      <h1>ClearQuote</h1>
      <p>Eliminate unreported fleet damage without manual work.</p>
      <a href="https://clearquote.io/contact">Contact</a>
    </body>
  </html>
`

const pageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://clearquote.io/</loc></url>
    <url><loc>https://clearquote.io/privacy-policy/</loc></url>
    <url><loc>https://clearquote.io/fulfilment-policy/</loc></url>
  </urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://clearquote.io/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>Page not found - ClearQuote</title></head>
      <body>
        <h1>Page not found</h1>
        <p>ClearQuote</p>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/clearquote/script.js')
  } catch {
    assert.fail('Expected ClearQuote scraper module at ../../scraper/clearquote/script.js')
  }
}

test('ClearQuote sentinel pins the verified first-party no-public-jobs surface', async () => {
  const clearquote = await loadModule()

  assert.equal(clearquote.SOURCE, 'clearquote')
  assert.equal(clearquote.COMPANY, 'ClearQuote')
  assert.equal(clearquote.HOMEPAGE_URL, 'https://clearquote.io/')
  assert.equal(clearquote.PAGE_SITEMAP_URL, 'https://clearquote.io/page-sitemap.xml')
  assert.deepEqual(clearquote.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://clearquote.io/careers',
    'https://clearquote.io/careers/',
    'https://clearquote.io/jobs',
    'https://clearquote.io/jobs/',
  ])
  assert.equal(clearquote.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(clearquote.hasOfficialPageSitemapSignal(pageSitemapXml), true)
  assert.equal(clearquote.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(clearquote.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('ClearQuote sentinel returns no jobs only while the verified first-party surfaces stay unchanged', async () => {
  const clearquote = await loadModule()
  const requestedUrls = []

  const jobs = await clearquote.createClearQuoteScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === clearquote.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === clearquote.PAGE_SITEMAP_URL) return { status: 200, url, html: pageSitemapXml }
      if (clearquote.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected ClearQuote URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    clearquote.HOMEPAGE_URL,
    clearquote.PAGE_SITEMAP_URL,
    ...clearquote.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('ClearQuote sentinel fails closed when the verified no-public-careers contract drifts', async () => {
  const clearquote = await loadModule()

  await assert.rejects(
    clearquote.createClearQuoteScraper().run({
      fetchPage: async (url) => {
        if (url === clearquote.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><a href="/careers/software-engineer">Apply now</a></body></html>',
          }
        }
        throw new Error(`Unexpected ClearQuote URL: ${url}`)
      },
    }),
    /homepage/i,
  )
})
