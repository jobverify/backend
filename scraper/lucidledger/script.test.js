import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Lucid Ledger scraper module at ./script.js')
  }
}

const wixConnectYourDomainHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>ConnectYourDomain Error | Wix.com</title>
  <link rel="stylesheet" href="//static.parastorage.com/services/classic-error-pages-statics/1.90.0/app.min.css">
</head>
<body>
  <div id="root"></div>
  <script>
    window.__LOCALE__ = 'en';
    window.__ERROR_DATA__ = {
      staticsUrl: '//static.parastorage.com/services/classic-error-pages-statics/1.90.0/',
      baseDomain: 'wix.com',
      errorCode: 'ConnectYourDomain',
      exceptionName: '',
      serverErrorCode: '404',
      data: {},
      brand: 'wix',
      requestId: '1783897738.220693335841365'
    };
  </script>
  <script src="//static.parastorage.com/services/classic-error-pages-statics/1.90.0/app.bundle.min.js"></script>
</body>
</html>
`

const publicJobsHtml = `
<html>
  <head>
    <title>Careers | Lucid Ledger</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <p>Join our team</p>
    <a href="/jobs/platform-engineer">Apply now</a>
  </body>
</html>
`

test('Lucid Ledger sentinel pins the verified first-party ConnectYourDomain shell from July 13, 2026', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'lucidledger')
  assert.equal(scraper.COMPANY, 'Lucid Ledger')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.deepEqual(scraper.HOMEPAGE_URLS, [
    'https://lucidledger.com/',
    'https://www.lucidledger.com/',
  ])
  assert.deepEqual(scraper.SITEMAP_URLS, [
    'https://lucidledger.com/sitemap.xml',
    'https://www.lucidledger.com/sitemap.xml',
  ])
  assert.deepEqual(scraper.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://lucidledger.com/careers',
    'https://www.lucidledger.com/careers',
    'https://lucidledger.com/jobs',
    'https://www.lucidledger.com/jobs',
    'https://lucidledger.com/join-us',
    'https://www.lucidledger.com/join-us',
  ])

  assert.equal(scraper.hasConnectYourDomainSignal(wixConnectYourDomainHtml), true)
  assert.equal(scraper.hasPublicJobsSignal(wixConnectYourDomainHtml), false)
  assert.equal(
    scraper.isVerifiedConnectYourDomainPage({
      status: 404,
      url: scraper.HOMEPAGE_URLS[0],
      html: wixConnectYourDomainHtml,
    }),
    true,
  )
  assert.equal(
    scraper.isVerifiedConnectYourDomainPage({
      status: 200,
      url: scraper.HOMEPAGE_URLS[0],
      html: publicJobsHtml,
    }),
    false,
  )
})

test('Lucid Ledger sentinel returns [] only while the verified first-party surface stays on the Wix ConnectYourDomain shell', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createLucidLedgerScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 404,
        url,
        html: wixConnectYourDomainHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    ...scraper.HOMEPAGE_URLS,
    ...scraper.SITEMAP_URLS,
    ...scraper.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Lucid Ledger sentinel fails closed when the verified first-party surface starts exposing jobs or drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createLucidLedgerScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.HOMEPAGE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Unexpected live site</h1></body></html>',
          }
        }

        return {
          status: 404,
          url,
          html: wixConnectYourDomainHtml,
        }
      },
    }),
    /verified homepage shell changed/i,
  )

  await assert.rejects(
    scraper.createLucidLedgerScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: publicJobsHtml,
          }
        }

        return {
          status: 404,
          url,
          html: wixConnectYourDomainHtml,
        }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
