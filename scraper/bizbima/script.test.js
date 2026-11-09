import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected BizBima scraper module at ./script.js')
  }
}

const parkedHomepageHtml = `
  <html lang="en">
    <head>
      <title>BizBima.com for sale | Spaceship.com</title>
      <meta name="description" content="BizBima.com is for sale on Spaceship. Secure checkout and quick transfer. See all purchase options. No hidden fees.">
      <meta property="og:title" content="Buy BizBima.com | Spaceship">
      <meta property="og:description" content="Own BizBima.com today. Secure checkout and guided transfer support. No hidden fees.">
      <link rel="canonical" href="https://bizbima.com">
    </head>
    <body>
      <p>Domain for sale</p>
      <h1>BizBima.com</h1>
      <p>Listed with <strong>spaceship.com</strong></p>
      <script>
        window.DOMAIN_CONFIG = {
          domainUrl: 'https://bizbima.com',
          domainName: 'BizBima.com',
          marketPlaceDomainId: '8b7b67dd-a1bf-4d62-86cc-ecf37e59d5d1'
        }
      </script>
    </body>
  </html>
`

const robotsTxt = `
User-agent: *
Allow: /
`

test('BizBima sentinel pins the verified parked first-party homepage surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'bizbima')
  assert.equal(scraper.COMPANY, 'BizBima')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(scraper.HOMEPAGE_URL, 'https://bizbima.com/')
  assert.equal(scraper.WWW_HOMEPAGE_URL, 'https://www.bizbima.com/')
  assert.equal(scraper.ROBOTS_URL, 'https://bizbima.com/robots.txt')
  assert.equal(scraper.hasParkedHomepageSignal(parkedHomepageHtml), true)
  assert.equal(scraper.hasOpenRobotsSignal(robotsTxt), true)
  assert.equal(scraper.hasPublicJobsSignal(parkedHomepageHtml), false)
})

test('BizBima sentinel returns [] only while the verified parked-domain surface remains unchanged', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createBizBimaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === scraper.HOMEPAGE_URL) return parkedHomepageHtml
      if (url === scraper.WWW_HOMEPAGE_URL) return parkedHomepageHtml
      if (url === scraper.ROBOTS_URL) return robotsTxt
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.WWW_HOMEPAGE_URL,
    scraper.ROBOTS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('BizBima sentinel fails closed when the parked first-party surface drifts or starts exposing jobs', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createBizBimaScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) {
          return '<html><head><title>BizBima</title></head><body><h1>BizBima</h1></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified parked-domain surface/i,
  )

  await assert.rejects(
    scraper.createBizBimaScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL || url === scraper.WWW_HOMEPAGE_URL) {
          return parkedHomepageHtml.replace(
            '</body>',
            '<section><h2>Current Openings</h2><a href="/jobs/operations-manager">Apply now</a></section></body>',
          )
        }
        if (url === scraper.ROBOTS_URL) return robotsTxt
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /appears to expose public jobs/i,
  )

  await assert.rejects(
    scraper.createBizBimaScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL || url === scraper.WWW_HOMEPAGE_URL) return parkedHomepageHtml
        if (url === scraper.ROBOTS_URL) return 'User-agent: *\nDisallow: /'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /robots.txt no longer matches the verified parked-domain surface/i,
  )
})
