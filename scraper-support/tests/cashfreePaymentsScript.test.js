import assert from 'node:assert/strict'
import test from 'node:test'

const loadCashfreeModule = async () => {
  try {
    return await import('../../scraper/cashfreepayments/script.js')
  } catch {
    assert.fail('Expected Cashfree Payments scraper module at ../../scraper/cashfreepayments/script.js')
  }
}

const homepageHtml = `
  <html>
    <head><title>Cashfree Payments</title></head>
    <body>
      <a href="https://www.cashfree.com/careers/">Careers</a>
      <p>Payments and banking infrastructure.</p>
    </body>
  </html>
`

const currentHomepageHtml = `
  <html>
    <head><title>Cashfree Payments - Fastest way to collect online payments</title></head>
    <body>
      <nav><a href="/careers/">Careers</a></nav>
      <p>Payment Gateway and payments infrastructure.</p>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head><title>Careers | Cashfree Payments</title></head>
    <body>
      <h1>Careers</h1>
      <p>Write to careers@cashfree.com</p>
      <a href="mailto:careers@cashfree.com">Email us</a>
    </body>
  </html>
`

const sitemapXml = `
  <sitemapindex>
    <sitemap><loc>https://www.cashfree.com/sitemap-index.xml</loc></sitemap>
    <url><loc>https://www.cashfree.com/careers/</loc></url>
  </sitemapindex>
`

const sitemapIndexXml = `
  <sitemapindex>
    <sitemap><loc>https://www.cashfree.com/sitemap-0.xml</loc></sitemap>
    <sitemap><loc>https://www.cashfree.com/sitemap-1.xml</loc></sitemap>
  </sitemapindex>
`

test('Cashfree Payments retains archived official-surface discovery helpers', async () => {
  const cashfree = await loadCashfreeModule()

  assert.equal(cashfree.HOMEPAGE_URL, 'https://www.cashfree.com/')
  assert.equal(cashfree.CAREERS_PAGE_URL, 'https://www.cashfree.com/careers/')
  assert.equal(cashfree.SITEMAP_URL, 'https://www.cashfree.com/sitemap-index.xml')
  assert.equal(cashfree.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(cashfree.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(cashfree.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(cashfree.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(cashfree.hasOfficialSitemapSignal(sitemapIndexXml), true)
})

test('Cashfree Payments cannot certify an archived email-only page as the current native job inventory', async () => {
  const cashfree = await loadCashfreeModule()
  const requestedUrls = []

  await assert.rejects(cashfree.createCashfreePaymentsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === cashfree.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === cashfree.CAREERS_PAGE_URL) return { status: 200, url, html: careersHtml }
      if (url === cashfree.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (cashfree.NO_PUBLIC_ROUTE_URLS.includes(url)) {
        return { status: 403, url, html: '<html><body>Forbidden</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), /Cashfree native Kula.*(?:identity|canonical|handoff)/i)

  assert.deepEqual(requestedUrls, [cashfree.CAREERS_PAGE_URL])
})

test('Cashfree Payments run fails closed when the careers page starts exposing public listings', async () => {
  const cashfree = await loadCashfreeModule()

  await assert.rejects(
    cashfree.createCashfreePaymentsScraper().run({
      fetchPage: async (url) => {
        if (url === cashfree.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === cashfree.CAREERS_PAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open Positions</h1><a href="https://boards.greenhouse.io/cashfree">Apply now</a></body></html>',
          }
        }
        if (url === cashfree.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        return { status: 403, url, html: '<html><body>Forbidden</body></html>' }
      },
    }),
    /Cashfree native Kula.*(?:identity|canonical|handoff)/i,
  )
})
